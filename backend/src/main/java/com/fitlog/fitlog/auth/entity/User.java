package com.fitlog.fitlog.auth.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_id", unique = true)
    private Long kakaoId;

    @Column(name = "apple_id", unique = true)
    private String appleId;

    @Column(name = "email")
    private String email;

    @Column(name = "name")
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "role")
    private Role role;

    @Column(name = "fcm_token")
    private String fcmToken;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // null이면 정상 계정, 값이 있으면 소프트 딜리트된 계정 (7일 후 완전 삭제)
    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    public enum Role {
        TRAINER, MEMBER
    }

    public Long getId() { return id; }
    public Long getKakaoId() { return kakaoId; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public Role getRole() { return role; }
    public String getFcmToken() { return fcmToken; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getDeletedAt() { return deletedAt; }

    public String getAppleId() { return appleId; }
    public void setAppleId(String appleId) { this.appleId = appleId; }
    public void setKakaoId(Long kakaoId) { this.kakaoId = kakaoId; }
    public void setEmail(String email) { this.email = email; }
    public void setName(String name) { this.name = name; }
    public void setRole(Role role) { this.role = role; }
    public void setFcmToken(String fcmToken) { this.fcmToken = fcmToken; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
}