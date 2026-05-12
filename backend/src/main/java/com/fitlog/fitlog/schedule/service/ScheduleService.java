package com.fitlog.fitlog.schedule.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.entity.Notification;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRequestRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;

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
    private final NotificationRepository notificationRepository;
    private final JwtService jwtService;

    public ScheduleService(ScheduleRepository scheduleRepository,
                           ScheduleRequestRepository scheduleRequestRepository,
                           TrainerRepository trainerRepository,
                           MemberRepository memberRepository,
                           NotificationRepository notificationRepository,
                           JwtService jwtService) {
        this.scheduleRepository = scheduleRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.notificationRepository = notificationRepository;
        this.jwtService = jwtService;
    }

    // ── 회원: 이번 주 확정 수업 조회 ─────────────────────────────────────
    public List<Map<String, Object>> getMyThisWeekSchedules(String authorization) {
        Member member = getMemberFromToken(authorization);

        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.with(DayOfWeek.SUNDAY);

        return scheduleRequestRepository
                .findThisWeekConfirmedByMemberId(
                        member.getId(),
                        ScheduleRequest.Status.CONFIRMED,
                        today,
                        weekEnd
                )
                .stream()
                .map(r -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("scheduleId", r.getSchedule().getId());
                    map.put("date", r.getSchedule().getDate().toString());
                    map.put("startTime", r.getSchedule().getStartTime() != null
                            ? r.getSchedule().getStartTime().toString().substring(0, 5)
                            : "");
                    map.put("endTime", r.getSchedule().getEndTime() != null
                            ? r.getSchedule().getEndTime().toString().substring(0, 5)
                            : "");
                    return map;
                })
                .collect(Collectors.toList());
    }

    // ── 회원: 다음 주 슬롯 조회 ──────────────────────────────────────────
    public List<Map<String, Object>> getNextWeekSlotsForMember(String authorization) {
        Member member = getMemberFromToken(authorization);
        Trainer trainer = member.getTrainer();
        if (trainer == null) throw new RuntimeException("연결된 트레이너가 없습니다.");

        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Schedule> slots = scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday);
        if (slots.isEmpty()) {
            generateNextWeekSlots(trainer);
            slots = scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday);
        }

        List<ScheduleRequest> myRequests = scheduleRequestRepository.findByMember(member);
        Map<Long, ScheduleRequest.Status> myRequestMap = myRequests.stream()
                .collect(Collectors.toMap(
                        r -> r.getSchedule().getId(),
                        ScheduleRequest::getStatus,
                        (a, b) -> a
                ));

        return slots.stream()
                .sorted(Comparator.comparing(Schedule::getDate).thenComparing(s ->
                        s.getStartTime() != null ? s.getStartTime() : LocalTime.MIN))
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id",        s.getId());
                    map.put("date",      s.getDate().toString());
                    map.put("startTime", s.getStartTime() != null ? s.getStartTime().toString().substring(0, 5) : "");
                    map.put("endTime",   s.getEndTime() != null ? s.getEndTime().toString().substring(0, 5) : "");
                    ScheduleRequest.Status reqStatus = myRequestMap.get(s.getId());
                    String myStatus;
                    if (reqStatus == ScheduleRequest.Status.CONFIRMED)    myStatus = "MINE";
                    else if (reqStatus == ScheduleRequest.Status.PENDING) myStatus = "REQUESTED";
                    else if ("CONFIRMED".equals(s.getStatusStr()))        myStatus = "FULL";
                    else                                                   myStatus = "OPEN";
                    map.put("status", myStatus);
                    return map;
                })
                .collect(Collectors.toList());
    }

    // ── 다음 주 슬롯 자동 생성 ───────────────────────────────────────────
    public void generateNextWeekSlots(Trainer trainer) {
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Schedule> existing = scheduleRepository.findByTrainerAndDateBetween(trainer, nextMonday, nextSunday);
        Set<String> existingKeys = existing.stream()
                .map(s -> s.getDate() + "_" + s.getStartTime())
                .collect(Collectors.toSet());

        if (trainer.getWorkDays() == null) return;
        List<String> workDays = Arrays.asList(trainer.getWorkDays().split(","));
        Map<String, DayOfWeek> dayMap = Map.of(
                "월", DayOfWeek.MONDAY, "화", DayOfWeek.TUESDAY,
                "수", DayOfWeek.WEDNESDAY, "목", DayOfWeek.THURSDAY,
                "금", DayOfWeek.FRIDAY, "토", DayOfWeek.SATURDAY,
                "일", DayOfWeek.SUNDAY
        );

        LocalTime start = trainer.getStartTime() != null ? LocalTime.parse(trainer.getStartTime()) : LocalTime.of(9, 0);
        LocalTime end   = trainer.getEndTime()   != null ? LocalTime.parse(trainer.getEndTime())   : LocalTime.of(18, 0);
        List<Schedule> toSave = new ArrayList<>();

        for (String dayStr : workDays) {
            DayOfWeek dow = dayMap.get(dayStr.trim());
            if (dow == null) continue;
            LocalDate slotDate = nextMonday.with(dow);
            LocalTime cursor   = start;
            while (cursor.plusHours(1).compareTo(end) <= 0) {
                String key = slotDate + "_" + cursor;
                if (!existingKeys.contains(key)) {
                    Schedule slot = new Schedule();
                    slot.setTrainer(trainer);
                    slot.setDate(slotDate);
                    slot.setStartTime(cursor);
                    slot.setEndTime(cursor.plusHours(1));
                    slot.setStatusStr("OPEN");
                    toSave.add(slot);
                    existingKeys.add(key);
                }
                cursor = cursor.plusHours(1);
            }
        }
        if (!toSave.isEmpty()) scheduleRepository.saveAll(toSave);
    }

    // ── 회원: 슬롯 목록 조회 ─────────────────────────────────────────────
    public List<Schedule> getSlotsForMember(String token) {
        Member member = getMemberFromToken(token);
        Trainer trainer = member.getTrainer();
        if (trainer == null) throw new RuntimeException("연결된 트레이너가 없습니다.");
        LocalDate today = LocalDate.now();
        return scheduleRepository.findByTrainerAndDateBetween(trainer, today, today.plusWeeks(2));
    }

    // ── 회원: 수업 신청 ───────────────────────────────────────────────────
    @org.springframework.transaction.annotation.Transactional
    public void requestSlot(String token, Long scheduleId) {
        String userIdToken = token.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(userIdToken);

        Member member = memberRepository.findLightByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));

        if ("CONFIRMED".equals(schedule.getStatusStr())) {
            throw new RuntimeException("이미 확정된 슬롯입니다.");
        }

        if (scheduleRequestRepository.existsByScheduleAndMember(schedule, member)) {
            throw new RuntimeException("이미 신청한 슬롯입니다.");
        }

        ScheduleRequest req = new ScheduleRequest();
        req.setSchedule(schedule);
        req.setMember(member);
        req.setStatus(ScheduleRequest.Status.PENDING);
        scheduleRequestRepository.save(req);

        schedule.setStatusStr("REQUESTED");
        scheduleRepository.save(schedule);

        // 같은 회원이 다음 주 수업을 여러 개 신청해도 트레이너 알림은 최초 1번만 전송
        if (schedule.getTrainer() != null && schedule.getTrainer().getUser() != null) {
            LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
            LocalDate nextSunday = nextMonday.plusDays(6);

            long nextWeekPendingRequestCount = scheduleRequestRepository.findByMember(member).stream()
                    .filter(r -> r.getStatus() == ScheduleRequest.Status.PENDING)
                    .filter(r -> r.getSchedule() != null && r.getSchedule().getDate() != null)
                    .filter(r -> {
                        LocalDate d = r.getSchedule().getDate();
                        return !d.isBefore(nextMonday) && !d.isAfter(nextSunday);
                    })
                    .count();

            if (nextWeekPendingRequestCount == 1) {
                Notification notification = new Notification();
                notification.setUser(schedule.getTrainer().getUser());
                notification.setType("SCHEDULE_REQUEST");
                notification.setContent(member.getUser().getName() + " 회원이 PT 수업을 신청했어요.");
                notification.setTargetType("SCHEDULE");
                notification.setTargetId(schedule.getId());

                notificationRepository.save(notification);
            }
        }
    }

    // ── 회원: 신청 취소 ───────────────────────────────────────────────────
    public void cancelRequest(String token, Long scheduleId) {
        Member member = getMemberFromToken(token);
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));
        ScheduleRequest req = scheduleRequestRepository.findByScheduleAndMember(schedule, member)
                .orElseThrow(() -> new RuntimeException("신청 내역이 없습니다."));
        scheduleRequestRepository.delete(req);

        // 취소 시 member_id도 null로
        schedule.setMember(null);
        if (scheduleRequestRepository.findBySchedule(schedule).isEmpty()) {
            schedule.setStatusStr("OPEN");
        }
        scheduleRepository.save(schedule);

        // 수업 신청 취소 알림: 회원 -> 트레이너
        if (schedule.getTrainer() != null && schedule.getTrainer().getUser() != null) {
            Notification notification = new Notification();
            notification.setUser(schedule.getTrainer().getUser());
            notification.setType("SCHEDULE_CANCEL_REQ");
            notification.setContent(member.getUser().getName() + " 회원이 PT 수업 신청을 취소했어요.");
            notification.setTargetType("SCHEDULE");
            notification.setTargetId(schedule.getId());

            notificationRepository.save(notification);
        }
    }

    // ── 트레이너: 신청자 목록 ─────────────────────────────────────────────
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Map<String, Object>> getRequestsBySlot(String token, Long scheduleId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));
        return scheduleRequestRepository.findBySchedule(schedule).stream()
                .map(r -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", r.getId());
                    m.put("status", r.getStatus().name());
                    Map<String, Object> member = new HashMap<>();
                    member.put("id", r.getMember().getId());
                    member.put("ptRemaining", r.getMember().getPtRemaining());
                    Map<String, Object> user = new HashMap<>();
                    user.put("id", r.getMember().getId());
                    user.put("name", r.getMember().getUser().getName());
                    member.put("user", user);
                    m.put("member", member);
                    return m;
                }).collect(Collectors.toList());
    }

    // ── 트레이너: 수업 확정 ───────────────────────────────────────────────
    @org.springframework.transaction.annotation.Transactional
    public void confirmRequest(String token, Long scheduleId, Long memberId) {
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));
        Member confirmedMember = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        schedule.setMember(confirmedMember);
        schedule.setStatusStr("CONFIRMED");
        scheduleRepository.save(schedule);

        decreasePtRemaining(confirmedMember);

        // member_id 컬럼으로 직접 비교 (lazy loading 없이)
        List<ScheduleRequest> allRequests = scheduleRequestRepository.findBySchedule(schedule);
        allRequests.forEach(req -> req.setStatus(
                req.getMember().getId().equals(memberId)
                        ? ScheduleRequest.Status.CONFIRMED
                        : ScheduleRequest.Status.REJECTED
        ));
        if (!allRequests.isEmpty()) scheduleRequestRepository.saveAll(allRequests);

        // 수업 확정 알림: 트레이너 -> 회원
        Notification notification = new Notification();
        notification.setUser(confirmedMember.getUser());
        notification.setType("SCHEDULE_CONFIRM");
        notification.setContent("PT 수업이 확정됐어요.");
        notification.setTargetType("SCHEDULE");
        notification.setTargetId(schedule.getId());

        notificationRepository.save(notification);
    }

    // ── 트레이너: 슬롯 생성 + 즉시 확정 ──────────────────────────────────
    @org.springframework.transaction.annotation.Transactional
    public void createAndConfirm(String authorization, String dateStr, String startTimeStr, Long memberId) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        LocalDate date = LocalDate.parse(dateStr);
        // "09:00" 또는 "09:00:00" 둘 다 처리
        LocalTime start = startTimeStr.length() == 5
                ? LocalTime.parse(startTimeStr + ":00")
                : LocalTime.parse(startTimeStr);
        LocalTime end   = start.plusHours(1);

        // 이미 있는 슬롯 확인 (시:분만 비교)
        Schedule slot = scheduleRepository.findByTrainerAndDateBetween(trainer, date, date)
                .stream()
                .filter(s -> s.getStartTime() != null
                        && s.getStartTime().getHour() == start.getHour()
                        && s.getStartTime().getMinute() == start.getMinute())
                .findFirst()
                .orElse(null);

        // 없으면 새로 생성
        if (slot == null) {
            slot = new Schedule();
            slot.setTrainer(trainer);
            slot.setDate(date);
            slot.setStartTime(start);
            slot.setEndTime(end);
        }

        // 즉시 확정
        slot.setMember(member);
        slot.setStatusStr("CONFIRMED");
        scheduleRepository.save(slot);

        decreasePtRemaining(member);
    }

    // ── 트레이너: 수업 취소 ───────────────────────────────────────────────
    @org.springframework.transaction.annotation.Transactional
    public void cancelConfirmed(String authorization, Long scheduleId) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));

        // 트레이너 본인 슬롯인지 확인
        if (!schedule.getTrainer().getUser().getId().equals(userId))
            throw new RuntimeException("권한이 없습니다.");

        // 슬롯 초기화 전 취소 대상 회원을 먼저 보관
        Member canceledMember = schedule.getMember();

        schedule.setMember(null);
        schedule.setStatusStr("OPEN");
        scheduleRepository.save(schedule);

        restorePtRemaining(canceledMember);

        // 연관된 schedule_requests 모두 REJECTED 처리
        List<ScheduleRequest> requests = scheduleRequestRepository.findBySchedule(schedule);
        requests.forEach(r -> r.setStatus(ScheduleRequest.Status.REJECTED));
        if (!requests.isEmpty()) scheduleRequestRepository.saveAll(requests);

        // 수업 취소 알림: 트레이너 -> 회원
        if (canceledMember != null && canceledMember.getUser() != null) {
            Notification notification = new Notification();
            notification.setUser(canceledMember.getUser());
            notification.setType("SCHEDULE_CANCEL");
            notification.setContent("확정된 PT 수업이 취소됐어요.");
            notification.setTargetType("SCHEDULE");
            notification.setTargetId(schedule.getId());

            notificationRepository.save(notification);
        }
    }

    // ── 트레이너: 슬롯 수동 생성 ─────────────────────────────────────────
    @org.springframework.transaction.annotation.Transactional
    public void generateSlotsForTrainer(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Schedule> existing = scheduleRepository.findByTrainerAndDateBetween(
                trainer,
                nextMonday,
                nextSunday
        );

        if (!existing.isEmpty()) {
            throw new RuntimeException("이미 다음 주 일정이 오픈되어 있습니다.");
        }

        generateNextWeekSlots(trainer);

        String trainerName = trainer.getUser().getName();
        String content = trainerName + " 트레이너가 다음 주 수업 일정을 오픈했어요! ("
                + nextMonday.getMonthValue() + "/" + nextMonday.getDayOfMonth()
                + "~" + nextSunday.getMonthValue() + "/" + nextSunday.getDayOfMonth() + ")";

        List<Member> members = memberRepository.findAllByTrainer(trainer);

        List<Notification> notis = members.stream()
                .filter(m -> m.getUser() != null)
                .map(m -> {
                    Notification n = new Notification();
                    n.setUser(m.getUser());
                    n.setType("SCHEDULE_OPEN");
                    n.setContent(content);
                    n.setTargetType("SCHEDULE_OPEN");
                    n.setTargetId(null);
                    return n;
                })
                .collect(Collectors.toList());

        if (!notis.isEmpty()) {
            notificationRepository.saveAll(notis);
        }
    }

    // ── 트레이너: 캘린더 주간 조회 ───────────────────────────────────────
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Map<String, Object>> getWeeklyCalendar(String authorization, LocalDate weekStart) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        Long trainerId = trainerRepository.findTrainerIdByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        List<Schedule> schedules =
                scheduleRepository.findByTrainerIdAndDateBetweenWithMember(
                        trainerId,
                        weekStart,
                        weekStart.plusDays(6)
                );
        // schedule_id → 신청자 이름 목록 맵핑 (PENDING 전체)
        List<Long> scheduleIds = schedules.stream().map(Schedule::getId).collect(Collectors.toList());
        Map<Long, List<String>> requestorsMap = new HashMap<>();
        if (!scheduleIds.isEmpty()) {
            scheduleRequestRepository.findPendingRequests(
                            scheduleIds,
                            ScheduleRequest.Status.PENDING
                    )
                    .forEach(r -> requestorsMap
                            .computeIfAbsent(r.getSchedule().getId(), k -> new ArrayList<>())
                            .add(r.getMember().getUser().getName())
                    );
        }

        return schedules.stream().map(s -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id",         s.getId());
            map.put("date",       s.getDate().toString());
            map.put("startTime",  s.getStartTime() != null ? s.getStartTime().toString() : "");
            map.put("endTime",    s.getEndTime()   != null ? s.getEndTime().toString()   : "");
            map.put("status",     s.getStatusStr());
            // CONFIRMED: 확정 회원 이름
            String memberName = null;
            try {
                if (s.getMember() != null) memberName = s.getMember().getUser().getName();
            } catch (Exception ignored) {}
            map.put("memberName", memberName);
            // REQUESTED: 신청자 전체 이름 목록
            map.put("requestorNames", requestorsMap.getOrDefault(s.getId(), Collections.emptyList()));
            return map;
        }).collect(Collectors.toList());
    }

    private void decreasePtRemaining(Member member) {
        if (member == null) return;

        Integer remaining = member.getPtRemaining();
        if (remaining != null && remaining > 0) {
            member.setPtRemaining(remaining - 1);
            memberRepository.save(member);
        }
    }

    private void restorePtRemaining(Member member) {
        if (member == null) return;

        Integer remaining = member.getPtRemaining() != null ? member.getPtRemaining() : 0;
        member.setPtRemaining(remaining + 1);
        memberRepository.save(member);
    }

    // 회원용: JWT → userId → member+trainer 한번에
    private Member getMemberFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        return memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));
    }
}