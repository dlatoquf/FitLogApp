package com.fitlog.fitlog.inquiry.controller;

import com.fitlog.fitlog.inquiry.entity.Inquiry;
import com.fitlog.fitlog.inquiry.repository.InquiryRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자 문의 답변 API
 *
 * 사용법 (Postman / curl):
 *   PUT /api/admin/inquiry/{id}/answer
 *   Header: X-Admin-Key: fitlog-admin-2024
 *   Body: { "answer": "안녕하세요! 문의 주셔서 감사합니다. ..." }
 *
 *   GET /api/admin/inquiry
 *   Header: X-Admin-Key: fitlog-admin-2024
 *   → 전체 문의 목록 (최신순)
 */
@RestController
@RequestMapping("/api/admin/inquiry")
public class AdminInquiryController {

    private final InquiryRepository inquiryRepository;
    private final NotificationService notificationService;

    @Value("${admin.secret:fitlog-admin-2024}")
    private String adminSecret;

    public AdminInquiryController(InquiryRepository inquiryRepository, NotificationService notificationService) {
        this.inquiryRepository = inquiryRepository;
        this.notificationService = notificationService;
    }

    // 전체 문의 목록 조회 (관리자용)
    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> listAll(
            @RequestHeader(value = "X-Admin-Key", required = false) String key) {
        if (!adminSecret.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("message", "인증 실패"));
        }

        List<Inquiry> inquiries = inquiryRepository.findAllByOrderByCreatedAtDesc();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Inquiry inq : inquiries) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id",          inq.getId());
            map.put("trainerName", inq.getTrainer().getUser().getName());
            map.put("title",       inq.getTitle());
            map.put("content",     inq.getContent());
            map.put("status",      inq.getStatus());
            map.put("answer",      inq.getAnswer());
            map.put("createdAt",   inq.getCreatedAt().toString().substring(0, 16).replace("T", " "));
            map.put("answeredAt",  inq.getAnsweredAt() != null
                    ? inq.getAnsweredAt().toString().substring(0, 16).replace("T", " ") : null);
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    // 문의 답변 등록/수정
    @PutMapping("/{id}/answer")
    public ResponseEntity<?> answer(
            @RequestHeader(value = "X-Admin-Key", required = false) String key,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {

        if (!adminSecret.equals(key)) {
            return ResponseEntity.status(403).body(Map.of("message", "인증 실패"));
        }

        String answerText = body.get("answer");
        if (answerText == null || answerText.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "답변 내용을 입력해주세요."));
        }

        Inquiry inquiry = inquiryRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("문의를 찾을 수 없습니다."));

        inquiry.setAnswer(answerText.trim());
        inquiry.setStatus("ANSWERED");
        inquiry.setAnsweredAt(LocalDateTime.now());
        inquiryRepository.save(inquiry);

        try {
            notificationService.sendNotification(
                    inquiry.getTrainer().getUser(),
                    "GENERAL",
                    "문의하신 '" + inquiry.getTitle() + "'에 답변이 등록됐어요."
            );
        } catch (Exception ignored) {}

        return ResponseEntity.ok(Map.of(
                "success", true,
                "id", inquiry.getId(),
                "status", "ANSWERED",
                "answeredAt", inquiry.getAnsweredAt().toString().substring(0, 16).replace("T", " ")
        ));
    }
}
