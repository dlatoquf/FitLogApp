package com.fitlog.fitlog.repository;

import com.fitlog.fitlog.entity.DietFeedback;
import com.fitlog.fitlog.entity.Member;
import com.fitlog.fitlog.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface DietFeedbackRepository extends JpaRepository<DietFeedback, Long> {
    List<DietFeedback> findByMemberAndTargetDate(Member member, LocalDate date);
    List<DietFeedback> findByMemberOrderByCreatedAtDesc(Member member);
    List<DietFeedback> findByTrainerAndTargetDate(Trainer trainer, LocalDate date);
 }