package com.fitlog.fitlog.workout.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.workout.entity.WorkoutLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface WorkoutLogRepository extends JpaRepository<WorkoutLog, Long> {

    // 회원 + 날짜 범위 조회 (운동로그 탭)
    @Query("SELECT w FROM WorkoutLog w LEFT JOIN FETCH w.sets WHERE w.member = :member AND w.logDate BETWEEN :from AND :to ORDER BY w.logDate ASC")
    List<WorkoutLog> findByMemberAndDateBetween(@Param("member") Member member,
                                                @Param("from") LocalDate from,
                                                @Param("to") LocalDate to);

    // 특정 날짜 조회
    List<WorkoutLog> findByMemberAndLogDate(Member member, LocalDate logDate);

    // 트레이너 기준 날짜 범위 조회 (출석률 계산용)
    @Query("SELECT w FROM WorkoutLog w WHERE w.trainer = :trainer AND w.logDate BETWEEN :from AND :to")
    List<WorkoutLog> findByTrainerAndLogDateBetween(@Param("trainer") com.fitlog.fitlog.trainer.entity.Trainer trainer,
                                                    @Param("from") LocalDate from,
                                                    @Param("to") LocalDate to);
}