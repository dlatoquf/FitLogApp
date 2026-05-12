package com.fitlog.fitlog.bodylog.controller;

import com.fitlog.fitlog.bodylog.entity.BodyLog;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/bodylog")
public class BodyLogController {

    private final BodyLogRepository bodyLogRepository;
    private final MemberRepository memberRepository;
    private final JwtService jwtService;

    public BodyLogController(BodyLogRepository bodyLogRepository,
                             MemberRepository memberRepository,
                             JwtService jwtService) {
        this.bodyLogRepository = bodyLogRepository;
        this.memberRepository = memberRepository;
        this.jwtService = jwtService;
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
}