package com.fitlog.fitlog.schedule.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final NotificationService notificationService; // NotificationRepository 대신 NotificationService 사용

    public ScheduleService(ScheduleRepository scheduleRepository,
                           ScheduleRequestRepository scheduleRequestRepository,
                           TrainerRepository trainerRepository,
                           MemberRepository memberRepository,
                           JwtService jwtService,
                           UserRepository userRepository,
                           NotificationService notificationService) {
        this.scheduleRepository = scheduleRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    // 슬롯 조회 (회원용)
    public List<Schedule> getSlotsForMember(String auth) {
        User user = getUserFromAuth(auth);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보 없음"));
        Trainer trainer = member.getTrainer();
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);
        return scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday);
    }

    // 이번 주 내 확정 일정 (회원용)
    // schedule_requests는 "회원이 신청한 예약 요청" 이력이고,
    // 트레이너가 직접 추가한 수업은 schedules.member_id / status 기준으로 확인해야 함.
    public List<Map<String, Object>> getMyThisWeekSchedules(String auth) {
        User user = getUserFromAuth(auth);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보 없음"));

        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(DayOfWeek.MONDAY);
        LocalDate sunday = monday.plusDays(6);

        Trainer trainer = member.getTrainer();
        if (trainer == null) {
            return Collections.emptyList();
        }

        return scheduleRepository
                .findByTrainerAndDateBetween(trainer, monday, sunday)
                .stream()
                .filter(s -> s.getMember() != null && Objects.equals(s.getMember().getId(), member.getId()))
                .filter(s -> "CONFIRMED".equals(s.getStatusStr()) || "COMPLETED".equals(s.getStatusStr()))
                .sorted(Comparator
                        .comparing(Schedule::getDate)
                        .thenComparing(Schedule::getStartTime))
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("scheduleId", s.getId());
                    map.put("date", s.getDate());
                    map.put("startTime", s.getStartTime());
                    map.put("endTime", s.getEndTime());
                    map.put("status", s.getStatusStr());
                    return map;
                })
                .collect(Collectors.toList());
    }

    // 다음 주 슬롯 조회 (회원용)
    public List<Map<String, Object>> getNextWeekSlotsForMember(String auth) {
        User user = getUserFromAuth(auth);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보 없음"));
        Trainer trainer = member.getTrainer();

        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Schedule> slots = scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday);

        return slots.stream()
                .map(s -> {
                    boolean myRequest = scheduleRequestRepository.existsByScheduleAndMember(s, member);
                    Map<String, Object> map = new HashMap<>();
                    map.put("scheduleId", s.getId());
                    map.put("date", s.getDate());
                    map.put("startTime", s.getStartTime());
                    map.put("endTime", s.getEndTime());
                    map.put("status", s.getStatusStr());
                    map.put("myRequest", myRequest);
                    return map;
                })
                .collect(Collectors.toList());
    }

    // 수업 신청 (회원용)
    @Transactional
    public void requestSlot(String auth, Long scheduleId) {
        User user = getUserFromAuth(auth);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보 없음"));

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯 없음"));

        if (scheduleRequestRepository.existsByScheduleAndMember(schedule, member))
            throw new RuntimeException("이미 신청한 슬롯");

        ScheduleRequest req = new ScheduleRequest();
        req.setSchedule(schedule);
        req.setMember(member);
        scheduleRequestRepository.save(req);

        schedule.setStatus(Schedule.Status.REQUESTED);
        scheduleRepository.save(schedule);

        // 트레이너에게 수업 신청 알림 + FCM 푸시
        notificationService.sendNotification(
                schedule.getTrainer().getUser(),
                "SCHEDULE_REQUEST",
                member.getUser().getName() + "님이 수업을 신청했어요.",
                "SCHEDULE",
                scheduleId
        );
    }

    // 수업 신청 취소 (회원용)
    @Transactional
    public void cancelRequest(String auth, Long scheduleId) {
        User user = getUserFromAuth(auth);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보 없음"));

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯 없음"));

        ScheduleRequest req = scheduleRequestRepository.findByScheduleAndMember(schedule, member)
                .orElseThrow(() -> new RuntimeException("신청 없음"));

        scheduleRequestRepository.delete(req);

        boolean hasOtherRequests = !scheduleRequestRepository.findBySchedule(schedule).isEmpty();
        schedule.setStatus(hasOtherRequests ? Schedule.Status.REQUESTED : Schedule.Status.OPEN);
        scheduleRepository.save(schedule);

        // 트레이너에게 수업 신청 취소 알림 + FCM 푸시
        notificationService.sendNotification(
                schedule.getTrainer().getUser(),
                "SCHEDULE_CANCEL_REQ",
                member.getUser().getName() + "님이 수업 신청을 취소했어요.",
                "SCHEDULE",
                scheduleId
        );
    }

    // 신청 목록 조회 (트레이너용)
    public List<Map<String, Object>> getRequestsBySlot(String auth, Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯 없음"));

        return scheduleRequestRepository.findBySchedule(schedule).stream()
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("requestId", r.getId());
                    map.put("memberId", r.getMember().getId());
                    map.put("memberName", r.getMember().getUser().getName());
                    map.put("status", r.getStatus().name());
                    return map;
                })
                .collect(Collectors.toList());
    }

    // 수업 확정 (트레이너용)
    @Transactional
    public void confirmRequest(String auth, Long scheduleId, Long memberId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯 없음"));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원 없음"));

        // 신청 없어도 트레이너 직접 확정 가능 (OPEN 슬롯 추가 시)
        ScheduleRequest req = scheduleRequestRepository.findByScheduleAndMember(schedule, member)
                .orElseGet(() -> {
                    ScheduleRequest newReq = new ScheduleRequest();
                    newReq.setSchedule(schedule);
                    newReq.setMember(member);
                    return newReq;
                });

        req.setStatus(ScheduleRequest.Status.CONFIRMED);
        scheduleRequestRepository.save(req);

        schedule.setStatus(Schedule.Status.CONFIRMED);
        schedule.setMember(member);
        scheduleRepository.save(schedule);

        // PT 횟수 차감
        if (member.getPtRemaining() != null && member.getPtRemaining() > 0) {
            member.setPtRemaining(member.getPtRemaining() - 1);
            memberRepository.save(member);
        }

        // 회원에게 수업 확정 알림 + FCM 푸시
        notificationService.sendNotification(
                member.getUser(),
                "SCHEDULE_CONFIRM",
                "수업이 확정됐어요! " + schedule.getDate() + " " + schedule.getStartTime() + " · PT 잔여 " + member.getPtRemaining() + "회",
                "SCHEDULE",
                scheduleId
        );
    }

    // 주간 캘린더 조회 (트레이너용)
    // 주간 캘린더 조회 (트레이너용)
    public List<Map<String, Object>> getWeeklyCalendar(String auth, LocalDate weekStart) {

        User user = getUserFromAuth(auth);

        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        LocalDate weekEnd = weekStart.plusDays(6);

        // 스케줄 한번 조회
        List<Schedule> schedules =
                scheduleRepository.findByTrainerIdAndDateBetweenWithMember(
                        trainer.getId(),
                        weekStart,
                        weekEnd
                );

        // scheduleId 목록 추출
        List<Long> scheduleIds = schedules.stream()
                .map(Schedule::getId)
                .toList();

        // request 한번에 조회
        List<ScheduleRequest> requests =
                scheduleRequestRepository.findByScheduleIds(scheduleIds);

        // scheduleId 기준으로 신청자 이름 그룹핑
        Map<Long, List<String>> requestMap = requests.stream()
                .collect(Collectors.groupingBy(
                        r -> r.getSchedule().getId(),
                        Collectors.mapping(
                                r -> r.getMember().getUser().getName(),
                                Collectors.toList()
                        )
                ));

        // 최종 응답 생성
        return schedules.stream().map(s -> {

            Map<String, Object> map = new HashMap<>();

            map.put("id", s.getId());
            map.put("scheduleId", s.getId());

            map.put("date", s.getDate());
            map.put("startTime", s.getStartTime());
            map.put("endTime", s.getEndTime());

            map.put("status", s.getStatusStr());

            // 확정 회원
            if (s.getMember() != null) {
                map.put("memberName", s.getMember().getUser().getName());
                map.put("memberId", s.getMember().getId());
            }
            // 신청자 이름 목록
            map.put(
                    "requestorNames",
                    requestMap.getOrDefault(
                            s.getId(),
                            Collections.emptyList()
                    )
            );
            return map;

        }).collect(Collectors.toList());
    }

    // 슬롯 생성 (트레이너용)
    public void generateSlotsForTrainer(String auth, List<Map<String, String>> customDayTimes) {
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserIdWithMembers(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        // 슬롯 생성은 별도 트랜잭션으로 커밋 완료 후 알림 전송
        generateSlotsInTransaction(trainer, customDayTimes);

        // 트랜잭션 커밋 후 알림 전송 (알림 실패가 슬롯 생성 롤백하지 않도록 분리)
        if (trainer.getMembers() != null) {
            for (Member member : trainer.getMembers()) {
                try {
                    notificationService.sendNotification(
                            member.getUser(),
                            "SCHEDULE_OPEN",
                            "다음 주 수업 신청이 오픈됐어요!",
                            "SCHEDULE_OPEN",
                            null
                    );
                } catch (Exception e) {
                    System.out.println("알림 전송 실패 (회원 " + member.getId() + "): " + e.getMessage());
                }
            }
        }
    }

    @Transactional
    public void generateSlotsInTransaction(Trainer trainer, List<Map<String, String>> customDayTimes) {
        generateNextWeekSlots(trainer, customDayTimes);
    }

    // 슬롯 직접 생성 및 확정 (트레이너용 - 직접 일정 추가)
    @Transactional
    public void createAndConfirm(String auth, String dateStr, String startTimeStr, Long memberId) {
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원 없음"));

        LocalDate date = LocalDate.parse(dateStr);
        LocalTime startTime = LocalTime.parse(startTimeStr);
        LocalTime endTime = startTime.plusHours(1);

        // 기존 OPEN 슬롯이 있으면 재사용, 없으면 새로 생성 (중복 방지)
        Schedule schedule = scheduleRepository
                .findByTrainerAndDateAndStatus(trainer, date, "OPEN")
                .stream()
                .filter(s -> s.getStartTime().equals(startTime))
                .findFirst()
                .orElseGet(() -> {
                    Schedule s = new Schedule();
                    s.setTrainer(trainer);
                    s.setDate(date);
                    s.setStartTime(startTime);
                    s.setEndTime(endTime);
                    return s;
                });

        schedule.setStatus(Schedule.Status.CONFIRMED);
        schedule.setMember(member);
        scheduleRepository.save(schedule);

        // PT 횟수 차감
        if (member.getPtRemaining() != null && member.getPtRemaining() > 0) {
            member.setPtRemaining(member.getPtRemaining() - 1);
            memberRepository.save(member);
        }

        // 회원에게 수업 확정 알림 + FCM 푸시
        notificationService.sendNotification(
                member.getUser(),
                "SCHEDULE_CONFIRM",
                "수업이 확정됐어요! " + date + " " + startTime + " · PT 잔여 " + member.getPtRemaining() + "회",
                "SCHEDULE",
                schedule.getId()
        );
    }

    // 확정 수업 취소 (트레이너용)
    @Transactional
    public void cancelConfirmed(String auth, Long scheduleId) {
        User user = getUserFromAuth(auth);

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯 없음"));

        Member member = schedule.getMember();

        schedule.setStatus(Schedule.Status.OPEN);
        schedule.setMember(null);
        scheduleRepository.save(schedule);

        scheduleRequestRepository.findByScheduleAndMember(schedule, member)
                .ifPresent(scheduleRequestRepository::delete);

        // PT 횟수 복구
        if (member != null && member.getPtRemaining() != null) {
            member.setPtRemaining(member.getPtRemaining() + 1);
            memberRepository.save(member);
        }

        // 회원에게 수업 취소 알림 + FCM 푸시
        if (member != null) {
            notificationService.sendNotification(
                    member.getUser(),
                    "SCHEDULE_CANCEL",
                    "수업이 취소됐어요. " + schedule.getDate() + " " + schedule.getStartTime() + " · PT 잔여 " + member.getPtRemaining() + "회",
                    "SCHEDULE",
                    scheduleId
            );
        }
    }

    // 오늘 수업 목록 (트레이너 홈용)
    public List<Map<String, Object>> getTodaySchedules(String auth) {
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        return scheduleRepository.findTodayConfirmedWithMember(trainer, LocalDate.now())
                .stream()
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("scheduleId", s.getId());
                    m.put("memberId", s.getMember() != null ? s.getMember().getId() : null);
                    m.put("memberName", s.getMember() != null ? s.getMember().getUser().getName() : "미정");
                    m.put("startTime", s.getStartTime());
                    m.put("endTime", s.getEndTime());
                    m.put("status", s.getStatusStr());
                    return m;
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public void generateNextWeekSlots(Trainer trainer) {
        generateNextWeekSlots(trainer, null);
    }

    @Transactional
    public void generateNextWeekSlots(Trainer trainer, List<Map<String, String>> customDayTimes) {
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Long> existingIds = scheduleRepository
                .findByTrainerAndDateBetween(trainer, nextMonday, nextSunday)
                .stream().map(Schedule::getId).collect(Collectors.toList());

        if (!existingIds.isEmpty()) {
            scheduleRequestRepository.detachScheduleIds(existingIds);
            scheduleRequestRepository.deleteByScheduleIds(existingIds);
            scheduleRepository.deleteOpenSlotsByTrainerAndDateBetween(trainer, nextMonday, nextSunday);
        }

        Map<DayOfWeek, List<LocalTime[]>> dayTimeMap = new LinkedHashMap<>();

        if (customDayTimes != null && !customDayTimes.isEmpty()) {
            for (Map<String, String> dt : customDayTimes) {
                DayOfWeek dow = parseDayOfWeek(dt.get("day"));
                LocalTime start = LocalTime.parse(dt.get("start"));
                LocalTime end = LocalTime.parse(dt.get("end"));
                dayTimeMap.computeIfAbsent(dow, k -> new ArrayList<>()).add(new LocalTime[]{start, end});
            }
        } else {
            String workDays = trainer.getWorkDays();
            String startTimeStr = trainer.getStartTime();
            String endTimeStr = trainer.getEndTime();

            if (workDays == null || startTimeStr == null || endTimeStr == null) return;

            LocalTime startTime = LocalTime.parse(startTimeStr);
            LocalTime endTime = LocalTime.parse(endTimeStr);

            for (String day : workDays.split(",")) {
                DayOfWeek dow = parseDayOfWeek(day.trim());
                if (dow != null) dayTimeMap.computeIfAbsent(dow, k -> new ArrayList<>()).add(new LocalTime[]{startTime, endTime});
            }
        }

        List<Schedule> slots = new ArrayList<>();
        for (LocalDate date = nextMonday; !date.isAfter(nextSunday); date = date.plusDays(1)) {
            DayOfWeek dow = date.getDayOfWeek();
            List<LocalTime[]> timeRanges = dayTimeMap.get(dow);
            if (timeRanges == null) continue;
            for (LocalTime[] range : timeRanges) {
                LocalTime cur = range[0];
                while (cur.plusHours(1).compareTo(range[1]) <= 0) {
                    Schedule s = new Schedule();
                    s.setTrainer(trainer);
                    s.setDate(date);
                    s.setStartTime(cur);
                    s.setEndTime(cur.plusHours(1));
                    slots.add(s);
                    cur = cur.plusHours(1);
                }
            }
        }
        scheduleRepository.saveAll(slots);
    }

    private DayOfWeek parseDayOfWeek(String day) {
        return switch (day) {
            case "월" -> DayOfWeek.MONDAY;
            case "화" -> DayOfWeek.TUESDAY;
            case "수" -> DayOfWeek.WEDNESDAY;
            case "목" -> DayOfWeek.THURSDAY;
            case "금" -> DayOfWeek.FRIDAY;
            case "토" -> DayOfWeek.SATURDAY;
            case "일" -> DayOfWeek.SUNDAY;
            default -> null;
        };
    }

    public List<Map<String, Object>> getNextWeekRequests(String auth) {
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Schedule> schedules = scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday);
        List<Long> scheduleIds = schedules.stream().map(Schedule::getId).collect(Collectors.toList());
        if (scheduleIds.isEmpty()) return Collections.emptyList();

        List<ScheduleRequest> requests = scheduleRequestRepository.findPendingRequests(
                scheduleIds, ScheduleRequest.Status.PENDING);

        return requests.stream().map(r -> {
            Map<String, Object> map = new HashMap<>();
            map.put("requestId", r.getId());
            map.put("scheduleId", r.getSchedule().getId());
            map.put("memberId", r.getMember().getId());
            map.put("memberName", r.getMember().getUser().getName());
            map.put("date", r.getSchedule().getDate());
            map.put("startTime", r.getSchedule().getStartTime());
            map.put("endTime", r.getSchedule().getEndTime());
            map.put("status", r.getStatus().name());
            return map;
        }).collect(Collectors.toList());
    }

    private User getUserFromAuth(String auth) {
        String token = auth.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저 없음"));
    }
}