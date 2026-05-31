package com.fitlog.fitlog.inquiry.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.inquiry.entity.Inquiry;
import com.fitlog.fitlog.inquiry.repository.InquiryRepository;
import com.fitlog.fitlog.notification.service.EmailService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.logging.Logger;

@RestController
@RequestMapping("/api/inquiry")
public class InquiryController {

    private static final Logger log = Logger.getLogger(InquiryController.class.getName());

    private final InquiryRepository inquiryRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final EmailService emailService;

    public InquiryController(InquiryRepository inquiryRepository,
                             TrainerRepository trainerRepository,
                             JwtService jwtService,
                             EmailService emailService) {
        this.inquiryRepository = inquiryRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.emailService = emailService;
    }

    // POST /api/inquiry — 문의 등록
    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, String> body) {
        try {
            Trainer trainer = getTrainer(auth);

            String title   = body.get("title");
            String content = body.get("content");

            if (title == null || title.isBlank())
                return ResponseEntity.badRequest().body(Map.of("message", "제목을 입력해주세요."));
            if (content == null || content.isBlank())
                return ResponseEntity.badRequest().body(Map.of("message", "내용을 입력해주세요."));

            Inquiry inquiry = new Inquiry();
            inquiry.setTrainer(trainer);
            inquiry.setTitle(title.trim());
            inquiry.setContent(content.trim());
            inquiryRepository.save(inquiry);

            // 관리자에게 이메일 알림 (실패해도 문의 등록에 영향 없음)
            try {
                emailService.sendInquiryNotice(
                        trainer.getUser().getName(),
                        title.trim(),
                        content.trim(),
                        inquiry.getId()
                );
            } catch (Exception e) {
                log.warning("[InquiryController] 이메일 발송 실패: " + e.getMessage());
            }

            return ResponseEntity.ok(Map.of("success", true, "id", inquiry.getId()));
        } catch (Exception e) {
            log.severe("[InquiryController] 문의 등록 오류: " + e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of("message", "서버 오류가 발생했어요. 잠시 후 다시 시도해주세요."));
        }
    }

    // GET /api/inquiry — 내 문의 목록
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> list(
            @RequestHeader("Authorization") String auth) {

        Trainer trainer = getTrainer(auth);
        List<Inquiry> inquiries = inquiryRepository.findByTrainerOrderByCreatedAtDesc(trainer);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Inquiry inq : inquiries) {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id",        inq.getId());
            map.put("title",     inq.getTitle());
            map.put("content",   inq.getContent());
            map.put("status",    inq.getStatus());
            map.put("answer",    inq.getAnswer());
            map.put("createdAt", inq.getCreatedAt().toString().substring(0, 16).replace("T", " "));
            map.put("answeredAt", inq.getAnsweredAt() != null
                    ? inq.getAnsweredAt().toString().substring(0, 16).replace("T", " ") : null);
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    private Trainer getTrainer(String auth) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        return trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));
    }
}
