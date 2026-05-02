package com.fitlog.fitlog.service;

import com.fitlog.fitlog.dto.ScheduleRequest;
import com.fitlog.fitlog.entity.*;
import com.fitlog.fitlog.repository.*;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Service
public class ScheduleService {

    private final ScheduleRepository scheduleRepository;
    private final ScheduleRequestRepository scheduleRequestRepository;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public ScheduleService(
            ScheduleRepository scheduleRepository,
            ScheduleRequestRepository scheduleRequestRepository,
            TrainerRepository trainerRepository,
            MemberRepository memberRepository,
            UserRepository userRepository,
            JwtService jwtService
    ) {
        this.scheduleRepository = scheduleRepository;
        this.scheduleRequestRepository = scheduleRequestRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    // ── 다음 주 슬롯 자동 생성 (트레이너 출근 시간 기반) ─────────────────
    public void generateNextWeekSlots(Trainer trainer) {
        LocalDate nextMonday = LocalDate.now()
                .with(DayOfWeek.MONDAY)
                .plusWeeks(1);

        // 출근 날짜 파싱 ("월,화,수,목,금")
        List<String> workDays = Arrays.asList(trainer.getWorkDays().split(","));
        Map<String, DayOfWeek> dayMap = Map.of(
                "월", DayOfWeek.MONDAY, "화", DayOfWeek.TUESDAY,
                "수", DayOfWeek.WEDNESDAY, "목", DayOfWeek.THURSDAY,
                "금", DayOfWeek.FRIDAY, "토", DayOfWeek.SATURDAY,
                "일", DayOfWeek.SUNDAY
        );

        // 출근~퇴근 1시간 단위 슬롯 생성
        LocalTime start = LocalTime.parse(trainer.getStartTime());
        LocalTime end = LocalTime.parse(trainer.getEndTime());

        for (String dayStr : workDays) {
            DayOfWeek dow = dayMap.get(dayStr.trim());
            if (dow == null) continue;

            LocalDate slotDate = nextMonday.with(dow);
            LocalTime cursor = start;

            while (cursor.plusHours(1).compareTo(end) <= 0) {
                // 중복 생성 방지
                LocalDate finalSlotDate = slotDate;
                LocalTime finalCursor = cursor;
                boolean exists = scheduleRepository
                        .findByTrainerAndDate(trainer, slotDate)
                        .stream()
                        .anyMatch(s -> s.getStartTime().equals(finalCursor));

                if (!exists) {
                    Schedule slot = new Schedule();
                    slot.setTrainer(trainer);
                    slot.setDate(slotDate);
                    slot.setStartTime(cursor);
                    slot.setEndTime(cursor.plusHours(1));
                    slot.setStatus(Schedule.Status.OPEN);
                    scheduleRepository.save(slot);
                }
                cursor = cursor.plusHours(1);
            }
        }
    }

    // ── 회원: 슬롯 목록 조회 (이번주 + 다음주) ───────────────────────────
    public List<Schedule> getSlotsForMember(String token) {
        User user = getUserFromToken(token);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));

        Trainer trainer = member.getTrainer();
        if (trainer == null) throw new RuntimeException("연결된 트레이너가 없습니다.");

        LocalDate today = LocalDate.now();
        LocalDate twoWeeksLater = today.plusWeeks(2);
        return scheduleRepository.findByTrainerAndDateBetween(trainer, today, twoWeeksLater);
    }

    // ── 회원: 희망 시간 신청 (중복 선택 가능) ────────────────────────────
    public void requestSlot(String token, Long scheduleId) {
        User user = getUserFromToken(token);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));

        if (schedule.getStatus() == Schedule.Status.CONFIRMED)
            throw new RuntimeException("이미 확정된 슬롯입니다.");

        if (scheduleRequestRepository.existsByScheduleAndMember(schedule, member))
            throw new RuntimeException("이미 신청한 슬롯입니다.");

        ScheduleRequest req = new ScheduleRequest();
        req.setSchedule(schedule);
        req.setMember(member);
        req.setStatus(ScheduleRequest.Status.PENDING);
        scheduleRequestRepository.save(req);

        // 슬롯 상태 → REQUESTED
        schedule.setStatus(Schedule.Status.REQUESTED);
        scheduleRepository.save(schedule);
    }

    // ── 회원: 신청 취소 ──────────────────────────────────────────────────
    public void cancelRequest(String token, Long scheduleId) {
        User user = getUserFromToken(token);
        Member member = memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));

        ScheduleRequest req = scheduleRequestRepository
                .findByScheduleAndMember(schedule, member)
                .orElseThrow(() -> new RuntimeException("신청 내역이 없습니다."));

        scheduleRequestRepository.delete(req);

        // 신청자 없으면 OPEN으로 되돌리기
        List<ScheduleRequest> remaining = scheduleRequestRepository.findBySchedule(schedule);
        if (remaining.isEmpty()) {
            schedule.setStatus(Schedule.Status.OPEN);
            scheduleRepository.save(schedule);
        }
    }

    // ── 트레이너: 슬롯별 신청자 목록 조회 ───────────────────────────────
    public List<ScheduleRequest> getRequestsBySlot(String token, Long scheduleId) {
        getUserFromToken(token); // 트레이너 검증
        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));
        return scheduleRequestRepository.findBySchedule(schedule);
    }

    // ── 트레이너: 회원 픽스 확정 ─────────────────────────────────────────
    public void confirmRequest(String token, Long scheduleId, Long memberId) {
        getUserFromToken(token); // 트레이너 검증

        Schedule schedule = scheduleRepository.findById(scheduleId)
                .orElseThrow(() -> new RuntimeException("슬롯을 찾을 수 없습니다."));

        List<ScheduleRequest> allRequests = scheduleRequestRepository.findBySchedule(schedule);

        for (ScheduleRequest req : allRequests) {
            if (req.getMember().getId().equals(memberId)) {
                req.setStatus(ScheduleRequest.Status.CONFIRMED);
            } else {
                req.setStatus(ScheduleRequest.Status.REJECTED);
            }
            scheduleRequestRepository.save(req);
        }

        schedule.setStatus(Schedule.Status.CONFIRMED);
        scheduleRepository.save(schedule);
    }

    // ── 트레이너: 슬롯 수동 생성 (토큰으로 본인 슬롯 생성) ──────────────
    public void generateSlotsForTrainer(String authorization) {
        User user = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        generateNextWeekSlots(trainer);
    }

    // ── 트레이너: 캘린더 주간 슬롯 조회 ─────────────────────────────────
    public List<Schedule> getWeeklyCalendar(String authorization, LocalDate weekStart) {
        User user = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        return scheduleRepository.findByTrainerAndDateBetween(
                trainer, weekStart, weekStart.plusDays(6)
        );
    }

    // ── 공통 ─────────────────────────────────────────────────────────────
    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }
}