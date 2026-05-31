package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.trainer.dto.TrainerHomeResponse;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.trainer.service.TrainerHomeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/trainer")
public class TrainerHomeController {

    private final TrainerHomeService trainerHomeService;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;

    public TrainerHomeController(TrainerHomeService trainerHomeService,
                                 TrainerRepository trainerRepository,
                                 JwtService jwtService) {
        this.trainerHomeService = trainerHomeService;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
    }

    // GET /api/trainer/home
    @GetMapping("/home")
    public ResponseEntity<TrainerHomeResponse> getHome(
            @RequestHeader("Authorization") String authorization
    ) {
        return ResponseEntity.ok(trainerHomeService.getHome(authorization));
    }

    // GET /api/trainer/revenue?month=2026-04  — 특정 월 매출 조회
    @GetMapping("/revenue")
    public ResponseEntity<Map<String, Object>> getRevenue(
            @RequestHeader("Authorization") String authorization,
            @RequestParam(required = false) String month
    ) {
        return ResponseEntity.ok(trainerHomeService.getMonthRevenue(authorization, month));
    }

    // PUT /api/trainer/goals  — 목표 수업수 / 목표 매출 저장 및 수정
    @PutMapping("/goals")
    public ResponseEntity<Map<String, Object>> updateGoals(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body
    ) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        // null을 명시적으로 보내면 목표 삭제, 값이 있으면 업데이트
        if (body.containsKey("goalSessions")) {
            Object val = body.get("goalSessions");
            trainer.setGoalSessions(val != null ? ((Number) val).intValue() : null);
        }
        if (body.containsKey("goalRevenue")) {
            Object val = body.get("goalRevenue");
            trainer.setGoalRevenue(val != null ? ((Number) val).longValue() : null);
        }

        trainerRepository.save(trainer);

        // Map.of()는 null 값 불가 → HashMap 사용
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("goalSessions", trainer.getGoalSessions());
        result.put("goalRevenue", trainer.getGoalRevenue());
        return ResponseEntity.ok(result);
    }
}
