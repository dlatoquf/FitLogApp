package com.fitlog.fitlog.auth.repository;

import com.fitlog.fitlog.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByKakaoId(Long kakaoId);
    Optional<User> findByAppleId(String appleId);

    Optional<User> findByFcmToken(String fcmToken);

    // 7일 초과 소프트 딜리트된 유저 (완전 삭제 대상)
    @Query("SELECT u FROM User u WHERE u.deletedAt IS NOT NULL AND u.deletedAt < :cutoff")
    List<User> findUsersToHardDelete(@Param("cutoff") LocalDateTime cutoff);
}