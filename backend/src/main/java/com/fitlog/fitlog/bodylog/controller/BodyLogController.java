package com.fitlog.fitlog.bodylog.controller;

import com.fitlog.fitlog.bodylog.entity.BodyLog;
import com.fitlog.fitlog.bodylog.entity.ManualBodyLog;
import com.fitlog.fitlog.bodylog.repository.ManualBodyLogRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.notification.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bodylog")
public class BodyLogController {

    private final BodyLogRepository bodyLogRepository;
    private final ManualBodyLogRepository manualBodyLogRepository;
    private final MemberRepository memberRepository;
    private final ManualMemberRepository manualMemberRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;

    public BodyLogController(BodyLogRepository bodyLogRepository,
                             ManualBodyLogRepository manualBodyLogRepository,
                             MemberRepository memberRepository,
                             ManualMemberRepository manualMemberRepository,
                             JwtService jwtService,
                             NotificationService notificationService) {
        this.bodyLogRepository = bodyLogRepository;
        this.manualBodyLogRepository = manualBodyLogRepository;
        this.memberRepository = memberRepository;
        this.manualMemberRepository = manualMemberRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
    }

    private Map<String, Object> toMap(BodyLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("id",          log.getId());
        map.put("date",        log.getLogDate() != null ? log.getLogDate().toString() : "");
        map.put("weight",      log.getWeight());
        map.put("bodyFat",     log.getBodyFat());
        map.put("bodyFatMass", log.getBodyFatMass());
        map.put("muscleMass",  log.getMuscleMass());
        map.put("memo",        log.getMemo());
        map.put("createdAt",   log.getCreatedAt() != null ? log.getCreatedAt().toString() : null);
        return map;
    }

    private Map<String, Object> toManualMap(ManualBodyLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("id",          log.getId());
        map.put("date",        log.getLogDate() != null ? log.getLogDate().toString() : "");
        map.put("weight",      log.getWeight());
        map.put("bodyFat",     log.getBodyFat());
        map.put("bodyFatMass", log.getBodyFatMass());
        map.put("muscleMass",  log.getMuscleMass());
        map.put("memo",        log.getMemo());
        map.put("createdAt",   log.getCreatedAt() != null ? log.getCreatedAt().toString() : null);
        return map;
    }

