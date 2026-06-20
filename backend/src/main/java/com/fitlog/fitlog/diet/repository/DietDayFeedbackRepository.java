package com.fitlog.fitlog.diet.repository;

import com.fitlog.fitlog.diet.entity.DietDayFeedback;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface DietDayFeedbackRepository extends JpaRepository<DietDayFeedback, Long> {

    // 회원+날짜로 하루 피드백 조회
    Optional<DietDayFeedback> findByMemberAndDate(Member member, LocalDate date);

    // 회원의 가장 최근 피드백 (홈 화면 미리보기용)
    Optional<DietDayFeedback> findTopByMemberOrderByDateDesc(Member member);

    // 트레이너 탈퇴 시 피드백 삭제
    @Modifying
    @Query("DELETE FROM DietDayFeedback f WHERE f.trainer.id = :trainerId")
    void deleteByTrainerId(@Param("trainerId") Long trainerId);

    void deleteByMember(Member member);
}
