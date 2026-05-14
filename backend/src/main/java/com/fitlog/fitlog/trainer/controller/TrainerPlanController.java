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

            switch (eventType) {
                // 최초 구독 결제 성공
                case "INITIAL_PURCHASE":
                    // 구독 갱신 성공
                case "RENEWAL":
                    // 환불 취소 후 재활성화
                case "UNCANCELLATION":
                    updatePlan(userId, "PRO");
                    break;

                // 구독 만료
                case "EXPIRATION":
                    // 환불
                case "CANCELLATION":
                    updatePlan(userId, "FREE");
                    break;

                // 그 외 이벤트 (PRODUCT_CHANGE 등) 무시
                default:
                    break;
            }

            return ResponseEntity.ok(Map.of("message", "처리 완료"));

        } catch (Exception e) {
            System.out.println("RevenueCat Webhook 처리 실패: " + e.getMessage());
            return ResponseEntity.ok(Map.of("message", "무시")); // 200 반환해야 RevenueCat 재시도 안 함
        }
    }

    private void updatePlan(Long userId, String plan) {
        trainerRepository.findByUserId(userId).ifPresent(trainer -> {
            trainer.setPlan(plan);
            trainerRepository.save(trainer);
            System.out.println("플랜 업데이트: userId=" + userId + " → " + plan);
        });
    }
}