    // GET /api/bodylog/member/{memberId} - 트레이너가 회원 바디로그 조회
    @GetMapping("/member/{memberId}")
    public ResponseEntity<List<Map<String, Object>>> getMemberBodyLogs(
            @PathVariable Long memberId) {
        Member member = memberRepository.findByIdWithUser(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        List<Map<String, Object>> result = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream()
                .map(this::toMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // POST /api/bodylog/member/{memberId} - 트레이너가 연동 회원 바디로그 저장
    @PostMapping("/member/{memberId}")
    public ResponseEntity<Map<String, Object>> saveBodyLogForMember(
            @PathVariable Long memberId,
            @RequestBody Map<String, Object> body) {
        Member member = memberRepository.findByIdWithUser(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        BodyLog log = new BodyLog();
        log.setMember(member);
        log.setLogDate(java.time.LocalDate.now());
        log.setCreatedAt(java.time.LocalDateTime.now());
        if (body.get("weight") != null)      log.setWeight(((Number) body.get("weight")).doubleValue());
        if (body.get("bodyFat") != null)     log.setBodyFat(((Number) body.get("bodyFat")).doubleValue());
        if (body.get("bodyFatMass") != null) log.setBodyFatMass(((Number) body.get("bodyFatMass")).doubleValue());
        if (body.get("muscleMass") != null)  log.setMuscleMass(((Number) body.get("muscleMass")).doubleValue());
        if (body.get("memo") != null)        log.setMemo(body.get("memo").toString());
        bodyLogRepository.save(log);

        // 회원에게 바디로그 작성 알림
        try {
            if (member.getNotifBodyLog()) {
                String trainerName = member.getTrainer() != null
                    ? member.getTrainer().getUser().getName() : "트레이너";
                notificationService.sendNotification(
                    member.getUser(), "BODY_LOG",
                    trainerName + "님이 바디로그를 작성했어요.",
                    "BODY_LOG", log.getId()
                );
            }
        } catch (Exception ignored) {}

        List<Map<String, Object>> allLogs = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream()
                .map(this::toMap)
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("saved", toMap(log));
        result.put("logs", allLogs);
        return ResponseEntity.ok(result);
    }

    // POST /api/bodylog - 회원 본인 바디로그 저장
    @PostMapping
    public ResponseEntity<Map<String, Object>> saveBodyLog(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));

        BodyLog log = new BodyLog();
        log.setMember(member);
        log.setLogDate(java.time.LocalDate.now());
        log.setCreatedAt(java.time.LocalDateTime.now());
        if (body.get("weight") != null)      log.setWeight(((Number) body.get("weight")).doubleValue());
        if (body.get("bodyFat") != null)     log.setBodyFat(((Number) body.get("bodyFat")).doubleValue());
        if (body.get("bodyFatMass") != null) log.setBodyFatMass(((Number) body.get("bodyFatMass")).doubleValue());
        if (body.get("muscleMass") != null)  log.setMuscleMass(((Number) body.get("muscleMass")).doubleValue());
        if (body.get("memo") != null)        log.setMemo(body.get("memo").toString());

        bodyLogRepository.save(log);

        // 저장 후 전체 목록 같이 반환 → 프론트에서 재조회 불필요
        List<Map<String, Object>> allLogs = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream()
                .map(this::toMap)
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("saved", toMap(log));
        result.put("logs", allLogs);
        return ResponseEntity.ok(result);
    }

    // GET /api/bodylog/me - 회원 본인 바디로그 조회
    @GetMapping("/me")
    public ResponseEntity<List<Map<String, Object>>> getMyBodyLogs(
            @RequestHeader("Authorization") String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));
        List<Map<String, Object>> result = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream()
                .map(this::toMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // ── 미연동 회원 바디로그 ──────────────────────────────────────────────

    // GET /api/bodylog/manual/{manualMemberId} - 트레이너가 미연동 회원 바디로그 조회
    @GetMapping("/manual/{manualMemberId}")
    public ResponseEntity<List<Map<String, Object>>> getManualBodyLogs(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId) {
        // 인증 확인 (JWT 유효성만)
        String token = authorization.replace("Bearer ", "");
        jwtService.getUserIdFromToken(token);

        ManualMember mm = manualMemberRepository.findById(manualMemberId)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));
        List<Map<String, Object>> result = manualBodyLogRepository
                .findByManualMemberOrderByLogDateAsc(mm)
                .stream()
                .map(this::toManualMap)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // POST /api/bodylog/manual/{manualMemberId} - 트레이너가 미연동 회원 바디로그 저장
    @PostMapping("/manual/{manualMemberId}")
    public ResponseEntity<Map<String, Object>> saveManualBodyLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId,
            @RequestBody Map<String, Object> body) {
        String token = authorization.replace("Bearer ", "");
        jwtService.getUserIdFromToken(token);

        ManualMember mm = manualMemberRepository.findById(manualMemberId)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));

        ManualBodyLog log = new ManualBodyLog();
        log.setManualMember(mm);

        // 날짜: 요청에서 받거나 오늘
        if (body.get("date") != null && !body.get("date").toString().isBlank()) {
            log.setLogDate(LocalDate.parse(body.get("date").toString()));
        } else {
            log.setLogDate(LocalDate.now());
        }
        log.setCreatedAt(LocalDateTime.now());
        if (body.get("weight") != null)      log.setWeight(((Number) body.get("weight")).doubleValue());
        if (body.get("bodyFat") != null)     log.setBodyFat(((Number) body.get("bodyFat")).doubleValue());
        if (body.get("bodyFatMass") != null) log.setBodyFatMass(((Number) body.get("bodyFatMass")).doubleValue());
        if (body.get("muscleMass") != null)  log.setMuscleMass(((Number) body.get("muscleMass")).doubleValue());
        if (body.get("memo") != null)        log.setMemo(body.get("memo").toString());

        manualBodyLogRepository.save(log);

        // 저장 후 전체 목록 반환
        List<Map<String, Object>> allLogs = manualBodyLogRepository
                .findByManualMemberOrderByLogDateAsc(mm)
                .stream()
                .map(this::toManualMap)
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("saved", toManualMap(log));
        result.put("logs", allLogs);
        return ResponseEntity.ok(result);
    }

    // DELETE /api/bodylog/manual/{logId} - 트레이너가 미연동 회원 바디로그 삭제
    @DeleteMapping("/manual/{logId}")
    public ResponseEntity<Map<String, Object>> deleteManualBodyLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long logId) {
        String token = authorization.replace("Bearer ", "");
        jwtService.getUserIdFromToken(token);

        ManualBodyLog log = manualBodyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("바디로그를 찾을 수 없습니다."));
        Long mmId = log.getManualMember().getId();
        manualBodyLogRepository.delete(log);

        ManualMember mm = manualMemberRepository.findById(mmId)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));
        List<Map<String, Object>> remaining = manualBodyLogRepository
                .findByManualMemberOrderByLogDateAsc(mm)
                .stream()
                .map(this::toManualMap)
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("message", "삭제됐어요.", "logs", remaining));
    }

    // PUT /api/bodylog/manual/{logId} - 트레이너가 미연동 회원 바디로그 수정
    @PutMapping("/manual/{logId}")
    public ResponseEntity<Map<String, Object>> updateManualBodyLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long logId,
            @RequestBody Map<String, Object> body) {
        String token = authorization.replace("Bearer ", "");
        jwtService.getUserIdFromToken(token);

        ManualBodyLog log = manualBodyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("바디로그를 찾을 수 없습니다."));

        if (body.get("date") != null && !body.get("date").toString().isBlank())
            log.setLogDate(LocalDate.parse(body.get("date").toString()));
        if (body.get("weight") != null)      log.setWeight(((Number) body.get("weight")).doubleValue());
        if (body.get("bodyFatMass") != null) log.setBodyFatMass(((Number) body.get("bodyFatMass")).doubleValue());
        if (body.get("muscleMass") != null)  log.setMuscleMass(((Number) body.get("muscleMass")).doubleValue());
        if (body.containsKey("bodyFat"))     log.setBodyFat(body.get("bodyFat") != null ? ((Number) body.get("bodyFat")).doubleValue() : null);

        manualBodyLogRepository.save(log);

        ManualMember mm = log.getManualMember();
        List<Map<String, Object>> allLogs = manualBodyLogRepository
                .findByManualMemberOrderByLogDateAsc(mm)
                .stream().map(this::toManualMap).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("saved", toManualMap(log), "logs", allLogs));
    }

    // PUT /api/bodylog/member/{memberId}/log/{logId} - 트레이너가 연동 회원 바디로그 수정
    @PutMapping("/member/{memberId}/log/{logId}")
    public ResponseEntity<Map<String, Object>> updateMemberBodyLog(
            @PathVariable Long memberId,
            @PathVariable Long logId,
            @RequestBody Map<String, Object> body) {
        BodyLog log = bodyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("바디로그를 찾을 수 없습니다."));

        if (body.get("date") != null && !body.get("date").toString().isBlank())
            log.setLogDate(LocalDate.parse(body.get("date").toString()));
        if (body.get("weight") != null)      log.setWeight(((Number) body.get("weight")).doubleValue());
        if (body.get("bodyFatMass") != null) log.setBodyFatMass(((Number) body.get("bodyFatMass")).doubleValue());
        if (body.get("muscleMass") != null)  log.setMuscleMass(((Number) body.get("muscleMass")).doubleValue());
        if (body.containsKey("bodyFat"))     log.setBodyFat(body.get("bodyFat") != null ? ((Number) body.get("bodyFat")).doubleValue() : null);

        bodyLogRepository.save(log);

        Member member = memberRepository.findByIdWithUser(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        List<Map<String, Object>> allLogs = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream().map(this::toMap).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("saved", toMap(log), "logs", allLogs));
    }

    // DELETE /api/bodylog/{logId} - 회원 본인 바디로그 삭제
    @DeleteMapping("/{logId}")
    public ResponseEntity<Map<String, Object>> deleteMyBodyLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long logId) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));

        BodyLog log = bodyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("바디로그를 찾을 수 없습니다."));
        bodyLogRepository.delete(log);

        List<Map<String, Object>> remaining = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream().map(this::toMap).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("message", "삭제됐어요.", "logs", remaining));
    }

    // PUT /api/bodylog/{logId} - 회원 본인 바디로그 수정
    @PutMapping("/{logId}")
    public ResponseEntity<Map<String, Object>> updateMyBodyLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long logId,
            @RequestBody Map<String, Object> body) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));

        BodyLog log = bodyLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("바디로그를 찾을 수 없습니다."));

        if (body.get("date") != null && !body.get("date").toString().isBlank())
            log.setLogDate(LocalDate.parse(body.get("date").toString()));
        if (body.get("weight") != null)      log.setWeight(((Number) body.get("weight")).doubleValue());
        if (body.get("bodyFatMass") != null) log.setBodyFatMass(((Number) body.get("bodyFatMass")).doubleValue());
        if (body.get("muscleMass") != null)  log.setMuscleMass(((Number) body.get("muscleMass")).doubleValue());
        if (body.containsKey("bodyFat"))     log.setBodyFat(body.get("bodyFat") != null ? ((Number) body.get("bodyFat")).doubleValue() : null);

        bodyLogRepository.save(log);

        List<Map<String, Object>> allLogs = bodyLogRepository
                .findByMemberOrderByLogDateAsc(member)
                .stream().map(this::toMap).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("saved", toMap(log), "logs", allLogs));
    }
}