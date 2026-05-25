package com.fitlog.fitlog.member.repository;

import com.fitlog.fitlog.member.entity.PtContract;
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

    // 트레이너의 특정 기간 계약 내역 (매출 계산용)
    @Query("SELECT p FROM PtContract p WHERE p.trainer = :trainer AND p.createdAt BETWEEN :from AND :to ORDER BY p.createdAt DESC")
    List<PtContract> findByTrainerAndCreatedAtBetween(@Param("trainer") Trainer trainer,
                                                       @Param("from") LocalDateTime from,
                                                       @Param("to") LocalDateTime to);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE PtContract p SET p.trainer = null WHERE p.trainer = :trainer")
    void detachTrainerFromContracts(@Param("trainer") Trainer trainer);
}