package com.fitlog.fitlog.trainer.service;

import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

/**
 * 미연동 회원 중 PT 종료 후 90일(유예 7일 + 비활성 83일) 경과 시 자동 삭제
 */
@Component
public class ManualMemberCleanupScheduler {

    private final ManualMemberRepository manualMemberRepository;

    public ManualMemberCleanupScheduler(ManualMemberRepository manualMemberRepository) {
        this.manualMemberRepository = manualMemberRepository;
    }

    // 매일 새벽 4시 30분 — 피티 종료 90일 경과 AND isActive=false 미연동 회원 자동 삭제
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    public void cleanupPtEndedManualMembers() {
        LocalDate cutoff = LocalDate.now().minusDays(90);
        List<ManualMember> toDelete = manualMemberRepository.findPtEndedForCleanup(cutoff);
        for (ManualMember m : toDelete) {
            manualMemberRepository.delete(m);
            System.out.println("피티종료 90일 자동삭제: manualMemberId=" + m.getId() + " name=" + m.getName());
        }
        if (!toDelete.isEmpty()) {
            System.out.println("미연동 피티종료 자동삭제 완료: " + toDelete.size() + "명");
        }
    }
}
