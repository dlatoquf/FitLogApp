package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
public class PtExpiredScheduler {

    private final MemberRepository memberRepository;
    private final ManualMemberRepository manualMemberRepository;

    public PtExpiredScheduler(MemberRepository memberRepository,
                              ManualMemberRepository manualMemberRepository) {
        this.memberRepository = memberRepository;
        this.manualMemberRepository = manualMemberRepository;
    }

    // 매일 새벽 3시 30분 — PT 만료 후 7일 지난 연동 회원 비활성화 처리
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional
    public void inactivatePtExpiredMembers() {
        LocalDate cutoff = LocalDate.now().minusDays(7);
        List<Member> targets = memberRepository.findPtExpiredMembersToInactivate(cutoff);

        for (Member member : targets) {
            member.setStatus(Member.Status.INACTIVE);
            member.setDisconnectedAt(LocalDate.now());
            memberRepository.save(member);
            System.out.println("PT 만료 비활성화(연동): 회원ID=" + member.getId()
                    + ", PT종료일=" + member.getPtEndedAt());
        }

        if (!targets.isEmpty()) {
            System.out.println("연동 PT 만료 비활성화 완료: " + targets.size() + "명");
        }

        // 미연동 회원 — PT 만료 7일 후 isActive=false
        List<ManualMember> manualTargets = manualMemberRepository.findPtEndedToInactivate(cutoff);
        for (ManualMember m : manualTargets) {
            m.setActive(false);
            manualMemberRepository.save(m);
            System.out.println("PT 만료 비활성화(미연동): manualMemberId=" + m.getId()
                    + ", PT종료일=" + m.getPtEndedAt());
        }

        if (!manualTargets.isEmpty()) {
            System.out.println("미연동 PT 만료 비활성화 완료: " + manualTargets.size() + "명");
        }
    }
}
