package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * RevenueCat Webhook 수신 컨트롤러
 *
 * RevenueCat 대시보드 설정:
 * Dashboard → Project → Integrations → Webhooks
 * URL: https://your-server.com/api/webhook/revenuecat
 * Authorization header: Bearer YOUR_WEBHOOK_SECRET (선택)
 */
@RestController
@RequestMapping("/api/webhook")
public class TrainerPlanController {

    private final TrainerRepository trainerRepository;

    public TrainerPlanController(TrainerRepository trainerRepository) {
        this.trainerRepository = trainerRepository;
    }

    @PostMapping("/revenuecat")
    public ResponseEntity<Map<String, String>> handleWebhook(
            @RequestBody Map<String, Object> payload
    ) {
        try {
            // RevenueCat Webhook 구조:
            // { "event": { "type": "INITIAL_PURCHASE", "app_user_id": "trainer_userId_123", ... } }
            Map<String, Object> event = (Map<String, Object>) payload.get("event");
            if (event == null) return ResponseEntity.badRequest().body(Map.of("message", "event 없음"));

            String eventType  = (String) event.get("type");
            String appUserId  = (String) event.get("app_user_id"); // 우리가 설정할 userId

            if (eventType == null || appUserId == null)
                return ResponseEntity.badRequest().body(Map.of("message", "필수값 없음"));

            Long userId = Long.parseLong(appUserId);

            // expiration_at_ms: 구독 실제 만료 타임스탬프 (ms)
            Long expirationAtMs = event.get("expiration_at_ms") instanceof Number
                    ? ((Number) event.get("expiration_at_ms")).longValue() : null;

            switch (eventType) {
                case "INITIAL_PURCHASE":
                case "RENEWAL":
                case "UNCANCELLATION":
                    updatePlan(userId, "PRO", null);
                    break;

                // 취소: plan은 FREE로 바꾸되 만료일까지 PRO 유지
                case "CANCELLATION":
                    java.time.LocalDate cancelExpiry = expirationAtMs != null
                            ? java.time.Instant.ofEpochMilli(expirationAtMs)
                                .atZone(java.time.ZoneId.of("Asia/Seoul")).toLocalDate()
                            : null;
                    updatePlan(userId, "FREE", cancelExpiry);
                    break;

                // 구독 완전 만료: FREE로 전환
                case "EXPIRATION":
                    updatePlan(userId, "FREE", null);
                    break;

                default:
                    break;
            }

            return ResponseEntity.ok(Map.of("message", "처리 완료"));

        } catch (Exception e) {
            System.out.println("RevenueCat Webhook 처리 실패: " + e.getMessage());
            return ResponseEntity.ok(Map.of("message", "무시")); // 200 반환해야 RevenueCat 재시도 안 함
        }
    }

    private void updatePlan(Long userId, String plan, java.time.LocalDate proExpiresAt) {
        trainerRepository.findByUserId(userId).ifPresent(trainer -> {
            trainer.setPlan(plan);
            trainer.setProExpiresAt(proExpiresAt);
            trainerRepository.save(trainer);
            System.out.println("플랜 업데이트: userId=" + userId + " → " + plan + " (만료일: " + proExpiresAt + ")");
        });
    }
}