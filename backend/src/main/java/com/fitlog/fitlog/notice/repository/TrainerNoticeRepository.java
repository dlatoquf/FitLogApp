package com.fitlog.fitlog.notice.repository;

import com.fitlog.fitlog.notice.entity.TrainerNotice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Pageable;
import java.util.List;

public interface TrainerNoticeRepository extends JpaRepository<TrainerNotice, Long> {
    List<TrainerNotice> findByMemberIdOrderByCreatedAtDesc(Long memberId);
    List<TrainerNotice> findByManualMemberIdOrderByCreatedAtDesc(Long manualMemberId);
    List<TrainerNotice> findTopByMemberIdOrderByCreatedAtDesc(Long memberId, Pageable pageable);

    @Modifying
    @Query("DELETE FROM TrainerNotice n WHERE n.member.id = :memberId")
    void deleteByMemberId(@Param("memberId") Long memberId);
}
