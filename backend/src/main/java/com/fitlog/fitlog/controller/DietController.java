package com.fitlog.fitlog.controller;

import com.fitlog.fitlog.dto.DietFeedbackRequest;
import com.fitlog.fitlog.dto.DietLogRequest;
import com.fitlog.fitlog.dto.DietLogResponse;
import com.fitlog.fitlog.entity.DietFeedback;
import com.fitlog.fitlog.service.DietService;
import com.fitlog.fitlog.service.FatSecretService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/diet")
public class DietController {

    private final DietService dietService;
    private final FatSecretService fatSecretService;

    public DietController(DietService dietService, FatSecretService fatSecretService) {
        this.dietService = dietService;
        this.fatSecretService = fatSecretService;
    }

    // ── FatSecret 음식 검색 ───────────────────────────────────────────────
    @GetMapping("/search")
    public List<FatSecretService.FoodSearchResult> searchFood(@RequestParam String query) {
        return fatSecretService.searchFood(query);
    }

    // ── 회원: 식단 기록 저장 ──────────────────────────────────────────────
    @PostMapping("/log")
    public ResponseEntity<Void> saveDietLog(
            @RequestHeader("Authorization") String auth,
            @RequestBody DietLogRequest request
    ) {
        dietService.saveDietLog(auth, request);
        return ResponseEntity.ok().build();
    }

    // ── 회원: 식단 기록 삭제 ──────────────────────────────────────────────
    @DeleteMapping("/log/{logId}")
    public ResponseEntity<Void> deleteDietLog(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long logId
    ) {
        dietService.deleteDietLog(auth, logId);
        return ResponseEntity.ok().build();
    }

    // ── 회원: 특정 날짜 식단 조회 ─────────────────────────────────────────
    @GetMapping("/me")
    public DietLogResponse getMyDiet(
            @RequestHeader("Authorization") String auth,
            @RequestParam String date
    ) {
        return dietService.getMyDiet(auth, date);
    }

    // ── 회원: 주간 식단 조회 ──────────────────────────────────────────────
    @GetMapping("/me/week")
    public List<DietLogResponse> getMyWeeklyDiet(
            @RequestHeader("Authorization") String auth,
            @RequestParam String weekStart
    ) {
        return dietService.getMyWeeklyDiet(auth, weekStart);
    }

    // ── 트레이너: 회원 식단 조회 ──────────────────────────────────────────
    @GetMapping("/member/{memberId}")
    public DietLogResponse getMemberDiet(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long memberId,
            @RequestParam String date
    ) {
        return dietService.getMemberDiet(auth, memberId, date);
    }

    // ── 트레이너: 회원 주간 식단 조회 ────────────────────────────────────
    @GetMapping("/member/{memberId}/week")
    public List<DietLogResponse> getMemberWeeklyDiet(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long memberId,
            @RequestParam String weekStart
    ) {
        return dietService.getMemberWeeklyDiet(auth, memberId, weekStart);
    }

    // ── 트레이너: 피드백 저장 ─────────────────────────────────────────────
    @PostMapping("/feedback")
    public ResponseEntity<Void> saveFeedback(
            @RequestHeader("Authorization") String auth,
            @RequestBody DietFeedbackRequest request
    ) {
        dietService.saveFeedback(auth, request);
        return ResponseEntity.ok().build();
    }

    // ── 회원: 피드백 조회 ─────────────────────────────────────────────────
    @GetMapping("/feedback")
    public List<DietFeedback> getMyFeedbacks(
            @RequestHeader("Authorization") String auth
    ) {
        return dietService.getMyFeedbacks(auth);
    }

    // ── 트레이너: 특정 회원 피드백 조회 ──────────────────────────────────
    @GetMapping("/feedback/member/{memberId}")
    public List<DietFeedback> getMemberFeedbacks(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long memberId
    ) {
        return dietService.getMemberFeedbacks(auth, memberId);
    }
}