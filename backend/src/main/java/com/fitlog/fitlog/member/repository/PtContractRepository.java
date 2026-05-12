package com.fitlog.fitlog.member.repository;

import com.fitlog.fitlog.member.entity.PtContract;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PtContractRepository extends JpaRepository<PtContract, Long> {

    @Query("SELECT p FROM PtContract p WHERE p.member.id = :memberId ORDER BY p.createdAt DESC")
    List<PtContract> findByMemberId(@Param("memberId") Long memberId);
}