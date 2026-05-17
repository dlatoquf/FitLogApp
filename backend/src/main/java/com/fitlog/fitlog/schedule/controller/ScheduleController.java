package com.fitlog.fitlog.schedule.controller;

import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.service.ScheduleService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schedule")
public class ScheduleController {

    private final ScheduleService scheduleService;

    public ScheduleController(ScheduleService scheduleService) {
        this.scheduleService = scheduleService;
    }

    @GetMapping("/slots")
    public List<Schedule> getSlots(@RequestHeader("Authorization") String auth) {
        return scheduleService.getSlotsForMember(auth);
    }

    @GetMapping("/my-this-week")
    public ResponseEntity<List<Map<String, Object>>> getMyThisWeek(
            @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(scheduleService.getMyThisWeekSchedules(auth));
    }

    @GetMapping("/next-week-slots")
    public ResponseEntity<List<Map<String, Object>>> getNextWeekSlots(
            @RequestHeader("Authorization") String auth) {
        return ResponseEntity.ok(scheduleService.getNextWeekSlotsForMember(auth));
    }

    @PostMapping("/request/{scheduleId}")
    public ResponseEntity<Void> requestSlot(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        scheduleService.requestSlot(auth, scheduleId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/request/{scheduleId}")
    public ResponseEntity<Void> cancelRequest(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        scheduleService.cancelRequest(auth, scheduleId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/requests/{scheduleId}")
    public List<Map<String, Object>> getRequests(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        return scheduleService.getRequestsBySlot(auth, scheduleId);
    }

    @PostMapping("/confirm/{scheduleId}")
    public ResponseEntity<Void> confirmRequest(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId,
            @RequestBody Map<String, Long> body) {
        scheduleService.confirmRequest(auth, scheduleId, body.get("memberId"));
        return ResponseEntity.ok().build();
    }

    @GetMapping("/calendar")
    public List<Map<String, Object>> getCalendar(
            @RequestHeader("Authorization") String auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart) {
        return scheduleService.getWeeklyCalendar(auth, weekStart);
    }

    @PostMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateSlots(
            @RequestHeader("Authorization") String auth,
            @RequestBody(required = false) Map<String, Object> body) {
        try {
            List<Map<String, String>> dayTimes = null;
            if (body != null && body.get("dayTimes") instanceof List) {
                dayTimes = (List<Map<String, String>>) body.get("dayTimes");
            }
            // 슬롯 생성 (트랜잭션 커밋까지 완료)
            List<Long> memberIds = scheduleService.generateSlotsForTrainer(auth, dayTimes);
            // 트랜잭션 밖에서 알림 전송 (알림 실패가 슬롯 생성에 영향 없음)
            scheduleService.sendScheduleOpenNotifications(memberIds);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "다음 주 일정이 오픈됐어요."
            ));
        } catch (Throwable t) {
            t.printStackTrace();
            System.err.println("[다음주오픈 크래시] " + t.getClass().getName() + ": " + t.getMessage());
            String msg = t.getMessage() != null ? t.getMessage() : "일정 생성 중 오류가 발생했어요.";
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "message", msg
            ));
        }
    }

    @PostMapping("/create-and-confirm")
    public ResponseEntity<Void> createAndConfirm(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> body) {
        String date      = (String) body.get("date");
        String startTime = (String) body.get("startTime");
        Long memberId    = ((Number) body.get("memberId")).longValue();
        scheduleService.createAndConfirm(auth, date, startTime, memberId);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/confirm/{scheduleId}")
    public ResponseEntity<Void> cancelConfirmed(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId) {
        scheduleService.cancelConfirmed(auth, scheduleId);
        return ResponseEntity.ok().build();
    }
}