package com.fitlog.fitlog.notification.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;

@Configuration
public class FirebaseConfig {

    @Bean
    public GoogleCredentials firebaseCredentials() throws IOException {
        InputStream serviceAccount = null;

        String filePath = System.getenv("FIREBASE_SERVICE_ACCOUNT_PATH");
        if (filePath != null && !filePath.isBlank() && Files.exists(Paths.get(filePath))) {
            serviceAccount = new FileInputStream(filePath);
            System.out.println("Firebase: 파일 경로에서 서비스 계정 로드 - " + filePath);
        } else {
            serviceAccount = getClass().getClassLoader()
                    .getResourceAsStream("firebase-service-account.json");
            if (serviceAccount != null) {
                System.out.println("Firebase: 클래스패스 파일에서 서비스 계정 로드");
            }
        }

        if (serviceAccount == null) {
            System.out.println("Firebase 서비스 계정 없음 - 푸시 알림 비활성화");
            return null;
        }

        GoogleCredentials credentials = ServiceAccountCredentials.fromStream(serviceAccount)
                .createScoped(List.of("https://www.googleapis.com/auth/firebase.messaging"));

        System.out.println("Firebase 초기화 완료");
        return credentials;
    }
}
