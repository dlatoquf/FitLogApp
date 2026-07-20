package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
public class InactiveMemberCleanupScheduler {

    private final MemberRepository memberRepository;

    public InactiveMemberCleanupScheduler(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    // 매일 새벽 4시 — 비활성화(INACTIVE) 후 90일 경과 회원 데이터 정리
    @Scheduled(cron = "0 0 4 * * *")
    @Transactional
    public void cleanupInactiveMembers() {
        LocalDate cutoff = LocalDate.now().minusDays(90);

        // 1. 비활성화 90일 경과 → 트레이너 연결만 해제 (데이터 보존)
        List<Member> inactiveExpired = memberRepository.findInactiveMembersToCleanup(cutoff);
        for (Member member : inactiveExpired) {
            member.setTrainer(null);
            member.setDisconnectedAt(null);
            member.setStatus(Member.Status.ACTIVE);
            member.setPtRemaining(0);
            member.setPtTotal(0);
            member.setPtEndedAt(null);
            memberRepository.save(member);
            System.out.println("비활성화 90일 경과 트레이너 연결 해제: 회원ID=" + member.getId());
        }

        // 2. 트레이너 이동 회원 90일 경과 → 이전 트레이너 참조 해제
        List<Member> movedExpired = memberRepository.findMovedMembersToCleanup(cutoff);
        for (Member member : movedExpired) {
            member.setPreviousTrainerId(null);
            member.setDisconnectedAt(null);
            memberRepository.save(member);
            System.out.println("이동 90일 경과 정리: 회원ID=" + member.getId());
        }

        int total = inactiveExpired.size() + movedExpired.size();
        if (total > 0) {
            System.out.println("90일 경과 정리 완료: " + total + "명");
        }
    }
}
