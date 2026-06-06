package com.fitlog.fitlog.member.repository;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    // user + trainer + trainer.user 한 번에 fetch
    @Query("SELECT m FROM Member m JOIN FETCH m.user LEFT JOIN FETCH m.trainer t LEFT JOIN FETCH t.user WHERE m.user = :user")
    Optional<Member> findByUser(@Param("user") User user);

    // 트레이너 회원 목록 - user까지 한 번에 (N+1 완전 제거)
    @Query("SELECT m FROM Member m JOIN FETCH m.user WHERE m.trainer = :trainer")
    List<Member> findAllByTrainer(@Param("trainer") Trainer trainer);

    // userId로 바로 조회
    @Query("SELECT m FROM Member m JOIN FETCH m.user LEFT JOIN FETCH m.trainer t LEFT JOIN FETCH t.user WHERE m.user.id = :userId")
    Optional<Member> findByUserId(@Param("userId") Long userId);

    // id로 조회 시 user까지 JOIN FETCH (LazyInitializationException 방지)
    @Query("SELECT m FROM Member m JOIN FETCH m.user WHERE m.id = :id")
    Optional<Member> findByIdWithUser(@Param("id") Long id);

    // 수업 신청용 - trainer 불필요하므로 가벼운 쿼리
    @Query("SELECT m FROM Member m WHERE m.user.id = :userId")
    Optional<Member> findLightByUserId(@Param("userId") Long userId);

    //홈 화면 회원 수 count용 (ACTIVE만)
    @Query("SELECT COUNT(m) FROM Member m WHERE m.trainer = :trainer AND m.status = 'ACTIVE' AND m.user.deletedAt IS NULL")
    int countByTrainer(@Param("trainer") Trainer trainer);

    @Query("""
        SELECT m
        FROM Member m
        JOIN FETCH m.user
        WHERE m.trainer.id = :trainerId
          AND m.status = 'ACTIVE'
          AND m.user.deletedAt IS NULL
        ORDER BY m.id DESC
    """)
    List<Member> findActiveMembersByTrainerIdWithUser(@Param("trainerId") Long trainerId);

    // 비활성(연결해제) + 이동된 회원 포함 전체 목록
    // 우선순위: ACTIVE(현재) → INACTIVE(해제중) → 이동된 회원(previousTrainerId 일치)
    @Query("""
        SELECT m
        FROM Member m
        JOIN FETCH m.user
        WHERE (
            m.trainer.id = :trainerId
            OR m.previousTrainerId = :trainerId
        )
        ORDER BY
            CASE
                WHEN m.trainer.id = :trainerId AND m.status = 'ACTIVE'    THEN 0
                WHEN m.trainer.id = :trainerId AND m.status = 'INACTIVE'  THEN 1
                ELSE 2
            END,
            m.id DESC
    """)
    List<Member> findAllMembersByTrainerIdWithUser(@Param("trainerId") Long trainerId);

    @Query("SELECT m.id FROM Member m WHERE m.trainer.id = :trainerId AND m.status = 'ACTIVE' AND m.user.deletedAt IS NULL")
    List<Long> findActiveMemberIdsByTrainerId(@Param("trainerId") Long trainerId);

    // 소프트 딜리트되어 7일 이내인 회원 목록 (복구 가능)
    @Query("""
        SELECT m FROM Member m JOIN FETCH m.user
        WHERE m.trainer.id = :trainerId
          AND m.user.deletedAt IS NOT NULL
          AND m.user.deletedAt >= :since
        ORDER BY m.user.deletedAt DESC
    """)
    List<Member> findSoftDeletedMembersByTrainerId(
        @Param("trainerId") Long trainerId,
        @Param("since") java.time.LocalDateTime since
    );

    @Query("""
        SELECT m
        FROM Member m
        JOIN FETCH m.user
        WHERE m.id = :memberId
          AND m.trainer.id = :trainerId
    """)
        Optional<Member> findByIdAndTrainerIdWithUser(
                @Param("memberId") Long memberId,
                @Param("trainerId") Long trainerId
        );

    @Query("""
        SELECT m
        FROM Member m
        WHERE m.id = :memberId
          AND m.trainer.id = :trainerId
    """)
        Optional<Member> findByIdAndTrainerId(
                @Param("memberId") Long memberId,
                @Param("trainerId") Long trainerId
        );

    // INACTIVE 30일 경과 — 트레이너 목록에서 제거 대상 (trainer 참조 해제)
    @Query("""
        SELECT m FROM Member m JOIN FETCH m.user
        WHERE m.status = 'INACTIVE'
          AND m.disconnectedAt IS NOT NULL
          AND m.disconnectedAt <= :cutoff
          AND m.trainer IS NOT NULL
          AND m.user.deletedAt IS NULL
    """)
    List<Member> findInactiveMembersToCleanup(@Param("cutoff") java.time.LocalDate cutoff);

    // 이동된 회원(previousTrainerId) 30일 경과 — 이전 트레이너 목록에서 제거
    @Query("""
        SELECT m FROM Member m JOIN FETCH m.user
        WHERE m.previousTrainerId IS NOT NULL
          AND m.disconnectedAt IS NOT NULL
          AND m.disconnectedAt <= :cutoff
          AND m.user.deletedAt IS NULL
    """)
    List<Member> findMovedMembersToCleanup(@Param("cutoff") java.time.LocalDate cutoff);

    // PT 만료 후 7일이 지난 ACTIVE 회원 — 스케줄러에서 INACTIVE 전환 대상
    @Query("""
        SELECT m FROM Member m
        JOIN FETCH m.user
        WHERE m.ptEndedAt IS NOT NULL
          AND m.ptEndedAt <= :cutoff
          AND m.status = 'ACTIVE'
          AND m.user.deletedAt IS NULL
    """)
    List<Member> findPtExpiredMembersToInactivate(@Param("cutoff") java.time.LocalDate cutoff);

    // 생일 알림용 — 생년월일이 있는 활성 회원 전체 (트레이너 포함 fetch)
    @Query("""
        SELECT m FROM Member m
        JOIN FETCH m.user
        JOIN FETCH m.trainer t
        JOIN FETCH t.user
        WHERE m.birthDate IS NOT NULL
          AND m.status = 'ACTIVE'
          AND m.user.deletedAt IS NULL
    """)
    List<Member> findAllWithBirthDate();
}