package com.fitlog.fitlog.repository;

import com.fitlog.fitlog.entity.Schedule;
import com.fitlog.fitlog.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    // 트레이너의 특정 기간 슬롯 조회
    List<Schedule> findByTrainerAndDateBetween(Trainer trainer, LocalDate from, LocalDate to);
    // 트레이너의 특정 날짜 슬롯 조회
    List<Schedule> findByTrainerAndDate(Trainer trainer, LocalDate date);
}
