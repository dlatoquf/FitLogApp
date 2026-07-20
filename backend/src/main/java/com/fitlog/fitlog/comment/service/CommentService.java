package com.fitlog.fitlog.comment.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.comment.dto.CommentRequest;
import com.fitlog.fitlog.comment.dto.CommentResponse;
import com.fitlog.fitlog.comment.entity.Comment;
import com.fitlog.fitlog.comment.repository.CommentRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import java.time.LocalDate;
import com.fitlog.fitlog.workout.entity.WorkoutLog;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {

    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final WorkoutLogRepository workoutLogRepository;

    public CommentService(CommentRepository commentRepository,
                          UserRepository userRepository,
                          JwtService jwtService,
                          NotificationService notificationService,
                          MemberRepository memberRepository,
                          TrainerRepository trainerRepository,
                          WorkoutLogRepository workoutLogRepository) {
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.workoutLogRepository = workoutLogRepository;
    }

    public List<CommentResponse> getComments(String targetType, Long targetId, String date, Long trainerId, Long memberId) {
        List<Comment> comments;
        if ("DIET_DAY".equals(targetType)) {
            if (date == null || trainerId == null || memberId == null) return java.util.Collections.emptyList();
            comments = commentRepository.findDietDayComments(targetType, trainerId, memberId, LocalDate.parse(date));
        } else {
            comments = commentRepository.findByTargetTypeAndTargetIdAndDeletedAtIsNullOrderByCreatedAtAsc(targetType, targetId);
        }
        // MEMBER 역할 작성자 userId 목록을 한 번에 조회 (N+1 방지)
        java.util.Set<Long> memberUserIds = comments.stream()
                .filter(c -> "MEMBER".equals(c.getAuthorRole()))
                .map(c -> c.getAuthor().getId())
                .collect(Collectors.toSet());
        java.util.Map<Long, String> cachedNameMap = memberRepository.findByUserIdIn(memberUserIds).stream()
                .collect(Collectors.toMap(
                        m -> m.getUser().getId(),
                        m -> m.getCachedName() != null ? m.getCachedName() : m.getUser().getName()
                ));
        return comments.stream()
                .map(c -> CommentResponse.from(c, resolveDisplayName(c, cachedNameMap)))
                .collect(Collectors.toList());
    }

    private String resolveDisplayName(Comment c, java.util.Map<Long, String> cachedNameMap) {
        if (!"MEMBER".equals(c.getAuthorRole())) return c.getAuthor().getName();
        return cachedNameMap.getOrDefault(c.getAuthor().getId(), c.getAuthor().getName());
    }

    private String resolveDisplayName(Comment c) {
        if (!"MEMBER".equals(c.getAuthorRole())) return c.getAuthor().getName();
        return memberRepository.findByUserId(c.getAuthor().getId())
                .map(m -> m.getCachedName() != null ? m.getCachedName() : c.getAuthor().getName())
                .orElse(c.getAuthor().getName());
    }

    public CommentResponse addComment(String token, String targetType, Long targetId, String date, Long trainerId, Long memberId, CommentRequest req) {
        User author = getUserFromToken(token);

        // 미연동 회원 운동로그는 댓글 불가
        if ("WORKOUT_LOG".equals(targetType)) {
            WorkoutLog log = workoutLogRepository.findById(targetId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
            if (log.getMember() == null) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "미연동 회원 운동로그에는 댓글을 달 수 없습니다.");
            }
        }

        Comment comment = new Comment();
        comment.setTargetType(targetType);
        comment.setTargetId(targetId);
        comment.setAuthor(author);
        comment.setAuthorRole(author.getRole().name());
        comment.setContent(req.getContent().trim());
        if ("DIET_DAY".equals(targetType) && date != null) {
            comment.setTargetDate(LocalDate.parse(date));
        }
        if (trainerId != null) comment.setTrainerId(trainerId);
        if (memberId != null) comment.setMemberId(memberId);
        commentRepository.save(comment);

        sendCommentNotification(author, targetType, targetId, date, memberId);

        return CommentResponse.from(comment, resolveDisplayName(comment));
    }

    public CommentResponse updateComment(String token, Long commentId, CommentRequest req) {
        User user = getUserFromToken(token);
        Comment comment = commentRepository.findByIdWithAuthor(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (!comment.getAuthor().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        if (comment.getDeletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        comment.setContent(req.getContent().trim());
        comment.setUpdatedAt(LocalDateTime.now());
        commentRepository.save(comment);
        return CommentResponse.from(comment, resolveDisplayName(comment));
    }

    public void deleteComment(String token, Long commentId) {
        User user = getUserFromToken(token);
        Comment comment = commentRepository.findByIdWithAuthor(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (!comment.getAuthor().getId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }

        comment.setDeletedAt(LocalDateTime.now());
        commentRepository.save(comment);
    }

    private void sendCommentNotification(User author, String targetType, Long targetId, String date, Long memberId) {
        try {
            if ("WORKOUT_LOG".equals(targetType)) {
                WorkoutLog log = workoutLogRepository.findByIdWithUsers(targetId).orElse(null);
                if (log == null) return;

                Member logMember = log.getMember();
                String authorDisplayName = author.getRole() == User.Role.TRAINER
                        ? author.getName()
                        : (logMember != null && logMember.getCachedName() != null ? logMember.getCachedName() : author.getName());
                String authorLabel = author.getRole() == User.Role.TRAINER ? authorDisplayName + " 트레이너가" : authorDisplayName + "님이";
                String message = authorLabel + " 운동 로그에 댓글을 달았어요.";

                if (author.getRole() == User.Role.TRAINER) {
                    // 트레이너 → 회원 알림 (댓글은 항상 전송)
                    Member member = logMember;
                    if (member != null) {
                        notificationService.sendNotification(
                                member.getUser(), "WORKOUT_LOG", message,
                                "WORKOUT_LOG", targetId, log.getLogDate().toString());
                    }
                } else {
                    // 회원 → 트레이너 알림
                    if (log.getTrainer() != null) {
                        Member authorMember = memberRepository.findByUserId(author.getId()).orElse(null);
                        Long authorMemberId = authorMember != null ? authorMember.getId() : null;
                        notificationService.sendNotification(
                                log.getTrainer().getUser(), "WORKOUT_LOG", message,
                                "MEMBER", authorMemberId, log.getLogDate().toString());
                    }
                }
            } else if ("DIET_DAY".equals(targetType)) {
                // targetId = memberId
                if (author.getRole() == User.Role.TRAINER) {
                    String dietAuthorLabel = author.getName() + " 트레이너가";
                    String message = dietAuthorLabel + " 식단 로그에 댓글을 달았어요.";
                    // 트레이너 → 회원 알림 (댓글은 항상 전송)
                    memberRepository.findByIdWithUser(targetId).ifPresent(member -> {
                        notificationService.sendNotification(
                                member.getUser(), "DIET_FEEDBACK", message, "MEMBER", targetId, date);
                    });
                } else {
                    // 회원 → 트레이너 알림 (member-detail 식단 탭으로)
                    memberRepository.findByUserId(author.getId()).ifPresent(member -> {
                        String dietDisplayName = member.getCachedName() != null ? member.getCachedName() : author.getName();
                        String message = dietDisplayName + "님이 식단 로그에 댓글을 달았어요.";
                        if (member.getTrainer() != null) {
                            com.fitlog.fitlog.trainer.entity.Trainer trainer = member.getTrainer();
                            if (trainer.getNotifDiet() == null || trainer.getNotifDiet()) {
                                Long mid = memberId != null ? memberId : member.getId();
                                notificationService.sendNotification(
                                        trainer.getUser(), "DIET_FEEDBACK", message, "MEMBER", mid, date);
                            }
                        }
                    });
                }
            }
        } catch (Exception e) {
            System.out.println("댓글 알림 전송 실패: " + e.getMessage());
        }
    }

    private User getUserFromToken(String token) {
        if (token == null || !token.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        Long userId = jwtService.getUserIdFromToken(token.substring(7));
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }
}
