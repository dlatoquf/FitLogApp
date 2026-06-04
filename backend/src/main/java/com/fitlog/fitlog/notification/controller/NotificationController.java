package com.fitlog.fitlog.notification.controller;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.diet.repository.DietDayFeedbackRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;
    private final DietDayFeedbackRepository dietDayFeedbackRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public NotificationController(NotificationRepository notificationRepository,
                                  UserRepository userRepository,
                                  JwtService jwtService,
                                  DietDayFeedbackRepository dietDayFeedbackRepository,
                                  WorkoutLogRepository workoutLogRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.dietDayFeedbackRepository = dietDayFeedbackRepository;
        this.workoutLogRepository = workoutLogRepository;
    }

    // 내 알림 조회
    @GetMapping
    public List<Map<String, Object>> getMyNotifications(
            @RequestHeader("Authorization") String authorization
    ) {
        User user = getUserFromToken(authorization);
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);

        return notificationRepository
                .findByUserAndCreatedAtAfterOrderByCreatedAtDesc(user, sevenDaysAgo)
                .stream()
                .map(n -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("notificationId", n.getNotificationId());
                    map.put("type", n.getType());
                    map.put("content", n.getContent());
                    map.put("isRead", n.getIsRead());
                    map.put("createdAt", n.getCreatedAt());
                    map.put("targetType", n.getTargetType());
                    map.put("targetId", n.getTargetId());
                    // 날짜·회원 연계 화면 이동을 위한 추가 필드
                    if (n.getTargetId() != null) {
                        if ("DIET_FEEDBACK".equals(n.getTargetType())) {
                            dietDayFeedbackRepository.findById(n.getTargetId())
                                .ifPresent(f -> map.put("targetDate", f.getDate().toString()));
                        } else if ("WORKOUT_LOG".equals(n.getTargetType())) {
                            workoutLogRepository.findById(n.getTargetId()).ifPresent(l -> {
                                if (l.getLogDate() != null) map.put("targetDate", l.getLogDate().toString());
                                if (l.getMember() != null) map.put("memberId", l.getMember().getId());
                            });
                        }
                    }
                    // DIET_PHOTO: content에서 날짜 파싱 ("OO님이 2026-05-31 식단 사진을 등록했어요.")
                    if ("DIET_PHOTO".equals(n.getType()) && n.getContent() != null) {
                        java.util.regex.Matcher m = java.util.regex.Pattern
                            .compile("(\\d{4}-\\d{2}-\\d{2})").matcher(n.getContent());
                        if (m.find()) map.put("targetDate", m.group(1));
                    }
                    return map;
                })
                .collect(Collectors.toList());
    }

    // 안 읽은 알림 개수
    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> getUnreadCount(
            @RequestHeader("Authorization") String authorization
    ) {
        User user = getUserFromToken(authorization);
        long count = notificationRepository.countByUserAndIsReadFalse(user);
        return ResponseEntity.ok(Map.of("count", count));
    }

    // 전체 읽음 처리
    @PutMapping("/read-all")
    public ResponseEntity<Map<String, String>> readAll(
            @RequestHeader("Authorization") String authorization
    ) {
        User user = getUserFromToken(authorization);
        notificationRepository.markAllAsRead(user);
        return ResponseEntity.ok(Map.of("message", "모두 읽음 처리됐어요."));
    }

    // 단건 읽음 처리
    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, String>> readOne(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id
    ) {
        User user = getUserFromToken(authorization);
        notificationRepository.markOneAsRead(id, user);
        return ResponseEntity.ok(Map.of("message", "읽음 처리됐어요."));
    }

    // FCM 토큰 저장 (앱 시작 시 프론트에서 호출)
    @PostMapping("/fcm-token")
    public ResponseEntity<Map<String, String>> saveFcmToken(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body
    ) {
        User user = getUserFromToken(authorization);
        String token = body.get("token");

        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "토큰이 없어요."));
        }

        // User 엔티티에 FCM 토큰 저장
        user.setFcmToken(token);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "FCM 토큰 저장 완료"));
    }

    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }
}
