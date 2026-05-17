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

    // 스케줄 ID 목록으로 벌크 삭제
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("DELETE FROM ScheduleRequest sr WHERE sr.schedule.id IN :scheduleIds")
    int deleteByScheduleIds(@Param("scheduleIds") List<Long> scheduleIds);

    // 스케줄 삭제 전 schedule_id를 null로 업데이트
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ScheduleRequest sr SET sr.schedule = null WHERE sr.schedule.id IN :scheduleIds")
    int detachScheduleIds(@Param("scheduleIds") List<Long> scheduleIds);

    // 특정 schedule_id 목록에 연결된 requests 조회
    @Query("SELECT sr.schedule.id FROM ScheduleRequest sr WHERE sr.schedule.id IN :scheduleIds")
    List<Long> findScheduleIdsByScheduleIds(@Param("scheduleIds") List<Long> scheduleIds);

    @Query("""
        SELECT sr
        FROM ScheduleRequest sr
        JOIN FETCH sr.member m
        JOIN FETCH m.user
        WHERE sr.schedule.id IN :scheduleIds
    """)
        List<ScheduleRequest> findByScheduleIds(
                @Param("scheduleIds") List<Long> scheduleIds
    );
}