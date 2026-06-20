package com.fitlog.fitlog.schedule.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    @Query("SELECT s FROM Schedule s WHERE s.trainer = :trainer AND s.date BETWEEN :from AND :to ORDER BY s.date, s.startTime")
    List<Schedule> findByTrainerAndDateBetween(@Param("trainer") Trainer trainer,
                                               @Param("from") LocalDate from,
                                               @Param("to") LocalDate to);

    @Query("SELECT s.id FROM Schedule s WHERE s.trainer = :trainer AND s.date BETWEEN :from AND :to")
    List<Long> findIdsByTrainerAndDateBetween(@Param("trainer") Trainer trainer,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to);

    @Query("SELECT s FROM Schedule s WHERE s.trainer = :trainer AND s.date = :date AND s.status = :status ORDER BY s.startTime")
    List<Schedule> findByTrainerAndDateAndStatus(@Param("trainer") Trainer trainer,
                                                 @Param("date") LocalDate date,
                                                 @Param("status") String status);

    // userId로 바로 스케줄 조회 + member JOIN FETCH (lazy loading 방지)
    @Query("SELECT s FROM Schedule s " +
            "LEFT JOIN FETCH s.member m " +
            "LEFT JOIN FETCH m.user " +
            "WHERE s.trainer.user.id = :userId " +
            "AND s.date BETWEEN :from AND :to " +
            "ORDER BY s.date, s.startTime")
    List<Schedule> findByUserIdAndDateBetween(@Param("userId") Long userId,
                                              @Param("from") LocalDate from,
                                              @Param("to") LocalDate to);

    // 오늘 확정 수업 + member + user 한번에
    @Query("SELECT s FROM Schedule s " +
            "LEFT JOIN FETCH s.member m " +
            "LEFT JOIN FETCH m.user " +
            "WHERE s.trainer = :trainer AND s.date = :date AND s.status = 'CONFIRMED' " +
            "ORDER BY s.startTime")
    List<Schedule> findTodayConfirmedWithMember(@Param("trainer") Trainer trainer,
                                                @Param("date") LocalDate date);

    // 오늘 PT 일정 + 완료 수업 조회 (연동 + 미연동 모두)
    @Query("SELECT s FROM Schedule s " +
            "LEFT JOIN FETCH s.member m " +
            "LEFT JOIN FETCH m.user " +
            "LEFT JOIN FETCH s.manualMember mm " +
            "WHERE s.trainer = :trainer " +
            "AND s.date = :date " +
            "AND s.status IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW') " +
            "ORDER BY s.startTime")
    List<Schedule> findTodayPtWithMember(@Param("trainer") Trainer trainer,
                                         @Param("date") LocalDate date);

    @Query("""
        SELECT s
        FROM Schedule s
        LEFT JOIN FETCH s.member m
        LEFT JOIN FETCH m.user
        LEFT JOIN FETCH s.manualMember mm
        WHERE s.trainer.id = :trainerId
          AND s.date BETWEEN :from AND :to
        ORDER BY s.date, s.startTime
    """)
    List<Schedule> findByTrainerIdAndDateBetweenWithMember(
            @Param("trainerId") Long trainerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    // 슬롯 bulk INSERT (native SQL)
    @Modifying
    @Query(value = """
        INSERT INTO schedule (trainer_id, date, start_time, end_time, status)
        VALUES (:trainerId, :date, :startTime, :endTime, 'OPEN')
    """, nativeQuery = true)
    void insertSlot(
            @Param("trainerId") Long trainerId,
            @Param("date") java.sql.Date date,
            @Param("startTime") java.sql.Time startTime,
            @Param("endTime") java.sql.Time endTime
    );

    // OPEN 슬롯 벌크 삭제
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
    DELETE FROM Schedule s
    WHERE s.trainer = :trainer
      AND s.date BETWEEN :from AND :to
      AND s.status = 'OPEN'
""")
    int deleteOpenSlotsByTrainerAndDateBetween(
            @Param("trainer") Trainer trainer,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    // 다음 주 전체 슬롯 삭제 (OPEN/CONFIRMED/REQUESTED 모두)
    @Modifying
    @Query("DELETE FROM Schedule s WHERE s.trainer = :trainer AND s.date BETWEEN :from AND :to")
    int deleteAllSlotsByTrainerAndDateBetween(
            @Param("trainer") Trainer trainer,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    // requests에 없는 OPEN 슬롯만 벌크 삭제
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
    DELETE FROM Schedule s
    WHERE s.trainer = :trainer
      AND s.date BETWEEN :from AND :to
      AND s.status = 'OPEN'
      AND s.id NOT IN :excludeIds
""")
    int deleteOpenSlotsNotInRequests(
            @Param("trainer") Trainer trainer,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("excludeIds") List<Long> excludeIds
    );

    // PT 30분 전 알림용
    @Query("""
    SELECT s FROM Schedule s
    LEFT JOIN FETCH s.member m
    LEFT JOIN FETCH m.user
    WHERE s.date = :date
      AND s.startTime BETWEEN :from AND :to
      AND s.status = 'CONFIRMED'
""")
    List<Schedule> findConfirmedSchedulesStartingBetween(
            @Param("date") LocalDate date,
            @Param("from") LocalTime from,
            @Param("to") LocalTime to
    );


    // 다음 주 OPEN 슬롯 가진 트레이너 목록
    @Query("""
    SELECT DISTINCT s.trainer FROM Schedule s
    LEFT JOIN FETCH s.trainer.members m
    LEFT JOIN FETCH m.user
    WHERE s.date BETWEEN :from AND :to
      AND s.status = 'OPEN'
""")
    List<Trainer> findTrainersWithOpenSlotsInRange(
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    // 다음 주 이미 신청/확정한 회원 ID
    @Query("""
    SELECT DISTINCT sr.member.id
    FROM ScheduleRequest sr
    WHERE sr.schedule.trainer = :trainer
      AND sr.schedule.date BETWEEN :from AND :to
      AND sr.status IN ('PENDING', 'CONFIRMED')
""")
    Set<Long> findBookedMemberIdsByTrainerAndDateBetween(
            @Param("trainer") Trainer trainer,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );

    // 이번 달 수업 수 (CONFIRMED + COMPLETED)
    @Query("SELECT COUNT(s) FROM Schedule s WHERE s.trainer = :trainer AND s.date BETWEEN :from AND :to AND s.status IN ('CONFIRMED', 'COMPLETED')")
    int countMonthSessions(@Param("trainer") Trainer trainer,
                           @Param("from") java.time.LocalDate from,
                           @Param("to") java.time.LocalDate to);

    // 이번 달 노쇼 수 (명시적 NO_SHOW 상태 기준)
    @Query("""
        SELECT COUNT(s) FROM Schedule s
        WHERE s.trainer = :trainer
        AND s.date >= :monthStart
        AND s.date <= :monthEnd
        AND s.status = 'NO_SHOW'
    """)
    int countNoShows(@Param("trainer") Trainer trainer,
                     @Param("monthStart") java.time.LocalDate monthStart,
                     @Param("monthEnd") java.time.LocalDate monthEnd);

    // 계정 삭제용 - 트레이너의 전체 스케줄
    List<Schedule> findByTrainer(Trainer trainer);

    // 계정 삭제용 - 과거 스케줄 슬롯에서 회원 참조 해제 + 상태 OPEN 리셋
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Schedule s SET s.member = null, s.status = 'OPEN' WHERE s.member = :member AND s.date < :today")
    void detachMemberFromPastSchedules(@Param("member") Member member, @Param("today") java.time.LocalDate today);

    // 계정 삭제용 - 미래 스케줄 조회 (요청 삭제 후 슬롯 삭제용)
    @Query("SELECT s FROM Schedule s WHERE s.member = :member AND s.date >= :today")
    List<Schedule> findFutureSchedulesByMember(@Param("member") Member member, @Param("today") java.time.LocalDate today);

    // 연동 시 이전 - 미연동 회원 일정 → 연동 회원으로 일괄 이전
    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Schedule s SET s.member = :member, s.manualMember = null WHERE s.manualMember = :manualMember")
    void transferManualMemberSchedules(@Param("manualMember") ManualMember manualMember,
                                       @Param("member") Member member);

    // 자동 오픈 cron 용 - 다음 주 OPEN 슬롯 존재 여부 확인
    @Query("SELECT COUNT(s) > 0 FROM Schedule s WHERE s.trainer = :trainer AND s.date BETWEEN :from AND :to AND s.status = 'OPEN'")
    boolean existsOpenSlotsByTrainerAndDateBetween(@Param("trainer") Trainer trainer,
                                                   @Param("from") LocalDate from,
                                                   @Param("to") LocalDate to);

    // OT 회원의 누적 OT 수업 횟수 (확정/완료 포함 전체)
    @Query("SELECT COUNT(s) FROM Schedule s WHERE s.manualMember = :manualMember AND s.sessionType = 'OT'")
    int countOtSessionsByManualMember(@Param("manualMember") ManualMember manualMember);

    // 특정 OT 세션보다 앞선 OT 횟수 (날짜+시간 기준) → +1 하면 현재 세션의 회차
    @Query("SELECT COUNT(s) FROM Schedule s WHERE s.manualMember = :manualMember AND s.sessionType = 'OT' AND (s.date < :date OR (s.date = :date AND s.startTime < :startTime))")
    int countOtSessionsBefore(@Param("manualMember") ManualMember manualMember,
                              @Param("date") java.time.LocalDate date,
                              @Param("startTime") java.time.LocalTime startTime);

    // 특정 날짜에 CONFIRMED 상태인 수업이 있는 트레이너 목록
    @Query("SELECT DISTINCT s.trainer FROM Schedule s WHERE s.date = :date AND s.status = 'CONFIRMED'")
    List<Trainer> findTrainersWithConfirmedScheduleOn(@Param("date") java.time.LocalDate date);

    // 특정 트레이너의 특정 날짜 CONFIRMED 수업 수
    @Query("SELECT COUNT(s) FROM Schedule s WHERE s.trainer = :trainer AND s.date = :date AND s.status = 'CONFIRMED'")
    long countConfirmedByTrainerAndDate(@Param("trainer") Trainer trainer, @Param("date") java.time.LocalDate date);
}