package com.fitlog.fitlog.notification.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.notification.entity.Notification;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    /**
     * DB에 알림 저장 + FCM 푸시 전송
     * 다른 서비스에서 알림 보낼 때 이 메서드 호출하면 됨
     *
     * 사용 예시:
     * notificationService.sendNotification(user, "SCHEDULE_CONFIRM", "수업이 확정됐어요!", "SCHEDULE", scheduleId);
     */
    public void sendNotification(User user, String type, String content, String targetType, Long targetId) {
        sendNotification(user, type, content, targetType, targetId, null);
    }

    public void sendNotification(User user, String type, String content, String targetType, Long targetId, String date) {
        // 1. DB에 알림 저장
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setContent(content);
        notification.setTargetType(targetType);
        notification.setTargetId(targetId);
        notificationRepository.save(notification);

        // 2. FCM 푸시 전송 (토큰 있을 때만)
        if (user.getFcmToken() != null && !user.getFcmToken().isBlank()) {
            sendPush(user.getFcmToken(), content, type, date);
        }
    }

    // targetType, targetId 없는 단순 알림용
    public void sendNotification(User user, String type, String content) {
        sendNotification(user, type, content, null, null, null);
    }

    // FCM 푸시 실제 전송
    private void sendPush(String fcmToken, String body, String type, String date) {
        try {
            Message.Builder builder = Message.builder()
                    .setToken(fcmToken)
                    .setApnsConfig(ApnsConfig.builder()
                            .setAps(Aps.builder().setSound("default").setBadge(1).build())
                            .build())
                    .setAndroidConfig(AndroidConfig.builder()
                            .setNotification(AndroidNotification.builder().setSound("default").build())
                            .build())
                    .setNotification(com.google.firebase.messaging.Notification.builder()
                            .setTitle("FitLog")
                            .setBody(body)
                            .build())
                    .putData("type", type);
            if (date != null && !date.isBlank()) {
                builder.putData("date", date);
            }
            Message message = builder.build();

            FirebaseMessaging.getInstance().send(message);
        } catch (com.google.firebase.messaging.FirebaseMessagingException e) {
            String errorCode = e.getMessagingErrorCode() != null ? e.getMessagingErrorCode().name() : "";
            // 토큰 무효 (앱 삭제·재설치) → DB에서 토큰 제거
            if (errorCode.equals("UNREGISTERED") || errorCode.equals("INVALID_ARGUMENT")) {
                userRepository.findByFcmToken(fcmToken).ifPresent(u -> {
                    u.setFcmToken(null);
                    userRepository.save(u);
                    System.out.println("만료된 FCM 토큰 삭제: userId=" + u.getId());
                });
            } else {
                System.out.println("FCM 푸시 전송 실패 [" + errorCode + "]: " + e.getMessage());
            }
        } catch (Exception e) {
            System.out.println("FCM 푸시 전송 실패: " + e.getMessage());
        }
    }
}