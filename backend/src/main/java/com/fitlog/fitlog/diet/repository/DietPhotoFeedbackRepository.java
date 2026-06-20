package com.fitlog.fitlog.diet.repository;

import com.fitlog.fitlog.diet.entity.DietPhotoFeedback;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DietPhotoFeedbackRepository extends JpaRepository<DietPhotoFeedback, Long> {

    @Modifying
    @Query("DELETE FROM DietPhotoFeedback f WHERE f.trainer.id = :trainerId")
    void deleteByTrainerId(@Param("trainerId") Long trainerId);

    @Modifying
    @Query("DELETE FROM DietPhotoFeedback f WHERE f.dietPhoto.member.id = :memberId")
    void deleteByMemberId(@Param("memberId") Long memberId);
}
