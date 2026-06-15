package com.fitlog.fitlog.notification.repository;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.notification.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    // 최근 7일 알림 조회
    List<Notification> findByUserAndCreatedAtAfterOrderByCreatedAtDesc(
            User user,
            LocalDateTime createdAt
    );

    // 안 읽은 알림 개수 (7일 이내)
    long countByUserAndIsReadFalseAndCreatedAtAfter(User user, LocalDateTime createdAt);

    // 전체 읽음 처리
    @Transactional
    @Modifying
    @Query("update Notification n set n.isRead = true where n.user = :user and n.isRead = false")
    void markAllAsRead(User user);

    // 단건 읽음 처리
    @Transactional
    @Modifying
    @Query("update Notification n set n.isRead = true where n.notificationId = :id and n.user = :user")
    void markOneAsRead(Long id, User user);

    // 7일 지난 알림 삭제
    @Transactional
    @Modifying
    void deleteByCreatedAtBefore(LocalDateTime createdAt);

    // 계정 삭제용 - 유저의 전체 알림 삭제
    @Transactional
    @Modifying
    @Query("DELETE FROM Notification n WHERE n.user = :user")
    void deleteAllByUser(@Param("user") User user);
}