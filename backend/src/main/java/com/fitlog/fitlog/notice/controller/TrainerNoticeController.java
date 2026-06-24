package com.fitlog.fitlog.notice.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notice.entity.TrainerNotice;
import com.fitlog.fitlog.notice.repository.TrainerNoticeRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/trainer")
public class TrainerNoticeController {

    private final TrainerNoticeRepository noticeRepository;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final ManualMemberRepository manualMemberRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public TrainerNoticeController(TrainerNoticeRepository noticeRepository,
                                   TrainerRepository trainerRepository,
                                   MemberRepository memberRepository,
                                   ManualMemberRepository manualMemberRepository,
                                   JwtService jwtService,
                                   NotificationService notificationService) {
        this.noticeRepository = noticeRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.manualMemberRepository = manualMemberRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
    }

    // ── 연동 회원 공지 목록 조회
    @GetMapping("/members/{memberId}/notices")
    public List<Map<String, Object>> getNotices(@PathVariable Long memberId) {
        return noticeRepository.findByMemberIdOrderByCreatedAtDesc(memberId)
                .stream().map(this::toMap).toList();
    }

    // ── 연동 회원 공지 작성
    @Transactional
    @PostMapping("/members/{memberId}/notices")
    public ResponseEntity<Map<String, Object>> createNotice(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        String content = body.get("content");
        if (content == null || content.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "내용을 입력해주세요."));

