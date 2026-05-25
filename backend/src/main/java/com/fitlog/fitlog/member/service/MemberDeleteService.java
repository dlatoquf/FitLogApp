package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class MemberDeleteService {

    private final JwtService jwtService;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final ScheduleRepository scheduleRepository;
    private final NotificationRepository notificationRepository;

    public MemberDeleteService(JwtService jwtService,
                               MemberRepository memberRepository,
                               UserRepository userRepository,
                               ScheduleRequestRepository scheduleRequestRepository,
                               ScheduleRepository scheduleRepository,
                               NotificationRepository notificationRepository) {
        this.jwtService = jwtService;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.scheduleRepository = scheduleRepository;
        this.notificationRepository = notificationRepository;
    }

    // 소프트 딜리트: user.deletedAt만 설정하고 데이터는 보존 (7일 후 스케줄러가 완전 삭제)
    @Transactional
    public void deleteMemberAccount(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));

        // 미래 수업 신청 취소 + 다른 신청자 없으면 슬롯 OPEN 복구
        java.time.LocalDate today = java.time.LocalDate.now();
        java.util.List<Schedule> futureSchedules =
                scheduleRepository.findFutureSchedulesByMember(member, today);

        for (Schedule schedule : futureSchedules) {
            java.util.List<ScheduleRequest> myRequests =
                    scheduleRequestRepository.findBySchedule(schedule).stream()
                            .filter(r -> r.getMember().getId().equals(member.getId()))
                            .toList();
            scheduleRequestRepository.deleteAll(myRequests);

            // 다른 신청자가 없고 REQUESTED 상태면 OPEN으로 복구
            boolean othersExist = scheduleRequestRepository.findBySchedule(schedule).stream()
                    .anyMatch(r -> !r.getMember().getId().equals(member.getId()));
            if (!othersExist && "REQUESTED".equals(schedule.getStatusStr())) {
                schedule.setStatus(Schedule.Status.OPEN);
                scheduleRepository.save(schedule);
            }
        }

        member.getUser().setDeletedAt(LocalDateTime.now());
        userRepository.save(member.getUser());
    }

    // 스케줄러가 호출하는 계정 익명화 (7일 경과 후)
    // 운동/식단/바디로그/PT 기록은 트레이너가 계속 조회할 수 있도록 유지
    @Transactional
    public void hardDeleteMember(Member member) {
        User user = member.getUser();
        Long userId = user.getId();

        // 1. 미래 수업 신청 취소 및 슬롯 정리
        java.time.LocalDate today = java.time.LocalDate.now();
        java.util.List<com.fitlog.fitlog.schedule.entity.Schedule> futureSchedules =
                scheduleRepository.findFutureSchedulesByMember(member, today);
        if (!futureSchedules.isEmpty()) {
            java.util.List<Long> futureIds = futureSchedules.stream()
                    .map(com.fitlog.fitlog.schedule.entity.Schedule::getId)
                    .toList();
            scheduleRequestRepository.deleteByScheduleIds(futureIds);
            scheduleRepository.deleteAll(futureSchedules);
        }
        scheduleRequestRepository.deleteAll(scheduleRequestRepository.findByMember(member));

        // 2. 알림 삭제 (개인 식별 정보이므로 제거)
        notificationRepository.deleteAllByUser(user);

        // 3. User 익명화: 로그인 불가 처리 + 개인정보 제거
        //    kakaoId = null → 카카오 로그인 불가
        //    name = "탈퇴한 회원" → 트레이너 화면에 표시될 이름
        //    email/fcmToken 제거
        user.setKakaoId(null);
        user.setEmail("deleted_" + userId + "@fitlog.deleted");
        user.setName("탈퇴한 회원");
        user.setFcmToken(null);
        // deletedAt은 유지 (탈퇴 처리된 계정임을 표시)
        userRepository.save(user);

        // 4. Member 레코드 및 모든 기록 유지
        //    (운동 기록, 식단 기록, 바디로그, PT 계약, 목표 등)
        //    → 트레이너가 계속 조회 가능
    }
}
