package com.fitlog.fitlog.diet.controller;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.diet.entity.DietDayFeedback;
import com.fitlog.fitlog.diet.entity.DietPhoto;
import com.fitlog.fitlog.diet.repository.DietDayFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietPhotoRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;

@RestController
@RequestMapping("/api/diet")
public class DietPhotoController {

    private final DietPhotoRepository dietPhotoRepository;
    private final DietDayFeedbackRepository dayFeedbackRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;

    public DietPhotoController(DietPhotoRepository dietPhotoRepository,
                               DietDayFeedbackRepository dayFeedbackRepository,
                               MemberRepository memberRepository,
                               TrainerRepository trainerRepository,
                               JwtService jwtService,
                               NotificationService notificationService) {
        this.dietPhotoRepository = dietPhotoRepository;
        this.dayFeedbackRepository = dayFeedbackRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
    }

    // ── 회원: 날짜별 사진 조회 ──────────────────────────────────────────────────
    @GetMapping("/photos")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getMemberPhotos(
            @RequestHeader("Authorization") String authorization,
            @RequestParam String date) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
        LocalDate localDate = LocalDate.parse(date, DateTimeFormatter.ISO_DATE);
        List<DietPhoto> photos = dietPhotoRepository.findByMemberAndDateOrderBySortOrderAscCreatedAtAsc(member, localDate);
        Optional<DietDayFeedback> feedback = dayFeedbackRepository.findByMemberAndDate(member, localDate);

