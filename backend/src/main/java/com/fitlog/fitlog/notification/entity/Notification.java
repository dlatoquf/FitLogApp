package com.fitlog.fitlog.notification.entity;

import com.fitlog.fitlog.auth.entity.User;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "Notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "is_read")
    private Boolean isRead = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "target_type")
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "target_date")
    private String targetDate;

    @Column(name = "member_id")
    private Long memberId;

    // Getters & Setters
    public Long getNotificationId() { return notificationId; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public String getTargetType() { return targetType;}
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }
    public String getTargetDate() { return targetDate; }
    public void setTargetDate(String targetDate) { this.targetDate = targetDate; }
    public Long getMemberId() { return memberId; }
    public void setMemberId(Long memberId) { this.memberId = memberId; }
}