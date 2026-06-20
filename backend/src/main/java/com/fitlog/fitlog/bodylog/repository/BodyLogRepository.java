package com.fitlog.fitlog.bodylog.repository;

import com.fitlog.fitlog.bodylog.entity.BodyLog;
import com.fitlog.fitlog.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BodyLogRepository extends JpaRepository<BodyLog, Long> {
    List<BodyLog> findByMemberOrderByLogDateAsc(Member member);
    void deleteByMember(Member member);
}