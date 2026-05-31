package com.fitlog.fitlog.workout.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.ManualMember;
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

    // 계정 삭제용 - 회원의 전체 운동 로그
    List<WorkoutLog> findByMember(Member member);

    // 계정 삭제용 - 트레이너 참조 해제 (회원 운동 기록 유지)
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE WorkoutLog w SET w.trainer = null WHERE w.trainer = :trainer")
    void detachTrainerFromWorkoutLogs(@Param("trainer") com.fitlog.fitlog.trainer.entity.Trainer trainer);

    // 미연동 회원 운동 로그 조회
    @Query("SELECT w FROM WorkoutLog w LEFT JOIN FETCH w.sets WHERE w.manualMember = :mm AND w.logDate BETWEEN :from AND :to ORDER BY w.logDate ASC")
    List<WorkoutLog> findByManualMemberAndDateBetween(@Param("mm") ManualMember mm,
                                                      @Param("from") LocalDate from,
                                                      @Param("to") LocalDate to);

    // OT→PT 전환 시 세션 수 카운트
    long countByManualMember(ManualMember mm);

    // 연동 시 이전: manualMember → member 로 일괄 업데이트
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE WorkoutLog w SET w.member = :member, w.manualMember = null WHERE w.manualMember = :mm")
    void transferManualMemberLogs(@Param("mm") ManualMember mm, @Param("member") Member member);
}