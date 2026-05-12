package com.fitlog.fitlog.trainer.repository;

import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.auth.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TrainerRepository extends JpaRepository<Trainer, Long> {

    @EntityGraph(attributePaths = {"user"})
    Optional<Trainer> findByUser(User user);

    Optional<Trainer> findByTrainerCode(String trainerCode);

    // 홈 화면용 조회
    // trainer + user 정보만 JOIN FETCH
    // 회원 목록(members)은 조회하지 않는 가벼운 쿼리
    @Query("SELECT t FROM Trainer t " +
            "JOIN FETCH t.user " +
            "WHERE t.user.id = :userId")
    Optional<Trainer> findByUserId(@Param("userId") Long userId);

    // 회원 목록 / 슬롯 생성 알림용 조회
    // trainer + user + members + member.user까지 한 번에 조회
    // trainer.getMembers()를 실제로 사용하는 기능에서만 사용
    @Query("SELECT DISTINCT t FROM Trainer t " +
            "JOIN FETCH t.user " +
            "LEFT JOIN FETCH t.members m " +
            "LEFT JOIN FETCH m.user " +
            "WHERE t.user.id = :userId")
    Optional<Trainer> findByUserIdWithMembers(@Param("userId") Long userId);

    @Query("SELECT t.id FROM Trainer t WHERE t.user.id = :userId")
    Optional<Long> findTrainerIdByUserId(@Param("userId") Long userId);
}