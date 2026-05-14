package com.fitlog.fitlog.notification.controller;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
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
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public NotificationController(NotificationRepository notificationRepository,
                                  UserRepository userRepository,
                                  JwtService jwtService) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
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