package com.fitlog.fitlog.repository;

import com.fitlog.fitlog.entity.Member;
import com.fitlog.fitlog.entity.Schedule;
import com.fitlog.fitlog.dto.ScheduleRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ScheduleRequestRepository extends JpaRepository<ScheduleRequest, Long> {
    List<ScheduleRequest> findBySchedule(Schedule schedule);
    List<ScheduleRequest> findByMember(Member member);
    Optional<ScheduleRequest> findByScheduleAndMember(Schedule schedule, Member member);
    boolean existsByScheduleAndMember(Schedule schedule, Member member);
}