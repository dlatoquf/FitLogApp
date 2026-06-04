package com.fitlog.fitlog.notice.repository;

import com.fitlog.fitlog.notice.entity.TrainerNotice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Optional;

public interface TrainerNoticeRepository extends JpaRepository<TrainerNotice, Long> {
    List<TrainerNotice> findByMemberIdOrderByCreatedAtDesc(Long memberId);
    List<TrainerNotice> findByManualMemberIdOrderByCreatedAtDesc(Long manualMemberId);
    // 회원용: 최신 1개
    List<TrainerNotice> findTopByMemberIdOrderByCreatedAtDesc(Long memberId, Pageable pageable);
}
