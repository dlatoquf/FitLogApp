package com.fitlog.fitlog.controller;

import com.fitlog.fitlog.entity.Schedule;
import com.fitlog.fitlog.dto.ScheduleRequest;
import com.fitlog.fitlog.service.ScheduleService;
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

    // 회원: 이번주 + 다음주 슬롯 조회
    @GetMapping("/slots")
    public List<Schedule> getSlots(
            @RequestHeader("Authorization") String auth
    ) {
        return scheduleService.getSlotsForMember(auth);
    }

    // 회원: 희망 시간 신청
    @PostMapping("/request/{scheduleId}")
    public ResponseEntity<Void> requestSlot(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId
    ) {
        scheduleService.requestSlot(auth, scheduleId);
        return ResponseEntity.ok().build();
    }

    // 회원: 신청 취소
    @DeleteMapping("/request/{scheduleId}")
    public ResponseEntity<Void> cancelRequest(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId
    ) {
        scheduleService.cancelRequest(auth, scheduleId);
        return ResponseEntity.ok().build();
    }

    // 트레이너: 슬롯별 신청자 목록
    @GetMapping("/requests/{scheduleId}")
    public List<ScheduleRequest> getRequests(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId
    ) {
        return scheduleService.getRequestsBySlot(auth, scheduleId);
    }

    // 트레이너: 회원 픽스 확정
    @PostMapping("/confirm/{scheduleId}")
    public ResponseEntity<Void> confirmRequest(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long scheduleId,
            @RequestBody Map<String, Long> body
    ) {
        scheduleService.confirmRequest(auth, scheduleId, body.get("memberId"));
        return ResponseEntity.ok().build();
    }

    // 트레이너: 캘린더 주간 조회
    @GetMapping("/calendar")
    public List<Schedule> getCalendar(
            @RequestHeader("Authorization") String auth,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return scheduleService.getWeeklyCalendar(auth, weekStart);
    }

    // 트레이너: 다음주 슬롯 수동 생성 (또는 스케줄러로 자동화 가능)
    @PostMapping("/generate")
    public ResponseEntity<Void> generateSlots(
            @RequestHeader("Authorization") String auth
    ) {
        scheduleService.generateSlotsForTrainer(auth);
        return ResponseEntity.ok().build();
    }
}