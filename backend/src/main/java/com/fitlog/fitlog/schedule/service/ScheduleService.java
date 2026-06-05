package com.fitlog.fitlog.schedule.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.service.NotificationService;


import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;

import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
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
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final ManualMemberRepository manualMemberRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public ScheduleService(ScheduleRepository scheduleRepository,
                           TrainerRepository trainerRepository,
                           MemberRepository memberRepository,
                           ManualMemberRepository manualMemberRepository,
                           JwtService jwtService,
                           UserRepository userRepository,
                           NotificationService notificationService) {
        this.scheduleRepository = scheduleRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.manualMemberRepository = manualMemberRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    // 슬롯 조회 (회원용)
    // 다음 주 내 확정 수업 조회 (회원용) — 트레이너가 직접 확정한 수업만 반환
    public List<Map<String, Object>> getNextWeekSlotsForMember(String auth) {
        User user = getUserFromAuth(auth);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보 없음"));
        Trainer trainer = member.getTrainer();
        if (trainer == null) return Collections.emptyList();

        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        return scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday)
                .stream()
                .filter(s -> s.getMember() != null && s.getMember().getId().equals(member.getId()))
                .filter(s -> "CONFIRMED".equals(s.getStatusStr()) || "COMPLETED".equals(s.getStatusStr()))
                .sorted(Comparator.comparing(Schedule::getDate).thenComparing(Schedule::getStartTime))
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("scheduleId", s.getId());
                    map.put("date", s.getDate());
                    map.put("startTime", s.getStartTime());
                    map.put("endTime", s.getEndTime());
                    map.put("status", "MINE");
                    return map;
                })
                .collect(Collectors.toList());
    }

    // ── 아래 requestSlot / cancelRequest / getRequestsBySlot / confirmRequest / sendScheduleOpenNotifications / getNextWeekRequests 제거됨 (트레이너 전용 운영으로 전환) ──

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

        // 최종 응답 생성
        return schedules.stream().map(s -> {

            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("scheduleId", s.getId());
            map.put("date", s.getDate());
            map.put("startTime", s.getStartTime());
            map.put("endTime", s.getEndTime());
            map.put("status", s.getStatusStr());
            map.put("sessionType", s.getSessionType());
            if (s.getNote() != null) map.put("note", s.getNote());

            if (s.getMember() != null) {
                map.put("memberName", s.getMember().getUser().getName());
                map.put("memberId", s.getMember().getId());
                map.put("ptRemaining", s.getMember().getPtRemaining());
                map.put("ptTotal",     s.getMember().getPtTotal());
            } else if (s.getManualMember() != null) {
                map.put("memberName",     s.getManualMember().getName());
                map.put("manualMemberId", s.getManualMember().getId());
                map.put("ptRemaining",    s.getManualMember().getPtRemaining());
                map.put("ptTotal",        s.getManualMember().getPtTotal());
            }
            return map;

        }).collect(Collectors.toList());
    }

    // ─── 월간 캘린더 조회 (트레이너용) ───────────────────────────────────────
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getMonthlyCalendar(String auth, String yearMonth) {
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        LocalDate monthStart = LocalDate.parse(yearMonth + "-01");
        LocalDate monthEnd   = monthStart.withDayOfMonth(monthStart.lengthOfMonth());

        List<Schedule> schedules = scheduleRepository.findByTrainerIdAndDateBetweenWithMember(
                trainer.getId(), monthStart, monthEnd);

        return schedules.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id",          s.getId());
            map.put("scheduleId",  s.getId());
            map.put("date",        s.getDate());
            map.put("startTime",   s.getStartTime());
            map.put("endTime",     s.getEndTime());
            map.put("status",      s.getStatusStr());
            map.put("sessionType", s.getSessionType());
            if (s.getNote() != null) map.put("note", s.getNote());
            if (s.getMember() != null) {
                map.put("memberName",  s.getMember().getUser().getName());
                map.put("memberId",    s.getMember().getId());
                map.put("isManual",    false);
                map.put("ptRemaining", s.getMember().getPtRemaining());
                map.put("ptTotal",     s.getMember().getPtTotal());
            } else if (s.getManualMember() != null) {
                map.put("memberName",     s.getManualMember().getName());
                map.put("manualMemberId", s.getManualMember().getId());
                map.put("isManual",       true);
                map.put("ptRemaining",    s.getManualMember().getPtRemaining());
                map.put("ptTotal",        s.getManualMember().getPtTotal());
            }
            return map;
        }).collect(Collectors.toList());
    }

    // 이번 주 슬롯 생성 (최초 진입 시)
    @Transactional
    public void generateCurrentWeekSlotsForTrainer(String auth) {
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));
        generateCurrentWeekSlotsIfAbsent(trainer);
    }

    // 슬롯 생성 (트레이너용)
    @Transactional
    public List<Long> generateSlotsForTrainer(String auth, List<Map<String, String>> customDayTimes) {
        User user = getUserFromAuth(auth);
        // 회원 목록을 영속성 컨텍스트에 올리지 않는 경량 쿼리 사용
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        // 첫 가입(슬롯이 전혀 없음): 이번 주 슬롯도 함께 생성
        LocalDate thisMonday = LocalDate.now().with(DayOfWeek.MONDAY);
        LocalDate thisSunday = thisMonday.plusDays(6);
        boolean noSlotsAtAll = scheduleRepository
                .findIdsByTrainerAndDateBetween(trainer, thisMonday, thisSunday)
                .isEmpty();
        if (noSlotsAtAll) {
            generateCurrentWeekSlotsIfAbsent(trainer);
        }

        generateNextWeekSlots(trainer, customDayTimes);

        // 트랜잭션 커밋 전에 ID만 조회 (member/user 엔티티를 컨텍스트에 올리지 않음)
        return memberRepository.findActiveMemberIdsByTrainerId(trainer.getId());
    }

    // 슬롯 직접 생성 및 확정 (트레이너용 - 직접 일정 추가)
    // memberId: 연동 회원 / manualMemberId: 미연동 회원 (둘 중 하나만 전달)
    @Transactional
    public void createAndConfirm(String auth, String dateStr, String startTimeStr,
                                 Long memberId, Long manualMemberId, String sessionType, String note) {
        boolean isOt = "OT".equalsIgnoreCase(sessionType);
        boolean isPersonal = "PERSONAL_WORKOUT".equalsIgnoreCase(sessionType)
                          || "PERSONAL_SCHEDULE".equalsIgnoreCase(sessionType);
        User user = getUserFromAuth(auth);
        Trainer trainer = trainerRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        LocalDate date = LocalDate.parse(dateStr);
        LocalTime startTime = LocalTime.parse(startTimeStr);
        LocalTime endTime = startTime.plusHours(1);

        // 기존 OPEN 슬롯 재사용 or 신규 생성
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
        schedule.setSessionType(sessionType != null ? sessionType.toUpperCase() : "PT");
        if (note != null && !note.isBlank()) schedule.setNote(note.trim());

        // ── 개인운동 / 개인일정: 회원 없이 바로 저장 ──
        if (isPersonal) {
            schedule.setMember(null);
            schedule.setManualMember(null);
            scheduleRepository.save(schedule);
            return;
        }

        if (manualMemberId != null) {
            // ── 미연동 회원 ──
            ManualMember manual = manualMemberRepository.findById(manualMemberId)
                    .orElseThrow(() -> new RuntimeException("미연동 회원 없음"));
            schedule.setManualMember(manual);
            schedule.setMember(null);
            scheduleRepository.save(schedule);
            // (SOLAPI 제거 — 카카오 공유하기로 대체)
        } else {
            // ── 연동 회원 ──
            Member member = memberRepository.findById(memberId)
                    .orElseThrow(() -> new RuntimeException("회원 없음"));
            schedule.setMember(member);
            schedule.setManualMember(null);
            scheduleRepository.save(schedule);

            if (member.getNotifSchedule()) {
                notificationService.sendNotification(
                        member.getUser(),
                        "SCHEDULE_CONFIRM",
                        formatDate(date.toString()) + " " + startTime + " 수업이 확정됐어요.",
                        "SCHEDULE",
                        schedule.getId()
                );
            }
        }
    }

    // 확정 수업 취소 (트레이너용)
    @Transactional
    public void cancelConfirmed(String auth, Long scheduleId) {
        User user = getUserFromAuth(auth);

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯 없음"));

        Member member = schedule.getMember();
        ManualMember manualMember = schedule.getManualMember();
        boolean wasNoShow = "NO_SHOW".equals(schedule.getStatusStr());

        schedule.setStatus(Schedule.Status.OPEN);
        schedule.setMember(null);
        schedule.setManualMember(null);
        scheduleRepository.save(schedule);

        if (member != null) {
            // 노쇼 취소 시 PT 복구
            if (wasNoShow && member.getPtRemaining() != null) {
                member.setPtRemaining(member.getPtRemaining() + 1);
                member.setPtEndedAt(null);
                memberRepository.save(member);
            }
            // FCM 알림
            if (member.getNotifSchedule()) {
                notificationService.sendNotification(
                        member.getUser(),
                        "SCHEDULE_CANCEL",
                        formatDate(schedule.getDate().toString()) + " " + schedule.getStartTime() + " 수업이 취소됐어요.",
                        "SCHEDULE",
                        scheduleId
                );
            }
        }
        // 미연동 회원 노쇼 취소 시 PT 복구
        if (manualMember != null && wasNoShow && manualMember.getPtRemaining() != null) {
            manualMember.setPtRemaining(manualMember.getPtRemaining() + 1);
            manualMember.setPtEndedAt(null);
            manualMemberRepository.save(manualMember);
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

    // 트레이너 계정 최초 생성 시 이번주 슬롯 자동 생성
    @Transactional
    public void generateCurrentWeekSlotsIfAbsent(Trainer trainer) {
        LocalDate monday = LocalDate.now().with(DayOfWeek.MONDAY);
        LocalDate sunday = monday.plusDays(6);

        boolean alreadyExists = scheduleRepository
                .findIdsByTrainerAndDateBetween(trainer, monday, sunday)
                .isEmpty();
        if (!alreadyExists) return;

        String workDays    = trainer.getWorkDays();
        String startTimeStr = trainer.getStartTime();
        String endTimeStr   = trainer.getEndTime();
        if (workDays == null || startTimeStr == null || endTimeStr == null) return;

        LocalTime startTime = LocalTime.parse(startTimeStr);
        LocalTime endTime   = LocalTime.parse(endTimeStr);
        int offset = trainer.getSlotOffset() != null ? trainer.getSlotOffset() : 0;

        Map<DayOfWeek, LocalTime[]> dayTimeMap = new LinkedHashMap<>();
        for (String day : workDays.split(",")) {
            DayOfWeek dow = parseDayOfWeek(day.trim());
            if (dow != null) dayTimeMap.put(dow, new LocalTime[]{startTime, endTime});
        }

        Trainer managedTrainer = trainerRepository.getReferenceById(trainer.getId());
        List<Schedule> slots = new ArrayList<>();
        for (LocalDate date = monday; !date.isAfter(sunday); date = date.plusDays(1)) {
            LocalTime[] range = dayTimeMap.get(date.getDayOfWeek());
            if (range == null) continue;
            LocalTime first = range[0].withMinute(offset).withSecond(0).withNano(0);
            if (first.isBefore(range[0])) first = first.plusHours(1);
            LocalTime cur = first;
            while (cur.isBefore(range[1])) {
                Schedule s = new Schedule();
                s.setTrainer(managedTrainer);
                s.setDate(date);
                s.setStartTime(cur);
                s.setEndTime(cur.plusHours(1));
                slots.add(s);
                cur = cur.plusHours(1);
            }
        }
        scheduleRepository.saveAll(slots);
    }

    @Transactional
    public void generateNextWeekSlots(Trainer trainer, List<Map<String, String>> customDayTimes) {
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Long> existingIds = scheduleRepository
                .findIdsByTrainerAndDateBetween(trainer, nextMonday, nextSunday);

        if (!existingIds.isEmpty()) {
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

        // @Modifying(clearAutomatically=true)가 PC를 클리어하므로, saveAll 전에 proxy로 재획득
        Trainer managedTrainer = trainerRepository.getReferenceById(trainer.getId());

        // slotOffset: 0=정각(:00), 30=30분(:30), null=기본(정각)
        int offset = trainer.getSlotOffset() != null ? trainer.getSlotOffset() : 0;

        List<Schedule> slots = new ArrayList<>();
        for (LocalDate date = nextMonday; !date.isAfter(nextSunday); date = date.plusDays(1)) {
            DayOfWeek dow = date.getDayOfWeek();
            List<LocalTime[]> timeRanges = dayTimeMap.get(dow);
            if (timeRanges == null) continue;
            for (LocalTime[] range : timeRanges) {
                // 시작 시간의 시(hour)를 기준으로 offset 분 적용
                // 예) startTime=10:00, offset=30 → 첫 슬롯 10:30
                // 예) startTime=10:30, offset=30 → 첫 슬롯 10:30 (이미 맞음)
                LocalTime first = range[0].withMinute(offset).withSecond(0).withNano(0);
                if (first.isBefore(range[0])) first = first.plusHours(1);
                LocalTime cur = first;
                while (cur.isBefore(range[1])) {
                    Schedule s = new Schedule();
                    s.setTrainer(managedTrainer);
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

    // ── 자동 오픈 cron 용 ─────────────────────────────────────────────────────
    // 다음 주 OPEN 슬롯이 없을 때만 트레이너 기본 설정으로 생성, 회원 ID 반환
    @Transactional
    public List<Long> autoOpenNextWeekIfNotOpen(Trainer trainer) {
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        // 이미 OPEN 슬롯 있으면 스킵 (수동 오픈 또는 이전 cron 실행)
        if (scheduleRepository.existsOpenSlotsByTrainerAndDateBetween(trainer, nextMonday, nextSunday)) {
            return Collections.emptyList();
        }
        // 근무 시간 설정 없으면 스킵
        if (trainer.getWorkDays() == null || trainer.getStartTime() == null || trainer.getEndTime() == null) {
            return Collections.emptyList();
        }

        generateNextWeekSlots(trainer, null);
        return memberRepository.findActiveMemberIdsByTrainerId(trainer.getId());
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


    private User getUserFromAuth(String auth) {
        String token = auth.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저 없음"));
    }

    private String formatDate(String date) {
        try {
            String[] parts = date.split("-");
            int month = Integer.parseInt(parts[1]);
            int day = Integer.parseInt(parts[2]);
            return month + "월 " + day + "일";
        } catch (Exception e) {
            return date;
        }
    }
}