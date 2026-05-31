package com.fitlog.fitlog.trainer.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.diet.repository.DietDayFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietPhotoFeedbackRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TrainerDeleteService {

    private final JwtService jwtService;
    private final TrainerRepository trainerRepository;
    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final ScheduleRepository scheduleRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final DietPhotoFeedbackRepository dietPhotoFeedbackRepository;
    private final DietDayFeedbackRepository dietDayFeedbackRepository;
    private final NotificationRepository notificationRepository;
    private final PtContractRepository ptContractRepository;

    public TrainerDeleteService(JwtService jwtService,
                                TrainerRepository trainerRepository,
                                UserRepository userRepository,
                                MemberRepository memberRepository,
                                ScheduleRepository scheduleRepository,
                                ScheduleRequestRepository scheduleRequestRepository,
                                WorkoutLogRepository workoutLogRepository,
                                DietPhotoFeedbackRepository dietPhotoFeedbackRepository,
                                DietDayFeedbackRepository dietDayFeedbackRepository,
                                NotificationRepository notificationRepository,
                                PtContractRepository ptContractRepository) {
        this.jwtService = jwtService;
        this.trainerRepository = trainerRepository;
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
        this.scheduleRepository = scheduleRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.workoutLogRepository = workoutLogRepository;
        this.dietPhotoFeedbackRepository = dietPhotoFeedbackRepository;
        this.dietDayFeedbackRepository = dietDayFeedbackRepository;
        this.notificationRepository = notificationRepository;
        this.ptContractRepository = ptContractRepository;
    }

    @Transactional
    public void deleteTrainerAccount(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        User user = trainer.getUser();

        // 1. 트레이너 스케줄 전체 조회
        List<Schedule> schedules = scheduleRepository.findByTrainer(trainer);

        // 2. 스케줄 요청 삭제 (schedule_request FK → schedule)
        if (!schedules.isEmpty()) {
            List<Long> scheduleIds = schedules.stream()
                    .map(Schedule::getId)
                    .toList();
            scheduleRequestRepository.deleteByScheduleIds(scheduleIds);
        }

        // 3. 스케줄 삭제
        scheduleRepository.deleteAll(schedules);

        // 4. 연결된 회원들 trainer 참조 해제 (members.trainer_id → null)
        List<Member> members = memberRepository.findAllByTrainer(trainer);
        members.forEach(m -> m.setTrainer(null));
        memberRepository.saveAll(members);

        // 5. PT 계약에서 trainer 참조 해제 (회원 계약 기록은 유지)
        ptContractRepository.detachTrainerFromContracts(trainer);

        // 6. 운동 로그에서 trainer 참조 해제 (회원 운동 기록은 유지)
        workoutLogRepository.detachTrainerFromWorkoutLogs(trainer);

        // 7. 식단 피드백 삭제 (트레이너가 작성한 피드백)
        dietPhotoFeedbackRepository.deleteByTrainerId(trainer.getId());
        dietDayFeedbackRepository.deleteByTrainerId(trainer.getId());

        // 8. 알림 삭제
        notificationRepository.deleteAllByUser(user);

        // 9. 트레이너 삭제
        trainerRepository.delete(trainer);

        // 10. 유저 삭제
        userRepository.delete(user);
    }
}
