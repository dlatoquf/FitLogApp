package com.fitlog.fitlog.notification.service;

import com.google.auth.oauth2.GoogleCredentials;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.notification.entity.Notification;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final GoogleCredentials firebaseCredentials;

    private static final String FCM_URL =
            "https://fcm.googleapis.com/v1/projects/fitlogapp-e972c/messages:send";

    public NotificationService(NotificationRepository notificationRepository,
                               UserRepository userRepository,
                               GoogleCredentials firebaseCredentials) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
        this.firebaseCredentials = firebaseCredentials;
    }

    public void sendNotification(User user, String type, String content, String targetType, Long targetId) {
        sendNotification(user, type, content, targetType, targetId, null);
    }

    public void sendNotification(User user, String type, String content, String targetType, Long targetId, String date) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setContent(content);
        notification.setTargetType(targetType);
        notification.setTargetId(targetId);
        notificationRepository.save(notification);

        if (user.getFcmToken() != null && !user.getFcmToken().isBlank()) {
            long unreadCount = notificationRepository.countByUserAndIsReadFalseAndCreatedAtAfter(user, java.time.LocalDateTime.now().minusDays(7));
            sendPushWithTarget(user.getFcmToken(), content, type, date, targetId, (int) unreadCount);
        }
    }

    public void sendNotification(User user, String type, String content) {
        sendNotification(user, type, content, null, null, null);
    }

    public void clearBadge(User user) {
        if (user.getFcmToken() == null || user.getFcmToken().isBlank()) return;
        if (firebaseCredentials == null) return;
        try {
            firebaseCredentials.refreshIfExpired();
            String accessToken = firebaseCredentials.getAccessToken().getTokenValue();
            String json = "{"
                    + "\"message\": {"
                    + "  \"token\": \"" + user.getFcmToken() + "\","
                    + "  \"data\": {\"type\": \"BADGE_CLEAR\"},"
                    + "  \"apns\": {\"payload\": {\"aps\": {\"badge\": 0, \"content-available\": 1}}},"
                    + "  \"android\": {}"
                    + "}"
                    + "}";
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(FCM_URL))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
            client.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException | InterruptedException e) {
            System.out.println("뱃지 초기화 FCM 예외: " + e.getMessage());
        }
    }

    private void sendPushWithTarget(String fcmToken, String body, String type, String date, Long targetId, int badge) {
        if (firebaseCredentials == null) {
            System.out.println("Firebase 미설정 - 푸시 전송 생략");
            return;
        }
        try {
            firebaseCredentials.refreshIfExpired();
            String accessToken = firebaseCredentials.getAccessToken().getTokenValue();

            String dataField = "\"type\": \"" + type + "\"";
            if (date != null && !date.isBlank()) {
                dataField += ", \"date\": \"" + date + "\"";
            }
            if (targetId != null) {
                dataField += ", \"targetId\": \"" + targetId + "\"";
            }

            String json = "{"
                    + "\"message\": {"
                    + "  \"token\": \"" + fcmToken + "\","
                    + "  \"notification\": {\"title\": \"FitLog\", \"body\": \"" + escapeJson(body) + "\"},"
                    + "  \"data\": {" + dataField + "},"
                    + "  \"apns\": {\"payload\": {\"aps\": {\"sound\": \"default\", \"badge\": " + badge + "}}},"
                    + "  \"android\": {\"notification\": {\"sound\": \"default\"}}"
                    + "}"
                    + "}";

            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(FCM_URL))
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                System.out.println("FCM 푸시 전송 성공");
            } else if (response.statusCode() == 404 || response.body().contains("UNREGISTERED")) {
                userRepository.findByFcmToken(fcmToken).ifPresent(u -> {
                    u.setFcmToken(null);
                    userRepository.save(u);
                    System.out.println("만료된 FCM 토큰 삭제: userId=" + u.getId());
                });
            } else {
                System.out.println("FCM 전송 실패 [" + response.statusCode() + "]: " + response.body());
            }
        } catch (IOException | InterruptedException e) {
            System.out.println("FCM 전송 예외: " + e.getMessage());
        }
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