        TrainerNotice notice = new TrainerNotice();
        notice.setTrainer(trainer);
        notice.setMember(member);
        notice.setContent(content.trim());
        noticeRepository.save(notice);
        try {
            notificationService.sendNotification(member.getUser(), "GENERAL",
                    trainer.getUser().getName() + " 트레이너의 공지: " + content.trim());
        } catch (Exception ignored) {}
        return ResponseEntity.ok(toMap(notice));
    }

    // ── 미연동 회원 공지 목록 조회
    @GetMapping("/manual-members/{manualMemberId}/notices")
    public List<Map<String, Object>> getManualNotices(@PathVariable Long manualMemberId) {
        return noticeRepository.findByManualMemberIdOrderByCreatedAtDesc(manualMemberId)
                .stream().map(this::toMap).toList();
    }

    // ── 미연동 회원 공지 작성
    @Transactional
    @PostMapping("/manual-members/{manualMemberId}/notices")
    public ResponseEntity<Map<String, Object>> createManualNotice(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        ManualMember mm = manualMemberRepository.findById(manualMemberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        String content = body.get("content");
        if (content == null || content.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "내용을 입력해주세요."));

        TrainerNotice notice = new TrainerNotice();
        notice.setTrainer(trainer);
        notice.setManualMember(mm);
        notice.setContent(content.trim());
        noticeRepository.save(notice);
        return ResponseEntity.ok(toMap(notice));
    }


    // ── 전체공지 목록 조회
    @GetMapping("/notices/broadcasts")
    public List<Map<String, Object>> getBroadcasts(@RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        // broadcastGroupId별 대표 1건씩
        List<TrainerNotice> all = noticeRepository.findByTrainerIdAndBroadcastTrueOrderByCreatedAtDesc(trainer.getId());
        Map<Long, TrainerNotice> grouped = new java.util.LinkedHashMap<>();
        for (TrainerNotice n : all) {
            if (n.getBroadcastGroupId() != null && !grouped.containsKey(n.getBroadcastGroupId())) {
                grouped.put(n.getBroadcastGroupId(), n);
            }
        }
        return grouped.values().stream().map(this::toBroadcastMap).toList();
    }

    // ── 전체 회원 공지 작성
    @Transactional
    @PostMapping("/notices/all")
    public ResponseEntity<Map<String, Object>> createNoticeForAll(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        String content = body.get("content");
        if (content == null || content.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "내용을 입력해주세요."));

        // groupId를 위해 임시 저장 후 ID 사용
        long groupId = System.currentTimeMillis();
        int count = 0;
        // 연동 회원
        List<Member> members = memberRepository.findAllByTrainer(trainer);
        for (Member member : members) {
            if (member.getUser() == null || member.getUser().getDeletedAt() != null) continue;
            TrainerNotice notice = new TrainerNotice();
            notice.setTrainer(trainer);
            notice.setMember(member);
            notice.setContent(content.trim());
            notice.setBroadcast(true);
            notice.setBroadcastGroupId(groupId);
            noticeRepository.save(notice);
            try {
                notificationService.sendNotification(member.getUser(), "GENERAL",
                        "[전체 공지] " + trainer.getUser().getName() + " 트레이너: " + content.trim());
            } catch (Exception ignored) {}
            count++;
        }
        // 미연동 회원
        List<ManualMember> manualMembers = manualMemberRepository.findByTrainer(trainer);
        for (ManualMember mm : manualMembers) {
            TrainerNotice notice = new TrainerNotice();
            notice.setTrainer(trainer);
            notice.setManualMember(mm);
            notice.setContent(content.trim());
            notice.setBroadcast(true);
            notice.setBroadcastGroupId(groupId);
            noticeRepository.save(notice);
            count++;
        }
        return ResponseEntity.ok(Map.of("message", "전체 공지가 완료됐어요.", "count", count, "broadcastGroupId", groupId));
    }

    // ── 전체공지 수정 (그룹 전체)
    @Transactional
    @PatchMapping("/notices/broadcasts/{groupId}")
    public ResponseEntity<Map<String, Object>> updateBroadcast(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long groupId,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        String content = body.get("content");
        if (content == null || content.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "내용을 입력해주세요."));
        noticeRepository.updateContentByBroadcastGroupId(groupId, content.trim());
        return ResponseEntity.ok(Map.of("message", "전체 공지가 수정됐어요."));
    }

    // ── 전체공지 삭제 (그룹 전체)
    @Transactional
    @DeleteMapping("/notices/broadcasts/{groupId}")
    public ResponseEntity<Map<String, String>> deleteBroadcast(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long groupId) {
        getTrainer(authorization);
        noticeRepository.deleteByBroadcastGroupId(groupId);
        return ResponseEntity.ok(Map.of("message", "전체 공지가 삭제됐어요."));
    }

    // ── 공지 수정 (연동/미연동 공통)
    @Transactional
    @PatchMapping("/notices/{noticeId}")
    public ResponseEntity<Map<String, Object>> updateNotice(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long noticeId,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        TrainerNotice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new RuntimeException("공지를 찾을 수 없습니다."));
        if (!notice.getTrainer().getId().equals(trainer.getId()))
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        String content = body.get("content");
        if (content == null || content.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "내용을 입력해주세요."));
        notice.setContent(content.trim());
        noticeRepository.save(notice);
        return ResponseEntity.ok(toMap(notice));
    }

    // ── 공지 삭제 (연동/미연동 공통)
    @Transactional
    @DeleteMapping("/notices/{noticeId}")
    public ResponseEntity<Map<String, String>> deleteNotice(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long noticeId) {
        Trainer trainer = getTrainer(authorization);
        TrainerNotice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new RuntimeException("공지를 찾을 수 없습니다."));
        if (!notice.getTrainer().getId().equals(trainer.getId()))
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        noticeRepository.delete(notice);
        return ResponseEntity.ok(Map.of("message", "삭제됐어요."));
    }

    private Map<String, Object> toMap(TrainerNotice n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId());
        m.put("content", n.getContent());
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().format(FMT) : null);
        m.put("broadcast", n.isBroadcast());
        m.put("broadcastGroupId", n.getBroadcastGroupId());
        return m;
    }

    private Map<String, Object> toBroadcastMap(TrainerNotice n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("broadcastGroupId", n.getBroadcastGroupId());
        m.put("content", n.getContent());
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().format(FMT) : null);
        return m;
    }

    private Trainer getTrainer(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }

    private Member getMember(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
    }
}
