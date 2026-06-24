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

    // 전체공지 전체 목록 (최신순)
    @Query("SELECT n FROM TrainerNotice n WHERE n.trainer.id = :trainerId AND n.broadcast = true ORDER BY n.createdAt DESC")
    List<TrainerNotice> findByTrainerIdAndBroadcastTrueOrderByCreatedAtDesc(@Param("trainerId") Long trainerId);

    // broadcastGroupId로 전체 삭제
    @Modifying
    @Query("DELETE FROM TrainerNotice n WHERE n.broadcastGroupId = :groupId")
    void deleteByBroadcastGroupId(@Param("groupId") Long groupId);

    // broadcastGroupId로 전체 수정
    @Modifying
    @Query("UPDATE TrainerNotice n SET n.content = :content WHERE n.broadcastGroupId = :groupId")
    void updateContentByBroadcastGroupId(@Param("groupId") Long groupId, @Param("content") String content);

    // broadcastGroupId의 대표 1건 조회
    List<TrainerNotice> findByBroadcastGroupIdOrderByCreatedAtDesc(Long broadcastGroupId);
}
