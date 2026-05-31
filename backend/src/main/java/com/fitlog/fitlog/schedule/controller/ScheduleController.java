package com.fitlog.fitlog.schedule.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.entity.TrainerScheduleMemo;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.repository.TrainerScheduleMemoRepository;
import com.fitlog.fitlog.schedule.service.ScheduleService;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final TrainerScheduleMemoRepository memoRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final ScheduleRepository scheduleRepository;
    private final MemberRepository memberRepository;
    private final ManualMemberRepository manualMemberRepository;

    public ScheduleController(ScheduleService scheduleService,
                              TrainerScheduleMemoRepository memoRepository,
                              TrainerRepository trainerRepository,
                              JwtService jwtService,
                              ScheduleRepository scheduleRepository,
                              MemberRepository memberRepository,
                              ManualMemberRepository manualMemberRepository) {
        this.scheduleService = scheduleService;
        this.memoRepository = memoRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.scheduleRepository = scheduleRepository;
        this.memberRepository = memberRepository;
        this.manualMemberRepository = manualMemberRepository;
    }

    // ─── 회원: 다음 주 확정 수업 조회 ────────────────────────────────────────
    @GetMapping("/next-week-slots")
    public ResponseEntity<List<Map<String, Object>>> getNextWeekSlots(
            @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(scheduleService.getNextWeekSlotsForMember(auth));
    }

    // ─── 트레이너: 주간 캘린더 조회 ──────────────────────────────────────────
    @GetMapping("/calendar")
    public List<Map<String, Object>> getCalendar(
            @RequestHeader("Authorization") String auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return scheduleService.getWeeklyCalendar(auth, weekStart);
    }

    // ─── 트레이너: 다음 주 슬롯 수동 생성 ────────────────────────────────────
    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateSlots(
            @RequestHeader("Authorization") String auth,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            List<Map<String, String>> dayTimes = null;
            if (body != null && body.get("dayTimes") instanceof List) {
                dayTimes = (List<Map<String, String>>) body.get("dayTimes");
            }
            scheduleService.generateSlotsForTrainer(auth, dayTimes);
            return ResponseEntity.ok(Map.of("success", true, "message", "다음 주 일정이 오픈됐어요."));
        } catch (Throwable t) {
            String msg = t.getMessage() != null ? t.getMessage() : "일정 생성 중 오류가 발생했어요.";
            return ResponseEntity.status(500).body(Map.of("success", false, "message", msg));
        }
    }

    // ─── 트레이너: 수업 직접 추가·확정 ───────────────────────────────────────
    @PostMapping("/create-and-confirm")
    public ResponseEntity<Void> createAndConfirm(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> body) {
        String date         = (String) body.get("date");
        String startTime    = (String) body.get("startTime");
        Long memberId       = body.get("memberId")       != null ? ((Number) body.get("memberId")).longValue()       : null;
        Long manualMemberId = body.get("manualMemberId") != null ? ((Number) body.get("manualMemberId")).longValue() : null;
        String sessionType  = body.get("sessionType")   != null ? (String) body.get("sessionType") : "PT";
        String note         = body.get("note")           != null ? (String) body.get("note") : null;
        scheduleService.createAndConfirm(auth, date, startTime, memberId, manualMemberId, sessionType, note);
        return ResponseEntity.ok().build();
    }

    // ─── 트레이너: 노쇼 처리 ─────────────────────────────────────────────────
    @PatchMapping("/{scheduleId}/no-show")
    @Transactional
    public ResponseEntity<Map<String, Object>> markNoShow(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        Schedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null)
            return ResponseEntity.badRequest().body(Map.of("message", "일정을 찾을 수 없습니다."));
        if (!schedule.getTrainer().getId().equals(trainer.getId()))
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        if (!"CONFIRMED".equals(schedule.getStatusStr()))
            return ResponseEntity.badRequest().body(Map.of("message", "확정된 수업만 노쇼 처리할 수 있습니다."));

        schedule.setStatusStr("NO_SHOW");
        scheduleRepository.save(schedule);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ─── 트레이너: 수업 취소 ─────────────────────────────────────────────────
    @DeleteMapping("/confirm/{scheduleId}")
    public ResponseEntity<Void> cancelConfirmed(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        scheduleService.cancelConfirmed(auth, scheduleId);
        return ResponseEntity.ok().build();
    }

    // ─── 트레이너: 수업 완료 처리 ────────────────────────────────────────────
    @PatchMapping("/{scheduleId}/complete")
    @Transactional
    public ResponseEntity<Map<String, Object>> completeSchedule(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        Schedule schedule = scheduleRepository.findById(scheduleId).orElse(null);
        if (schedule == null)
            return ResponseEntity.badRequest().body(Map.of("message", "일정을 찾을 수 없습니다."));
        if (!schedule.getTrainer().getId().equals(trainer.getId()))
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        if (!"CONFIRMED".equals(schedule.getStatusStr()))
            return ResponseEntity.badRequest().body(Map.of("message", "확정된 수업만 완료 처리할 수 있습니다."));

        schedule.setStatusStr("COMPLETED");
        scheduleRepository.save(schedule);

        if (schedule.getMember() != null) {
            Member member = schedule.getMember();
            if (member.getPtRemaining() != null && member.getPtRemaining() > 0) {
                int newRemaining = member.getPtRemaining() - 1;
                member.setPtRemaining(newRemaining);
                if (newRemaining == 0) member.setPtEndedAt(java.time.LocalDate.now());
                memberRepository.save(member);
            }
        } else if (schedule.getManualMember() != null) {
            ManualMember mm = schedule.getManualMember();
            if (mm.getPtRemaining() != null && mm.getPtRemaining() > 0) {
                mm.setPtRemaining(mm.getPtRemaining() - 1);
                manualMemberRepository.save(mm);
            }
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ─── 트레이너: 월간 캘린더 조회 ──────────────────────────────────────────
    @GetMapping("/calendar/month")
    public List<Map<String, Object>> getMonthlyCalendar(
            @RequestHeader("Authorization") String auth,
            @RequestParam String yearMonth) {
        return scheduleService.getMonthlyCalendar(auth, yearMonth);
    }

    // ─── 트레이너: 월별 메모 조회 / 저장 ─────────────────────────────────────
    @GetMapping("/memo")
    public ResponseEntity<Map<String, Object>> getMemo(
            @RequestHeader("Authorization") String auth,
            @RequestParam String yearMonth) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));
        String memo = memoRepository.findByTrainerAndYearMonth(trainer, yearMonth)
                .map(TrainerScheduleMemo::getMemo).orElse("");
        return ResponseEntity.ok(Map.of("yearMonth", yearMonth, "memo", memo != null ? memo : ""));
    }

    @PutMapping("/memo")
    public ResponseEntity<Void> saveMemo(
            @RequestHeader("Authorization") String auth,
            @RequestParam String yearMonth,
            @RequestBody Map<String, String> body) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));
        TrainerScheduleMemo memo = memoRepository
                .findByTrainerAndYearMonth(trainer, yearMonth)
                .orElseGet(() -> {
                    TrainerScheduleMemo m = new TrainerScheduleMemo();
                    m.setTrainer(trainer);
                    m.setYearMonth(yearMonth);
                    return m;
                });
        memo.setMemo(body.get("memo"));
        memoRepository.save(memo);
        return ResponseEntity.ok().build();
    }
}
