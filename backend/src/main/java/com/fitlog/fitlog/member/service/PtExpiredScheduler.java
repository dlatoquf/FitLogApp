package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
public class PtExpiredScheduler {

    private final MemberRepository memberRepository;

    public PtExpiredScheduler(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    // 매일 새벽 3시 30분 — PT 만료 후 7일 지난 회원 비활성화 처리
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void inactivatePtExpiredMembers() {
        LocalDate cutoff = LocalDate.now().minusDays(7); // 7일 전 이전에 PT 종료일이 찍힌 회원
        List<Member> targets = memberRepository.findPtExpiredMembersToInactivate(cutoff);

        for (Member member : targets) {
            member.setStatus(Member.Status.INACTIVE);
            member.setDisconnectedAt(LocalDate.now());
            memberRepository.save(member);
            System.out.println("PT 만료 비활성화 처리: 회원ID=" + member.getId()
                    + ", PT종료일=" + member.getPtEndedAt());
        }

        if (!targets.isEmpty()) {
            System.out.println("PT 만료 비활성화 완료: " + targets.size() + "명");
        }
    }
}
