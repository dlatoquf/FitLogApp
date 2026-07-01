package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.diet.repository.DietDayFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietPhotoFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietPhotoRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberGoalRepository;
import com.fitlog.fitlog.mission.repository.MissionRepository;
import com.fitlog.fitlog.notice.repository.TrainerNoticeRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 연동 회원 데이터 정리 공통 서비스
 *
 * 적용 케이스:
 *  - 트레이너가 연동 회원 삭제
 *  - 회원이 직접 연결 해제
 *  - 비활성 30일 후 자동 정리
 *  - 탈퇴 30일 후 개인정보 삭제
 *
 * 유지: CONFIRMED/COMPLETED/NO_SHOW 스케줄(member=null), PtContract
 * 삭제: 나머지 모든 데이터
 */
@Service
public class MemberDataCleanupService {

    private final ScheduleRepository scheduleRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final MemberMemoRepository memberMemoRepository;
    private final BodyLogRepository bodyLogRepository;
    private final DietPhotoRepository dietPhotoRepository;
    private final DietDayFeedbackRepository dietDayFeedbackRepository;
    private final DietPhotoFeedbackRepository dietPhotoFeedbackRepository;
    private final MissionRepository missionRepository;
    private final TrainerNoticeRepository trainerNoticeRepository;
    private final NotificationRepository notificationRepository;
    private final MemberGoalRepository memberGoalRepository;

    public MemberDataCleanupService(
            ScheduleRepository scheduleRepository,
            WorkoutLogRepository workoutLogRepository,
            MemberMemoRepository memberMemoRepository,
            BodyLogRepository bodyLogRepository,
            DietPhotoRepository dietPhotoRepository,
            DietDayFeedbackRepository dietDayFeedbackRepository,
            DietPhotoFeedbackRepository dietPhotoFeedbackRepository,
            MissionRepository missionRepository,
            TrainerNoticeRepository trainerNoticeRepository,
            NotificationRepository notificationRepository,
            MemberGoalRepository memberGoalRepository) {
        this.scheduleRepository = scheduleRepository;
        this.workoutLogRepository = workoutLogRepository;
        this.memberMemoRepository = memberMemoRepository;
        this.bodyLogRepository = bodyLogRepository;
        this.dietPhotoRepository = dietPhotoRepository;
        this.dietDayFeedbackRepository = dietDayFeedbackRepository;
        this.dietPhotoFeedbackRepository = dietPhotoFeedbackRepository;
        this.missionRepository = missionRepository;
        this.trainerNoticeRepository = trainerNoticeRepository;
        this.notificationRepository = notificationRepository;
        this.memberGoalRepository = memberGoalRepository;
    }

    /**
     * PT/스케줄 기록을 제외한 모든 데이터 정리
     * - CONFIRMED/COMPLETED/NO_SHOW 스케줄: member=null로 참조 해제 (유지)
     * - OPEN/REQUESTED 스케줄: 삭제
     * - PtContract: 건드리지 않음 (유지)
     */
    @Transactional
    public void cleanupMemberData(Member member) {
        Long mId = member.getId();

        // 스케줄: 이름 보존 후 참조 해제, 나머지 삭제
        scheduleRepository.findRecordedSchedulesByMember(member).forEach(s -> {
            if (s.getMemberName() == null) {
                s.setMemberName(member.getUser().getName());
                scheduleRepository.save(s);
            }
        });
        scheduleRepository.detachMemberFromRecordedSchedules(member);
        scheduleRepository.deleteByMember(member);

        // 이하 전부 삭제
        workoutLogRepository.deleteByMember(member);
        memberMemoRepository.deleteByMember(member);
        bodyLogRepository.deleteByMember(member);
        dietPhotoFeedbackRepository.deleteByMemberId(mId);
        dietDayFeedbackRepository.deleteByMember(member);
        dietPhotoRepository.deleteByMember(member);
        missionRepository.deleteByMemberId(mId);
        trainerNoticeRepository.deleteByMemberId(mId);
        notificationRepository.deleteByMemberId(mId);
        memberGoalRepository.deleteByMember(member);
    }
}
