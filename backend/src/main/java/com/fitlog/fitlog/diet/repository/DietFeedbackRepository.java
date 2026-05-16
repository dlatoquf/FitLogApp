package com.fitlog.fitlog.diet.repository;

import com.fitlog.fitlog.diet.entity.DietFeedback;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface DietFeedbackRepository extends JpaRepository<DietFeedback, Long> {
    List<DietFeedback> findByMemberAndTargetDate(Member member, LocalDate date);
    List<DietFeedback> findByMemberOrderByCreatedAtDesc(Member member);
    List<DietFeedback> findByTrainerAndTargetDate(Trainer trainer, LocalDate date);
    // 계정 삭제용 - 트레이너의 전체 피드백
    List<DietFeedback> findByTrainer(Trainer trainer);
}