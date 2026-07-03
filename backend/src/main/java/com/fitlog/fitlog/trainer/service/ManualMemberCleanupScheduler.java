package com.fitlog.fitlog.trainer.service;

import com.fitlog.fitlog.bodylog.repository.ManualBodyLogRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 미연동 회원 중 PT 종료 후 90일(유예 7일 + 비활성 83일) 경과 시 자동 삭제
 * 스케줄·결제(PtContract)는 기록 보존 (참조만 해제)
 */
@Component
public class ManualMemberCleanupScheduler {

    private final ManualMemberRepository manualMemberRepository;
    private final PtContractRepository ptContractRepository;
    private final ScheduleRepository scheduleRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final MemberMemoRepository memberMemoRepository;
    private final ManualBodyLogRepository manualBodyLogRepository;

    public ManualMemberCleanupScheduler(ManualMemberRepository manualMemberRepository,
                                        PtContractRepository ptContractRepository,
                                        ScheduleRepository scheduleRepository,
                                        WorkoutLogRepository workoutLogRepository,
                                        MemberMemoRepository memberMemoRepository,
                                        ManualBodyLogRepository manualBodyLogRepository) {
        this.manualMemberRepository = manualMemberRepository;
        this.ptContractRepository = ptContractRepository;
        this.scheduleRepository = scheduleRepository;
        this.workoutLogRepository = workoutLogRepository;
        this.memberMemoRepository = memberMemoRepository;
        this.manualBodyLogRepository = manualBodyLogRepository;
    }

    // 매일 새벽 4시 30분 — 피티 종료 90일 경과 AND isActive=false 미연동 회원 자동 삭제
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    public void cleanupPtEndedManualMembers() {
        LocalDate cutoff = LocalDate.now(ZoneId.of("Asia/Seoul")).minusDays(90);
        List<ManualMember> toDelete = manualMemberRepository.findPtEndedForCleanup(cutoff);
        for (ManualMember m : toDelete) {
            // PtContract: 이름 보존 후 참조 해제 (기록 유지)
            ptContractRepository.findByManualMember(m).forEach(c -> {
                if (c.getMemberName() == null) c.setMemberName(m.getName());
                c.setManualMember(null);
                ptContractRepository.save(c);
            });
            // 스케줄: 이름 보존 후 참조 해제 (기록 유지)
            scheduleRepository.findByManualMember(m).forEach(s -> {
                if (s.getMemberName() == null) s.setMemberName(m.getName());
                scheduleRepository.save(s);
            });
            scheduleRepository.detachManualMemberFromSchedules(m);
            // 나머지 데이터 삭제
            workoutLogRepository.deleteByManualMember(m);
            memberMemoRepository.deleteByManualMemberId(m.getId());
            manualBodyLogRepository.deleteByManualMemberId(m.getId());
            manualMemberRepository.delete(m);
            System.out.println("피티종료 90일 자동삭제: manualMemberId=" + m.getId() + " name=" + m.getName());
        }
        if (!toDelete.isEmpty()) {
            System.out.println("미연동 피티종료 자동삭제 완료: " + toDelete.size() + "명");
        }
    }
}
