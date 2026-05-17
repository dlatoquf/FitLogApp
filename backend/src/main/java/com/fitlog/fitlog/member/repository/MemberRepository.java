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

    //홈 화면 회원 수 count용
    int countByTrainer(Trainer trainer);

    @Query("""
        SELECT m
        FROM Member m
        JOIN FETCH m.user
        WHERE m.trainer.id = :trainerId
          AND m.status = 'ACTIVE'
        ORDER BY m.id DESC
    """)
    List<Member> findActiveMembersByTrainerIdWithUser(@Param("trainerId") Long trainerId);

    @Query("SELECT m.id FROM Member m WHERE m.trainer.id = :trainerId AND m.status = 'ACTIVE'")
    List<Long> findActiveMemberIdsByTrainerId(@Param("trainerId") Long trainerId);

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
}