package com.fitlog.fitlog.auth.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", unique = true)
    private Long kakaoId;

    @Column(name = "email")
    private String email;

    @Column(name = "name")
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "role")
    private Role role;

    // FCM 푸시 알림 토큰 (앱 실행 시 저장됨)
    @Column(name = "fcm_token")
    private String fcmToken;

    public enum Role {
        TRAINER, MEMBER
    }

    public Long getId() { return id; }
    public Long getKakaoId() { return kakaoId; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public Role getRole() { return role; }
    public String getFcmToken() { return fcmToken; }

    public void setKakaoId(Long kakaoId) { this.kakaoId = kakaoId; }
    public void setEmail(String email) { this.email = email; }
    public void setName(String name) { this.name = name; }
    public void setRole(Role role) { this.role = role; }
    public void setFcmToken(String fcmToken) { this.fcmToken = fcmToken; }
}