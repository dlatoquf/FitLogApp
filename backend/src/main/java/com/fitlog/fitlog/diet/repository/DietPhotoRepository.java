package com.fitlog.fitlog.diet.repository;

import com.fitlog.fitlog.diet.entity.DietPhoto;
import com.fitlog.fitlog.member.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public interface DietPhotoRepository extends JpaRepository<DietPhoto, Long> {

    // feedbacks JOIN 제거 — controller가 feedbacks를 사용하지 않으므로 불필요한 JOIN 없이 조회
    List<DietPhoto> findByMemberAndDateOrderBySortOrderAscCreatedAtAsc(Member member, LocalDate date);

    @Query("SELECT p FROM DietPhoto p WHERE p.member.id = :memberId AND p.date = :date ORDER BY p.sortOrder ASC, p.createdAt ASC")
    List<DietPhoto> findByMemberIdAndDate(@Param("memberId") Long memberId, @Param("date") LocalDate date);

    int countByMemberAndDate(Member member, LocalDate date);

    // 특정 날짜의 최근 N분 이내 사진 수 (업로드 세션 감지용)
    int countByMemberAndDateAndCreatedAtAfter(Member member, LocalDate date, LocalDateTime after);
}
