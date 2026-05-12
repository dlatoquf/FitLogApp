package com.fitlog.fitlog.schedule.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ScheduleRequestRepository extends JpaRepository<ScheduleRequest, Long> {

    @Query("SELECT sr FROM ScheduleRequest sr JOIN FETCH sr.member m JOIN FETCH m.user WHERE sr.schedule = :schedule")
    List<ScheduleRequest> findBySchedule(@Param("schedule") Schedule schedule);

    @Query("SELECT sr FROM ScheduleRequest sr WHERE sr.schedule = :schedule AND sr.member = :member")
    Optional<ScheduleRequest> findByScheduleAndMember(@Param("schedule") Schedule schedule,
                                                      @Param("member") Member member);

    @Query("SELECT CASE WHEN COUNT(sr) > 0 THEN true ELSE false END FROM ScheduleRequest sr WHERE sr.schedule = :schedule AND sr.member = :member")
    boolean existsByScheduleAndMember(@Param("schedule") Schedule schedule,
                                      @Param("member") Member member);

    @Query("SELECT sr FROM ScheduleRequest sr LEFT JOIN FETCH sr.schedule s WHERE sr.member = :member")
    List<ScheduleRequest> findByMember(@Param("member") Member member);

    //오늘 확정 PT 목록 한번에 조회 (member + user JOIN FETCH)
    @Query("SELECT sr FROM ScheduleRequest sr " +
            "JOIN FETCH sr.member m " +
            "JOIN FETCH m.user " +
            "JOIN FETCH sr.schedule " +
            "WHERE sr.schedule.id IN :scheduleIds " +
            "AND sr.status = :status")
    List<ScheduleRequest> findByScheduleIdInAndStatus(
            @Param("scheduleIds") List<Long> scheduleIds,
            @Param("status") String status);

    @Query("""
        SELECT sr
        FROM ScheduleRequest sr
        JOIN FETCH sr.member m
        JOIN FETCH m.user
        WHERE sr.schedule.id IN :scheduleIds
          AND sr.status = :status
    """)
    List<ScheduleRequest> findPendingRequests(
            @Param("scheduleIds") List<Long> scheduleIds,
            @Param("status") ScheduleRequest.Status status
    );

    @Query("""
        SELECT sr
        FROM ScheduleRequest sr
        JOIN FETCH sr.schedule s
        WHERE sr.member.id = :memberId
          AND sr.status = :status
          AND s.date BETWEEN :from AND :to
        ORDER BY s.date, s.startTime
    """)
        List<ScheduleRequest> findThisWeekConfirmedByMemberId(
                @Param("memberId") Long memberId,
                @Param("status") ScheduleRequest.Status status,
                @Param("from") LocalDate from,
                @Param("to") LocalDate to
        );
}