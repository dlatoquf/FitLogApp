package com.fitlog.fitlog.notification.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseConfig {

    @PostConstruct
    public void initFirebase() throws IOException {
        // 이미 초기화된 경우 중복 초기화 방지
        if (!FirebaseApp.getApps().isEmpty()) return;

        InputStream serviceAccount = null;

        // 1순위: 환경변수 FIREBASE_SERVICE_ACCOUNT_JSON (Railway 배포용)
        String envJson = System.getenv("FIREBASE_SERVICE_ACCOUNT_JSON");
        if (envJson != null && !envJson.isBlank()) {
            serviceAccount = new ByteArrayInputStream(envJson.getBytes(StandardCharsets.UTF_8));
            System.out.println("Firebase: 환경변수에서 서비스 계정 로드");
        } else {
            // 2순위: 클래스패스의 firebase-service-account.json (로컬 개발용)
            serviceAccount = getClass().getClassLoader()
                    .getResourceAsStream("firebase-service-account.json");
            if (serviceAccount != null) {
                System.out.println("Firebase: 파일에서 서비스 계정 로드");
            }
        }

        if (serviceAccount == null) {
            System.out.println("Firebase 서비스 계정 없음 - 푸시 알림 비활성화");
            return;
        }

        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                .build();

        FirebaseApp.initializeApp(options);
        System.out.println("Firebase 초기화 완료");
    }
}