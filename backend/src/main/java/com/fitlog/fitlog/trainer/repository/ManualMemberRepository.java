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

    // PT 등록된 미연동 회원 목록 (회원관리 탭용) — ptTotal IS NOT NULL 기준
    @Query("SELECT m FROM ManualMember m WHERE m.trainer = :trainer " +
           "AND m.ptTotal IS NOT NULL ORDER BY m.ptRemaining ASC")
    List<ManualMember> findNonOtByTrainer(@Param("trainer") Trainer trainer);

    // PT 등록된 활성 미연동 회원 수 (총 회원 수 계산용 — 비활성·PT종료 7일 경과 제외)
    @Query("SELECT COUNT(m) FROM ManualMember m WHERE m.trainer = :trainer " +
           "AND m.ptTotal IS NOT NULL AND m.active = true " +
           "AND NOT (m.ptRemaining = 0 AND m.ptEndedAt IS NOT NULL AND m.ptEndedAt <= :cutoff)")
    long countNonOtByTrainer(@Param("trainer") Trainer trainer, @Param("cutoff") java.time.LocalDate cutoff);

    // OT 회원 수
    @Query("SELECT COUNT(m) FROM ManualMember m WHERE m.trainer = :trainer AND m.memo = 'OT' AND m.active = true AND m.ptEndedAt IS NULL")
    long countOtByTrainer(@Param("trainer") Trainer trainer);

    // 전체 미연동 회원 수 (OT 포함)
    long countByTrainer(Trainer trainer);

    // amount가 있는 회원 (결제 기록 있는 미연동 회원 매출 계산용)
    java.util.List<ManualMember> findByTrainerAndAmountIsNotNull(Trainer trainer);

    // OT 회원 중 전화번호 일치 — 결제 추가 시 OT→PT 전환 매칭 (전화번호 우선)
    java.util.Optional<ManualMember> findByTrainerAndMemoAndPhone(Trainer trainer, String memo, String phone);

    // OT 회원 중 이름 일치 — 전화번호 없을 때 폴백
    java.util.Optional<ManualMember> findByTrainerAndMemoAndName(Trainer trainer, String memo, String name);

    // PT 종료 7일 경과 AND 아직 활성 → isActive=false 처리 대상
    @Query("SELECT m FROM ManualMember m WHERE m.ptEndedAt IS NOT NULL AND m.ptEndedAt <= :cutoff AND m.active = true")
    java.util.List<ManualMember> findPtEndedToInactivate(@Param("cutoff") java.time.LocalDate cutoff);

    // PT 종료 후 90일 경과 AND isActive=false → 자동 삭제 대상
    @Query("SELECT m FROM ManualMember m WHERE m.ptEndedAt IS NOT NULL AND m.ptEndedAt <= :cutoff AND m.active = false")
    java.util.List<ManualMember> findPtEndedForCleanup(@Param("cutoff") java.time.LocalDate cutoff);
}
