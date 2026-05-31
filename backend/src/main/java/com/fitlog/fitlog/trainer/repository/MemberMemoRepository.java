package com.fitlog.fitlog.trainer.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.MemberMemo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberMemoRepository extends JpaRepository<MemberMemo, Long> {
    List<MemberMemo> findByMemberOrderByCreatedAtDesc(Member member);
    List<MemberMemo> findByManualMemberOrderByCreatedAtDesc(ManualMember manualMember);
}
