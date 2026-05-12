package com.fitlog.fitlog.schedule.repository;

import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    @Query("SELECT s FROM Schedule s WHERE s.trainer = :trainer AND s.date BETWEEN :from AND :to ORDER BY s.date, s.startTime")
    List<Schedule> findByTrainerAndDateBetween(@Param("trainer") Trainer trainer,
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

    // 오늘 PT 일정 + 완료 수업 조회
    @Query("SELECT s FROM Schedule s " +
            "LEFT JOIN FETCH s.member m " +
            "LEFT JOIN FETCH m.user " +
            "WHERE s.trainer = :trainer " +
            "AND s.date = :date " +
            "AND s.status IN ('CONFIRMED', 'COMPLETED') " +
            "ORDER BY s.startTime")
    List<Schedule> findTodayPtWithMember(@Param("trainer") Trainer trainer,
                                         @Param("date") LocalDate date);

    @Query("""
        SELECT s
        FROM Schedule s
        LEFT JOIN FETCH s.member m
        LEFT JOIN FETCH m.user
        WHERE s.trainer.id = :trainerId
          AND s.date BETWEEN :from AND :to
        ORDER BY s.date, s.startTime
    """)
    List<Schedule> findByTrainerIdAndDateBetweenWithMember(
            @Param("trainerId") Long trainerId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );
}