        Map<String, Object> response = buildDayResponse(photos, feedback.orElse(null));
        response.put("memberId", member.getId());
        if (member.getTrainer() != null) response.put("trainerId", member.getTrainer().getId());
        return ResponseEntity.ok(response);
    }

    // ── 트레이너: 회원 날짜별 사진 조회 ────────────────────────────────────────
    @GetMapping("/photos/member/{memberId}")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getTrainerMemberPhotos(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId,
            @RequestParam String date) {
        LocalDate localDate = LocalDate.parse(date, DateTimeFormatter.ISO_DATE);
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
        List<DietPhoto> photos = dietPhotoRepository.findByMemberIdAndDate(memberId, localDate);
        Optional<DietDayFeedback> feedback = dayFeedbackRepository.findByMemberAndDate(member, localDate);

        return ResponseEntity.ok(buildDayResponse(photos, feedback.orElse(null)));
    }

    // ── 회원: 사진 추가 → 트레이너 알림 ────────────────────────────────────────
    @PostMapping("/photos")
    @Transactional
    public ResponseEntity<Map<String, Object>> addPhoto(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));

        DietPhoto photo = new DietPhoto();
        photo.setMember(member);
        photo.setDate(LocalDate.parse((String) body.get("date"), DateTimeFormatter.ISO_DATE));
        photo.setPhotoUrl((String) body.get("photoUrl"));
        if (body.get("cloudinaryPublicId") != null)
            photo.setCloudinaryPublicId((String) body.get("cloudinaryPublicId"));
        if (body.get("label") != null)
            photo.setLabel((String) body.get("label"));

        DietPhoto saved = dietPhotoRepository.save(photo);

        // 트레이너에게 알림 전송 — notifDiet ON + 새 업로드 세션일 때만 (5분 이내 연속 업로드는 같은 세션)
        if (member.getTrainer() != null) {
            Trainer trainer = member.getTrainer();
            if (Boolean.TRUE.equals(trainer.getNotifDiet())) {
                // 방금 저장한 사진 제외하고 5분 이내에 다른 사진이 없으면 새 세션 → 알림 1회
                java.time.LocalDateTime fiveMinutesAgo = java.time.LocalDateTime.now().minusMinutes(5);
                int recentCount = dietPhotoRepository.countByMemberAndDateAndCreatedAtAfter(
                    member, saved.getDate(), fiveMinutesAgo);
                if (recentCount == 1) { // 현재 사진만 있으면 새 세션
                    notificationService.sendNotification(
                        trainer.getUser(),
                        "DIET_PHOTO",
                        (member.getCachedName() != null ? member.getCachedName() : member.getUser().getName()) + "님이 " + saved.getDate() + " 식단 로그를 등록했어요.",
                        "MEMBER",
                        member.getId()
                    );
                }
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("id", saved.getId());
        res.put("date", saved.getDate().toString());
        res.put("photoUrl", saved.getPhotoUrl());
        return ResponseEntity.ok(res);
    }

    // ── 회원: 사진 삭제 ─────────────────────────────────────────────────────────
    @DeleteMapping("/photos/{photoId}")
    @Transactional
    public ResponseEntity<Void> deletePhoto(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long photoId) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
        DietPhoto photo = dietPhotoRepository.findById(photoId)
                .orElseThrow(() -> new RuntimeException("사진을 찾을 수 없습니다."));
        if (!photo.getMember().getId().equals(member.getId()))
            throw new RuntimeException("권한이 없습니다.");
        dietPhotoRepository.delete(photo);
        return ResponseEntity.noContent().build();
    }

    // ── 트레이너: 하루 피드백 등록/수정 → 회원 알림 ───────────────────────────
    @PostMapping("/feedback/member/{memberId}")
    @Transactional
    public ResponseEntity<Map<String, Object>> saveDayFeedback(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId,
            @RequestBody Map<String, String> body) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));

        LocalDate date = LocalDate.parse(body.get("date"), DateTimeFormatter.ISO_DATE);
        String content = body.get("content");

        // 이미 있으면 수정, 없으면 새로 생성
        DietDayFeedback feedback = dayFeedbackRepository
                .findByMemberAndDate(member, date)
                .orElse(new DietDayFeedback());

        feedback.setMember(member);
        feedback.setTrainer(trainer);
        feedback.setTrainerName(trainer.getUser().getName());
        feedback.setDate(date);
        feedback.setContent(content);
        DietDayFeedback saved = dayFeedbackRepository.save(feedback);

        // 회원에게 알림 전송
        if (member.getNotifFeedback()) {
            notificationService.sendNotification(
                member.getUser(),
                "DIET_FEEDBACK",
                trainer.getUser().getName() + " 트레이너가 식단 피드백을 남겼어요.",
                "DIET_FEEDBACK",
                saved.getId(),
                date.toString()
            );
        }

        Map<String, Object> res = new HashMap<>();
        res.put("id", saved.getId());
        res.put("trainerName", saved.getTrainerName());
        res.put("content", saved.getContent());
        res.put("date", saved.getDate().toString());
        res.put("createdAt", saved.getCreatedAt().toString());
        return ResponseEntity.ok(res);
    }

    // ── 회원: 가장 최근 하루 피드백 조회 (홈 화면용) ────────────────────────────
    @GetMapping("/feedback/latest")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getLatestFeedback(
            @RequestHeader("Authorization") String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
        Optional<DietDayFeedback> latest = dayFeedbackRepository.findTopByMemberOrderByDateDesc(member);
        if (latest.isEmpty()) return ResponseEntity.noContent().build();
        DietDayFeedback fb = latest.get();
        Map<String, Object> res = new HashMap<>();
        res.put("id", fb.getId());
        res.put("trainerName", fb.getTrainerName());
        res.put("content", fb.getContent());
        res.put("date", fb.getDate().toString());
        res.put("createdAt", fb.getCreatedAt().toString());
        return ResponseEntity.ok(res);
    }

    // ── helper: 날짜별 사진 목록 + 하루 피드백 묶어서 반환 ─────────────────────
    private Map<String, Object> buildDayResponse(List<DietPhoto> photos, DietDayFeedback feedback) {
        List<Map<String, Object>> photoList = new ArrayList<>();
        for (DietPhoto p : photos) {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("date", p.getDate().toString());
            m.put("photoUrl", p.getPhotoUrl());
            m.put("cloudinaryPublicId", p.getCloudinaryPublicId());
            m.put("label", p.getLabel());
            m.put("createdAt", p.getCreatedAt().toString());
            photoList.add(m);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("photos", photoList);

        if (feedback != null) {
            Map<String, Object> fb = new HashMap<>();
            fb.put("id", feedback.getId());
            fb.put("trainerName", feedback.getTrainerName());
            fb.put("content", feedback.getContent());
            fb.put("createdAt", feedback.getCreatedAt().toString());
            result.put("feedback", fb);
        } else {
            result.put("feedback", null);
        }

        return result;
    }
}
