package com.fitlog.fitlog.mission.repository;

import com.fitlog.fitlog.mission.entity.Mission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface MissionRepository extends JpaRepository<Mission, Long> {

    // 회원의 현재 미션 (가장 최근 workoutLogId 기준 — 이전 수업 미션 노출 방지)
    @Query("""
        SELECT m FROM Mission m
        LEFT JOIN FETCH m.trainer t
        LEFT JOIN FETCH t.user
        WHERE m.member.id = :memberId
          AND m.status IN :statuses
          AND m.workoutLogId = (
              SELECT MAX(m2.workoutLogId) FROM Mission m2
              WHERE m2.member.id = :memberId
          )
        ORDER BY m.createdAt DESC
    """)
    List<Mission> findRecentByMemberId(@Param("memberId") Long memberId,
                                       @Param("statuses") Collection<Mission.Status> statuses);

    // 트레이너가 특정 회원에게 준 미션
    @Query("""
        SELECT m FROM Mission m
        LEFT JOIN FETCH m.trainer t
        LEFT JOIN FETCH t.user
        WHERE m.trainer.id = :trainerId AND m.member.id = :memberId
        ORDER BY m.createdAt DESC
    """)
    List<Mission> findByTrainerIdAndMemberId(@Param("trainerId") Long trainerId, @Param("memberId") Long memberId);

    // 트레이너가 특정 미연동 회원에게 준 미션
    @Query("""
        SELECT m FROM Mission m
        LEFT JOIN FETCH m.trainer t
        LEFT JOIN FETCH t.user
        WHERE m.trainer.id = :trainerId AND m.manualMember.id = :manualMemberId
        ORDER BY m.createdAt DESC
    """)
    List<Mission> findByTrainerIdAndManualMemberId(@Param("trainerId") Long trainerId,
                                                    @Param("manualMemberId") Long manualMemberId);

    // 특정 운동 로그에 연결된 미션
    List<Mission> findByWorkoutLogId(Long workoutLogId);

    // 회원의 가장 최근 운동 로그 기준 미션 (이전 수업 결과 확인용, trainer+user JOIN FETCH)
    @Query("""
        SELECT m FROM Mission m
        LEFT JOIN FETCH m.trainer t
        LEFT JOIN FETCH t.user
        WHERE m.member.id = :memberId
          AND m.workoutLogId = (
              SELECT MAX(m2.workoutLogId) FROM Mission m2
              WHERE m2.member.id = :memberId
                AND m2.workoutLogId IS NOT NULL
          )
        ORDER BY m.createdAt ASC
    """)
    List<Mission> findLastSessionMissionsByMemberId(@Param("memberId") Long memberId);

    // 회원의 PENDING 상태 미션 전체 (다음 수업 시 실패 처리 대상)
    @Query("SELECT m FROM Mission m WHERE m.member.id = :memberId AND m.status = 'PENDING'")
    List<Mission> findPendingByMemberId(@Param("memberId") Long memberId);

    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM Mission m WHERE m.member.id = :memberId")
    void deleteByMemberId(@Param("memberId") Long memberId);
}
