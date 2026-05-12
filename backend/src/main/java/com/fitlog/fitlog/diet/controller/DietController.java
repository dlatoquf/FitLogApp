package com.fitlog.fitlog.diet.controller;

import com.fitlog.fitlog.diet.dto.DietFeedbackRequest;
import com.fitlog.fitlog.diet.dto.DietLogRequest;
import com.fitlog.fitlog.diet.dto.DietLogResponse;
import com.fitlog.fitlog.diet.dto.DietFeedbackResponse;
import com.fitlog.fitlog.diet.service.DietService;
import com.fitlog.fitlog.diet.service.FoodSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/diet")
public class DietController {

    private final DietService dietService;
    private final FoodSearchService foodSearchService;

    public DietController(DietService dietService, FoodSearchService foodSearchService) {
        this.dietService = dietService;
        this.foodSearchService = foodSearchService;
    }

    @GetMapping("/search")
    public List<FoodSearchService.FoodSearchResult> searchFood(@RequestParam String query) {
        return foodSearchService.search(query);
    }

    // 음식 선택 시 캐싱 (식약처/FatSecret 결과를 내부 DB에 저장)
    @PostMapping("/search/cache")
    public ResponseEntity<Map<String, Object>> cacheFood(
            @RequestBody Map<String, Object> body) {
        String foodId   = (String) body.get("foodId");
        String foodName = (String) body.get("foodName");
        String source   = (String) body.get("source");
        double calories = body.get("calories") != null ? ((Number) body.get("calories")).doubleValue() : 0;
        double carbs    = body.get("carbs")    != null ? ((Number) body.get("carbs")).doubleValue()    : 0;
        double protein  = body.get("protein")  != null ? ((Number) body.get("protein")).doubleValue()  : 0;
        double fat      = body.get("fat")      != null ? ((Number) body.get("fat")).doubleValue()      : 0;

        // internal은 이미 DB에 있으니 캐싱 불필요
        if (!"internal".equals(source)) {
            FoodSearchService.FoodSearchResult result =
                    new FoodSearchService.FoodSearchResult(foodId, foodName, calories, carbs, protein, fat, source);
            foodSearchService.cacheKfoodResult(result);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping("/log")
    public ResponseEntity<Map<String, Object>> saveDietLog(
            @RequestHeader("Authorization") String auth,
            @RequestBody DietLogRequest request
    ) {
        dietService.saveDietLog(auth, request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "식단 저장 완료"
        ));
    }

    @PutMapping("/log/{logId}")
    public ResponseEntity<Map<String, Object>> updateDietLog(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long logId,
            @RequestBody DietLogRequest request
    ) {
        dietService.updateDietLog(auth, logId, request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "식단 수정 완료"
        ));
    }

    @DeleteMapping("/log/{logId}")
    public ResponseEntity<Map<String, Object>> deleteDietLog(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long logId
    ) {
        dietService.deleteDietLog(auth, logId);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "식단 삭제 완료"
        ));
    }

    @GetMapping("/me")
    public DietLogResponse getMyDiet(
            @RequestHeader("Authorization") String auth,
            @RequestParam String date
    ) {
        return dietService.getMyDiet(auth, date);
    }

    @GetMapping("/me/week")
    public List<DietLogResponse> getMyWeeklyDiet(
            @RequestHeader("Authorization") String auth,
            @RequestParam String weekStart
    ) {
        return dietService.getMyWeeklyDiet(auth, weekStart);
    }

    @GetMapping("/member/{memberId}")
    public DietLogResponse getMemberDiet(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long memberId,
            @RequestParam String date
    ) {
        return dietService.getMemberDiet(auth, memberId, date);
    }

    @GetMapping("/member/{memberId}/week")
    public List<DietLogResponse> getMemberWeeklyDiet(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long memberId,
            @RequestParam String weekStart
    ) {
        return dietService.getMemberWeeklyDiet(auth, memberId, weekStart);
    }

    @PostMapping("/feedback")
    public ResponseEntity<Map<String, Object>> saveFeedback(
            @RequestHeader("Authorization") String auth,
            @RequestBody DietFeedbackRequest request
    ) {
        dietService.saveFeedback(auth, request);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "피드백 저장 완료"
        ));
    }

    @GetMapping("/feedback")
    public List<DietFeedbackResponse> getMyFeedbacks(
            @RequestHeader("Authorization") String auth
    ) {
        return dietService.getMyFeedbacks(auth);
    }

    @GetMapping("/feedback/member/{memberId}")
    public List<DietFeedbackResponse> getMemberFeedbacks(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long memberId
    ) {
        return dietService.getMemberFeedbacks(auth, memberId);
    }
}