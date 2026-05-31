package com.fitlog.fitlog.schedule.repository;

import com.fitlog.fitlog.schedule.entity.TrainerScheduleMemo;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TrainerScheduleMemoRepository extends JpaRepository<TrainerScheduleMemo, Long> {
    Optional<TrainerScheduleMemo> findByTrainerAndYearMonth(Trainer trainer, String yearMonth);
}
