package com.fitlog.fitlog.member.repository;

import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

public interface PtContractRepository extends JpaRepository<PtContract, Long> {

    @Query("SELECT p FROM PtContract p WHERE p.member.id = :memberId ORDER BY p.createdAt DESC")
    List<PtContract> findByMemberId(@Param("memberId") Long memberId);

    // 이번달 매출 — created_at 기준 (기존 방식, 현재 월 기본 조회용)
    @Query("SELECT p FROM PtContract p JOIN FETCH p.member m JOIN FETCH m.user WHERE p.trainer = :trainer AND p.createdAt BETWEEN :from AND :to ORDER BY p.createdAt DESC")
    List<PtContract> findByTrainerAndCreatedAtBetween(@Param("trainer") Trainer trainer,
                                                       @Param("from") LocalDateTime from,
                                                       @Param("to") LocalDateTime to);

    // 전체 계약 목록 (trainer) — 월별 필터링은 Java에서 처리 (payment_date 또는 created_at 기준)
    @Query("SELECT p FROM PtContract p JOIN FETCH p.member m JOIN FETCH m.user WHERE p.trainer = :trainer ORDER BY p.createdAt DESC")
    List<PtContract> findAllByTrainerWithMember(@Param("trainer") Trainer trainer);

    // 연동+미연동 전체 계약 조회 (revenue 통합 계산용)
    @Query("SELECT p FROM PtContract p LEFT JOIN FETCH p.member m LEFT JOIN FETCH m.user LEFT JOIN FETCH p.manualMember mm WHERE p.trainer = :trainer ORDER BY p.createdAt DESC")
    List<PtContract> findAllByTrainerWithAll(@Param("trainer") Trainer trainer);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PtContract p SET p.trainer = null WHERE p.trainer = :trainer")
    void detachTrainerFromContracts(@Param("trainer") Trainer trainer);

    // 미연동 회원 계약 조회 (연동 시 이전용)
    List<PtContract> findByManualMember(ManualMember manualMember);
}
