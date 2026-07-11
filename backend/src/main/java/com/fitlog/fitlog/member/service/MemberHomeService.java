package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.Objects;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MemberHomeService {

    private final MemberRepository memberRepository;
    private final ScheduleRepository scheduleRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final JwtService jwtService;
    private final NotificationRepository notificationRepository;

    public MemberHomeService(MemberRepository memberRepository,
                             ScheduleRepository scheduleRepository,
                             ScheduleRequestRepository scheduleRequestRepository,
                             JwtService jwtService,
                             NotificationRepository notificationRepository) {
        this.memberRepository = memberRepository;
        this.scheduleRepository = scheduleRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.jwtService = jwtService;
        this.notificationRepository = notificationRepository;
    }

    public Map<String, Object> getHome(String authorization) {
        Member member = getMember(authorization);

        Map<String, Object> result = new HashMap<>();

        result.put("member", buildMemberInfo(member));
        result.put("ptRemaining", member.getPtRemaining() != null ? member.getPtRemaining() : 0);
        result.put("ptTotal", member.getPtTotal() != null ? member.getPtTotal() : 0);

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        LocalDate weekEnd = today.with(DayOfWeek.SUNDAY);

        // 식단은 사진 기반으로 전환 — 칼로리 집계 제거
        result.put("todayDietCalories", 0);
        result.put("todayProtein", 0);
        result.put("goalCalories", 0);

        List<Map<String, Object>> thisWeekSchedules = new ArrayList<>();

        boolean isActive = member.getStatus() == com.fitlog.fitlog.member.entity.Member.Status.ACTIVE;
        if (member.getTrainer() != null && isActive) {
            List<ScheduleRequest> confirmedRequests =
                    scheduleRequestRepository.findThisWeekConfirmedByMemberId(
                            member.getId(),
                            ScheduleRequest.Status.CONFIRMED,
                            today,
                            weekEnd
                    );

            thisWeekSchedules = confirmedRequests.stream()
                    .filter(r -> r.getSchedule() != null)
                    .map(r -> {
                        Schedule s = r.getSchedule();

                        Map<String, Object> map = new HashMap<>();
                        map.put("scheduleId", s.getId());
                        map.put("date", s.getDate().toString());
                        map.put("startTime", s.getStartTime() != null
                                ? s.getStartTime().toString().substring(0, 5)
                                : "");
                        map.put("endTime", s.getEndTime() != null
                                ? s.getEndTime().toString().substring(0, 5)
                                : "");
                        return map;
                    })
                    .collect(Collectors.toList());

            confirmedRequests.stream()
                    .filter(r -> r.getSchedule() != null && r.getSchedule().getDate() != null)
                    .min(Comparator.comparing(r -> r.getSchedule().getDate()))
                    .ifPresentOrElse(r -> {
                        Schedule s = r.getSchedule();

                        result.put("nextSchedule", s.getDate() + " " +
                                (s.getStartTime() != null
                                        ? s.getStartTime().toString().substring(0, 5)
                                        : ""));
                        result.put("dDay", ChronoUnit.DAYS.between(today, s.getDate()));
                    }, () -> {
                        result.put("nextSchedule", null);
                        result.put("dDay", null);
                    });
        } else {
            result.put("nextSchedule", null);
            result.put("dDay", null);
        }

        result.put("thisWeekSchedules", thisWeekSchedules);
        result.put("unreadFeedbackCount", 0);

        return result;
    }

    public Map<String, Object> getMe(String authorization) {
        Member member = getMember(authorization);
        Map<String, Object> result = buildMemberInfo(member);
        boolean isActive = member.getStatus() == com.fitlog.fitlog.member.entity.Member.Status.ACTIVE;
        if (member.getTrainer() != null && isActive) {
            result.put("gymName", member.getTrainer().getGymName());
        }
        return result;
    }

    public List<Map<String, Object>> getMyThisWeek(String authorization) {
        Member member = getMember(authorization);

        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));

        boolean isActive = member.getStatus() == com.fitlog.fitlog.member.entity.Member.Status.ACTIVE;
        if (member.getTrainer() == null || !isActive) {
            return Collections.emptyList();
        }

        return scheduleRepository
                .findConfirmedOrCompletedByMemberFrom(member, today)
                .stream()
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("scheduleId", s.getId());
                    map.put("date", s.getDate().toString());
                    map.put("startTime", s.getStartTime() != null
                            ? s.getStartTime().toString().substring(0, 5)
                            : "");
                    map.put("endTime", s.getEndTime() != null
                            ? s.getEndTime().toString().substring(0, 5)
                            : "");
                    map.put("status", s.getStatusStr());
                    return map;
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildMemberInfo(Member member) {
        Map<String, Object> map = new HashMap<>();
        map.put("id",          member.getId());
        map.put("name",        member.getUser().getName());
        map.put("phone",       member.getPhone());
        map.put("height",      member.getHeight());
        map.put("weight",      member.getWeight());
        map.put("bodyFat",     member.getBodyFat());
        map.put("muscleMass",  member.getMuscleMass());
        map.put("goal",        member.getGoal());
        map.put("ptRemaining", member.getPtRemaining());
        map.put("ptTotal",     member.getPtTotal());
        map.put("ptStartDate",    member.getPtStartDate());
        map.put("ptExpDate",      member.getPtExpDate());
        // ACTIVE 상태일 때만 트레이너 정보 노출 (INACTIVE = 연결해제 상태)
        boolean isActive = member.getStatus() == com.fitlog.fitlog.member.entity.Member.Status.ACTIVE;
        if (member.getTrainer() != null && isActive) {
            map.put("trainerName", member.getTrainer().getUser().getName());
            map.put("trainerCode", member.getTrainer().getTrainerCode());
            map.put("gymName", member.getTrainer().getGymName());
            map.put("trainerPlan", member.getTrainer().getPlan());
        }
        return map;
    }

    // 컨트롤러에서도 쓸 수 있게 public
    public Member getMemberByToken(String authorization) {
        return getMember(authorization);
    }

    // JWT → userId → member+trainer+user 한번에
    private Member getMember(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        return memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));
    }
}