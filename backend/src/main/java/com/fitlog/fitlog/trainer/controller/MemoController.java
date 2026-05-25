package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.MemberMemo;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/trainer/memos")
public class MemoController {

    private final MemberMemoRepository memoRepository;
    private final MemberRepository memberRepository;
    private final ManualMemberRepository manualMemberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm");

    public MemoController(MemberMemoRepository memoRepository,
                          MemberRepository memberRepository,
                          ManualMemberRepository manualMemberRepository,
                          TrainerRepository trainerRepository,
                          JwtService jwtService) {
        this.memoRepository = memoRepository;
        this.memberRepository = memberRepository;
        this.manualMemberRepository = manualMemberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
    }

    private Trainer getTrainer(String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        return trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }

    private Map<String, Object> toMap(MemberMemo m) {
        return Map.of(
                "id", m.getId(),
                "content", m.getContent(),
                "createdAt", m.getCreatedAt().format(FMT)
        );
    }

    // ── 연동 회원 메모 조회
    @GetMapping("/member/{memberId}")
    public List<Map<String, Object>> getMemberMemos(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId) {
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        return memoRepository.findByMemberOrderByCreatedAtDesc(member)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    // ── 연동 회원 메모 추가
    @PostMapping("/member/{memberId}")
    public ResponseEntity<Map<String, Object>> addMemberMemo(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        MemberMemo memo = new MemberMemo();
        memo.setTrainer(trainer);
        memo.setMember(member);
        memo.setContent(body.get("content"));
        return ResponseEntity.ok(toMap(memoRepository.save(memo)));
    }

    // ── 미연동 회원 메모 조회
    @GetMapping("/manual/{manualId}")
    public List<Map<String, Object>> getManualMemos(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualId) {
        ManualMember mm = manualMemberRepository.findById(manualId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        return memoRepository.findByManualMemberOrderByCreatedAtDesc(mm)
                .stream().map(this::toMap).collect(Collectors.toList());
    }

    // ── 미연동 회원 메모 추가
    @PostMapping("/manual/{manualId}")
    public ResponseEntity<Map<String, Object>> addManualMemo(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualId,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        ManualMember mm = manualMemberRepository.findById(manualId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        MemberMemo memo = new MemberMemo();
        memo.setTrainer(trainer);
        memo.setManualMember(mm);
        memo.setContent(body.get("content"));
        return ResponseEntity.ok(toMap(memoRepository.save(memo)));
    }

    // ── 메모 삭제
    @DeleteMapping("/{memoId}")
    public ResponseEntity<Void> deleteMemo(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memoId) {
        memoRepository.deleteById(memoId);
        return ResponseEntity.noContent().build();
    }
}
