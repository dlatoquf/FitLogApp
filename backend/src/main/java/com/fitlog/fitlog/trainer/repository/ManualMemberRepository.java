package com.fitlog.fitlog.trainer.repository;

import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ManualMemberRepository extends JpaRepository<ManualMember, Long> {
    List<ManualMember> findByTrainerOrderByPtRemainingAsc(Trainer trainer);
    List<ManualMember> findByTrainer(Trainer trainer);

    // OT 회원 제외한 미연동 회원 목록 (회원관리 탭용)
    @Query("SELECT m FROM ManualMember m WHERE m.trainer = :trainer " +
           "AND (m.memo IS NULL OR m.memo <> 'OT') ORDER BY m.ptRemaining ASC")
    List<ManualMember> findNonOtByTrainer(@Param("trainer") Trainer trainer);

    // OT 회원 제외한 미연동 회원 수 (총 회원 수 계산용)
    @Query("SELECT COUNT(m) FROM ManualMember m WHERE m.trainer = :trainer " +
           "AND (m.memo IS NULL OR m.memo <> 'OT')")
    long countNonOtByTrainer(@Param("trainer") Trainer trainer);

    // 전체 미연동 회원 수 (OT 포함)
    long countByTrainer(Trainer trainer);

    // amount가 있는 회원 (결제 기록 있는 미연동 회원 매출 계산용)
    java.util.List<ManualMember> findByTrainerAndAmountIsNotNull(Trainer trainer);

    // OT 회원 중 전화번호 일치 — 결제 추가 시 OT→PT 전환 매칭 (전화번호 우선)
    java.util.Optional<ManualMember> findByTrainerAndMemoAndPhone(Trainer trainer, String memo, String phone);

    // OT 회원 중 이름 일치 — 전화번호 없을 때 폴백
    java.util.Optional<ManualMember> findByTrainerAndMemoAndName(Trainer trainer, String memo, String name);

    // PT 종료 후 37일(유예 7 + 비활성 30) 경과 → 자동 삭제 대상
    @Query("SELECT m FROM ManualMember m WHERE m.ptEndedAt IS NOT NULL AND m.ptEndedAt <= :cutoff")
    java.util.List<ManualMember> findPtEndedForCleanup(@Param("cutoff") java.time.LocalDate cutoff);
}
