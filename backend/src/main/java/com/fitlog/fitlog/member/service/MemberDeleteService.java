package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.diet.repository.DietFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietLogRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberGoalRepository;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MemberDeleteService {

    private final JwtService jwtService;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final BodyLogRepository bodyLogRepository;
    private final DietLogRepository dietLogRepository;
    private final DietFeedbackRepository dietFeedbackRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final ScheduleRepository scheduleRepository;
    private final MemberGoalRepository memberGoalRepository;
    private final PtContractRepository ptContractRepository;
    private final NotificationRepository notificationRepository;

    public MemberDeleteService(JwtService jwtService,
                               MemberRepository memberRepository,
                               UserRepository userRepository,
                               BodyLogRepository bodyLogRepository,
                               DietLogRepository dietLogRepository,
                               DietFeedbackRepository dietFeedbackRepository,
                               WorkoutLogRepository workoutLogRepository,
                               ScheduleRequestRepository scheduleRequestRepository,
                               ScheduleRepository scheduleRepository,
                               MemberGoalRepository memberGoalRepository,
                               PtContractRepository ptContractRepository,
                               NotificationRepository notificationRepository) {
        this.jwtService = jwtService;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.bodyLogRepository = bodyLogRepository;
        this.dietLogRepository = dietLogRepository;
        this.dietFeedbackRepository = dietFeedbackRepository;
        this.workoutLogRepository = workoutLogRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.scheduleRepository = scheduleRepository;
        this.memberGoalRepository = memberGoalRepository;
        this.ptContractRepository = ptContractRepository;
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void deleteMemberAccount(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
        User user = member.getUser();

        // 1. 수업 신청 내역 삭제
        scheduleRequestRepository.deleteAll(
                scheduleRequestRepository.findByMember(member)
        );

        // 2. 트레이너 스케줄 슬롯에서 회원 참조 해제
        scheduleRepository.detachMemberFromSchedules(member);

        // 3. 운동 로그 삭제
        workoutLogRepository.deleteAll(
                workoutLogRepository.findByMember(member)
        );

        // 4. 식단 로그 삭제
        dietLogRepository.deleteAll(
                dietLogRepository.findByMember(member)
        );

        // 5. 식단 피드백 삭제
        dietFeedbackRepository.deleteAll(
                dietFeedbackRepository.findByMemberOrderByCreatedAtDesc(member)
        );

        // 6. 체성분 로그 삭제
        bodyLogRepository.deleteAll(
                bodyLogRepository.findByMemberOrderByLogDateAsc(member)
        );

        // 7. 목표 삭제
        memberGoalRepository.deleteAll(
                memberGoalRepository.findByMember(member)
        );

        // 8. PT 계약 삭제
        ptContractRepository.deleteAll(
                ptContractRepository.findByMemberId(member.getId())
        );

        // 9. 알림 삭제
        notificationRepository.deleteAllByUser(user);

        // 10. 회원 삭제
        memberRepository.delete(member);

        // 11. 유저 삭제
        userRepository.delete(user);
    }
}
