package com.fitlog.fitlog.trainer.repository;

import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.auth.entity.User;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TrainerRepository extends JpaRepository<Trainer, Long> {

    @EntityGraph(attributePaths = {"user"})
    Optional<Trainer> findByUser(User user);

    @Query("SELECT t FROM Trainer t JOIN FETCH t.user WHERE t.trainerCode = :code")
    Optional<Trainer> findByTrainerCode(@Param("code") String code);

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

    // 제휴 만료 대상 (gymConfirmedAt이 기준일 이전인 경우 — 1월 1일 기준으로 사용)
    @Query("SELECT t FROM Trainer t JOIN FETCH t.user WHERE t.gymConfirmedAt IS NOT NULL AND t.gymConfirmedAt < :expiredBefore")
    List<Trainer> findTrainersWithExpiredGymConfirmation(@Param("expiredBefore") LocalDate expiredBefore);

    // 무료 체험 D-1 알림 대상 (trialEndDate = 내일)
    @Query("SELECT t FROM Trainer t JOIN FETCH t.user WHERE t.trialEndDate = :tomorrow AND t.plan = 'FREE'")
    List<Trainer> findTrialExpiringTomorrow(@Param("tomorrow") LocalDate tomorrow);
}