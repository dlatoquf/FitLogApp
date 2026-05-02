package com.fitlog.fitlog.repository;

import com.fitlog.fitlog.entity.Member;
import com.fitlog.fitlog.entity.Trainer;
import com.fitlog.fitlog.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {
    Optional<Member> findByUser(User user);
    List<Member> findAllByTrainer(Trainer trainer);
}