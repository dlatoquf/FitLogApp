package com.fitlog.fitlog.mission.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.mission.dto.MissionResponse;
import com.fitlog.fitlog.mission.entity.Mission;
import com.fitlog.fitlog.mission.repository.MissionRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;

@Service
public class MissionService {

    private final MissionRepository missionRepository;
    private final NotificationService notificationService;

    public MissionService(MissionRepository missionRepository, NotificationService notificationService) {
        this.missionRepository = missionRepository;
        this.notificationService = notificationService;
    }

    // 운동 로그 저장 시 미션 일괄 생성 (앱 연동 회원)
    @Transactional
    public void createMissions(Long workoutLogId, List<String> contents, Trainer trainer, Member member) {
        if (contents == null || contents.isEmpty()) return;
        for (String content : contents) {
            if (content == null || content.isBlank()) continue;
            Mission m = new Mission();
            m.setWorkoutLogId(workoutLogId);
            m.setTrainer(trainer);
            m.setMember(member);
            m.setContent(content.trim());
            missionRepository.save(m);
        }
    }

    // 운동 로그 저장 시 미션 일괄 생성 (미연동 회원)
    @Transactional
    public void createMissionsForManual(Long workoutLogId, List<String> contents, Trainer trainer, ManualMember manualMember) {
        if (contents == null || contents.isEmpty()) return;
        for (String content : contents) {
            if (content == null || content.isBlank()) continue;
            Mission m = new Mission();
            m.setWorkoutLogId(workoutLogId);
            m.setTrainer(trainer);
            m.setManualMember(manualMember);
            m.setContent(content.trim());
            missionRepository.save(m);
        }
    }

    // 회원이 미션 완료 처리
    @Transactional
    public MissionResponse completeMission(Long missionId, Long memberId) {
        Mission mission = missionRepository.findById(missionId)
                .orElseThrow(() -> new RuntimeException("미션을 찾을 수 없습니다."));
        if (!mission.getMember().getId().equals(memberId)) {
            throw new RuntimeException("권한이 없습니다.");
        }
        mission.setIsDone(true);
        mission.setStatus(Mission.Status.DONE);
        mission.setDoneAt(LocalDateTime.now());
        MissionResponse result = new MissionResponse(missionRepository.save(mission));

        // 트레이너 알림 발송 (설정이 켜진 경우)
        Trainer trainer = mission.getTrainer();
        if (trainer != null && trainer.getNotifMissionDone() && trainer.getUser() != null) {
            String memberName = mission.getMember().getUser() != null
                    ? mission.getMember().getUser().getName() : "회원";
            notificationService.sendNotification(
                    trainer.getUser(),
                    "MISSION_DONE",
                    memberName + "님이 챌린지를 완료했어요.",
                    "MISSION",
                    mission.getId()
            );
        }

        return result;
    }

    // 회원의 최근 미션 조회
    public List<MissionResponse> getMyMissions(Long memberId) {
        return missionRepository.findRecentByMemberId(memberId,
                        java.util.List.of(Mission.Status.PENDING, Mission.Status.DONE))
                .stream()
                .map(MissionResponse::new)
                .toList();
    }

    // 트레이너가 특정 회원 미션 조회 (연동 회원)
    public List<MissionResponse> getMemberMissions(Long trainerId, Long memberId) {
        return missionRepository.findByTrainerIdAndMemberId(trainerId, memberId)
                .stream()
                .map(MissionResponse::new)
                .toList();
    }

    // 트레이너가 특정 미연동 회원 미션 조회
    public List<MissionResponse> getManualMemberMissions(Long trainerId, Long manualMemberId) {
        return missionRepository.findByTrainerIdAndManualMemberId(trainerId, manualMemberId)
                .stream()
                .map(MissionResponse::new)
                .toList();
    }

    // 새 PT 수업 저장 시 — 이전 PENDING 미션 모두 FAILED 처리
    @Transactional
    public void failPendingMissions(Long memberId) {
        List<Mission> pending = missionRepository.findPendingByMemberId(memberId);
        LocalDateTime now = LocalDateTime.now();
        for (Mission m : pending) {
            m.setStatus(Mission.Status.FAILED);
            m.setFailedAt(now);
        }
        missionRepository.saveAll(pending);
    }

    // 트레이너용: 이전 수업 챌린지 결과 조회
    public List<MissionResponse> getLastSessionMissions(Long memberId) {
        return missionRepository.findLastSessionMissionsByMemberId(memberId)
                .stream()
                .map(MissionResponse::new)
                .toList();
    }
}
