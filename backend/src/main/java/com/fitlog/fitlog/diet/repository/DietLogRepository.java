package com.fitlog.fitlog.diet.repository;

import com.fitlog.fitlog.diet.entity.DietLog;
import com.fitlog.fitlog.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface DietLogRepository extends JpaRepository<DietLog, Long> {
    // 특정 회원의 특정 날짜 식단 조회
    List<DietLog> findByMemberAndDate(Member member, LocalDate date);
    // 특정 회원의 주간 식단 조회
    List<DietLog> findByMemberAndDateBetween(Member member, LocalDate from, LocalDate to);
    // 특정 회원의 특정 날짜 + 식사 유형 조회
    List<DietLog> findByMemberAndDateAndMealType(Member member, LocalDate date, DietLog.MealType mealType);
    // 계정 삭제용 - 회원의 전체 식단 로그
    List<DietLog> findByMember(Member member);
}