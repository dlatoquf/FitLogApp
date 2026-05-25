package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.trainer.dto.TrainerHomeResponse;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.trainer.service.TrainerHomeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

        if (body.containsKey("goalSessions") && body.get("goalSessions") != null) {
            trainer.setGoalSessions(((Number) body.get("goalSessions")).intValue());
        }
        if (body.containsKey("goalRevenue") && body.get("goalRevenue") != null) {
            trainer.setGoalRevenue(((Number) body.get("goalRevenue")).longValue());
        }

        trainerRepository.save(trainer);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "goalSessions", trainer.getGoalSessions(),
                "goalRevenue", trainer.getGoalRevenue()
        ));
    }
}
