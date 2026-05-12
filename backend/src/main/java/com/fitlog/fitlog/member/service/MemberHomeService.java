package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.diet.entity.DietLog;
import com.fitlog.fitlog.diet.repository.DietLogRepository;
import com.fitlog.fitlog.member.entity.MemberGoal;
import com.fitlog.fitlog.member.repository.MemberGoalRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MemberHomeService {

    private final MemberRepository memberRepository;
    private final ScheduleRepository scheduleRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final JwtService jwtService;
    private final DietLogRepository dietLogRepository;
    private final MemberGoalRepository memberGoalRepository;
    private final NotificationRepository notificationRepository;

    public MemberHomeService(MemberRepository memberRepository,
                             ScheduleRepository scheduleRepository,
                             ScheduleRequestRepository scheduleRequestRepository,
                             JwtService jwtService,
                             DietLogRepository dietLogRepository,
                             MemberGoalRepository memberGoalRepository,
                             NotificationRepository notificationRepository) {
        this.memberRepository = memberRepository;
        this.scheduleRepository = scheduleRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.jwtService = jwtService;
        this.dietLogRepository = dietLogRepository;
        this.memberGoalRepository = memberGoalRepository;
        this.notificationRepository = notificationRepository;
    }

    public Map<String, Object> getHome(String authorization) {
        Member member = getMember(authorization);

        Map<String, Object> result = new HashMap<>();

        result.put("member", buildMemberInfo(member));
        result.put("ptRemaining", member.getPtRemaining() != null ? member.getPtRemaining() : 0);
        result.put("ptTotal", member.getPtTotal() != null ? member.getPtTotal() : 0);

        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.with(DayOfWeek.SUNDAY);

        List<DietLog> todayLogs = dietLogRepository.findByMemberAndDate(member, today);

        double todayCalories = todayLogs.stream()
                .mapToDouble(log -> log.getCalories() != null ? log.getCalories() : 0)
                .sum();

        double todayProtein = todayLogs.stream()
                .mapToDouble(log -> log.getProtein() != null ? log.getProtein() : 0)
                .sum();

        MemberGoal goal = memberGoalRepository
                .findTopByMemberOrderByCreatedAtDesc(member)
                .orElse(null);

        result.put("todayDietCalories", todayCalories);
        result.put("todayProtein", todayProtein);
        result.put("goalCalories", goal != null ? goal.getTargetCalories() : 2000);

        List<Map<String, Object>> thisWeekSchedules = new ArrayList<>();

        if (member.getTrainer() != null) {
            List<ScheduleRequest> confirmedRequests =
                    scheduleRequestRepository.findThisWeekConfirmedByMemberId(
                            member.getId(),
                            ScheduleRequest.Status.CONFIRMED,
                            today,
                            weekEnd
                    );

            thisWeekSchedules = confirmedRequests.stream()
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
        if (member.getTrainer() != null) {
            result.put("gymName", member.getTrainer().getGymName());
        }
        return result;
    }

    public List<Map<String, Object>> getMyThisWeek(String authorization) {
        Member member = getMember(authorization);
        LocalDate today   = LocalDate.now();
        LocalDate weekEnd = today.with(DayOfWeek.SUNDAY);

        return scheduleRequestRepository.findByMember(member).stream()
                .filter(r -> r.getStatus() == ScheduleRequest.Status.CONFIRMED)
                .filter(r -> r.getSchedule() != null && r.getSchedule().getDate() != null)
                .filter(r -> {
                    LocalDate d = r.getSchedule().getDate();
                    return !d.isBefore(today) && !d.isAfter(weekEnd);
                })
                .sorted(Comparator.comparing(r -> r.getSchedule().getDate()))
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("scheduleId", r.getSchedule().getId());
                    map.put("date",       r.getSchedule().getDate().toString());
                    map.put("startTime",  r.getSchedule().getStartTime() != null ?
                            r.getSchedule().getStartTime().toString().substring(0, 5) : "");
                    map.put("endTime",    r.getSchedule().getEndTime() != null ?
                            r.getSchedule().getEndTime().toString().substring(0, 5) : "");
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
        map.put("ptStartDate", member.getPtStartDate());
        map.put("ptExpDate",   member.getPtExpDate());
        if (member.getTrainer() != null) {
            map.put("trainerName", member.getTrainer().getUser().getName());
            map.put("trainerCode", member.getTrainer().getTrainerCode());
            map.put("gymName", member.getTrainer().getGymName());
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