package com.fitlog.fitlog.member.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.entity.MemberGoal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemberGoalRepository extends JpaRepository<MemberGoal, Long> {

    // 최신 목표 조회
    Optional<MemberGoal> findTopByMemberOrderByCreatedAtDesc(Member member);
    // 계정 삭제용 - 회원의 전체 목표
    List<MemberGoal> findByMember(Member member);
    void deleteByMember(Member member);
}