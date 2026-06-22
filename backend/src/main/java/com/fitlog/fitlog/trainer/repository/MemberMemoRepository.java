package com.fitlog.fitlog.trainer.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.MemberMemo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface MemberMemoRepository extends JpaRepository<MemberMemo, Long> {
    List<MemberMemo> findByMemberOrderByCreatedAtDesc(Member member);
    List<MemberMemo> findByManualMemberOrderByCreatedAtDesc(ManualMember manualMember);
    java.util.Optional<MemberMemo> findTop1ByMemberOrderByCreatedAtDesc(Member member);
    java.util.Optional<MemberMemo> findTop1ByManualMemberOrderByCreatedAtDesc(ManualMember manualMember);
    void deleteByMember(Member member);

    @Transactional
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM member_memos WHERE manual_member_id = :manualMemberId", nativeQuery = true)
    void deleteByManualMemberId(@Param("manualMemberId") Long manualMemberId);
}
