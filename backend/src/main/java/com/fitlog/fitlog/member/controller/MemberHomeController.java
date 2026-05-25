package com.fitlog.fitlog.member.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.service.MemberDeleteService;
import com.fitlog.fitlog.member.service.MemberHomeService;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.MemberMemo;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/member")
public class MemberHomeController {

    private final MemberHomeService memberHomeService;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final MemberDeleteService memberDeleteService;
    private final ManualMemberRepository manualMemberRepository;
    private final MemberMemoRepository memberMemoRepository;

    public MemberHomeController(MemberHomeService memberHomeService,
                                MemberRepository memberRepository,
                                TrainerRepository trainerRepository,
                                JwtService jwtService,
                                UserRepository userRepository,
                                MemberDeleteService memberDeleteService,
                                ManualMemberRepository manualMemberRepository,
                                MemberMemoRepository memberMemoRepository) {
        this.memberHomeService = memberHomeService;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.memberDeleteService = memberDeleteService;
        this.manualMemberRepository = manualMemberRepository;
        this.memberMemoRepository = memberMemoRepository;
    }

    @GetMapping("/home")
    public ResponseEntity<Map<String, Object>> getHome(
            @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(memberHomeService.getHome(authorization));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(
            @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(memberHomeService.getMe(authorization));
    }

    // DELETE /api/member/me - 회원 계정 삭제
    @DeleteMapping("/me")
    public ResponseEntity<Map<String, Object>> deleteMe(
            @RequestHeader("Authorization") String authorization) {
        try {
            memberDeleteService.deleteMemberAccount(authorization);
            return ResponseEntity.ok(Map.of("success", true, "message", "계정이 삭제됐어요."));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류"));
        }
    }

    // PUT /api/member/me - 회원 프로필 수정
    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateMe(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {

        Member member = memberHomeService.getMemberByToken(authorization);

        if (body.get("name") != null) {
            member.getUser().setName(body.get("name").toString());
            userRepository.save(member.getUser());
        }

        if (body.get("phone") != null) {
            member.setPhone(body.get("phone").toString());
        }

        if (body.get("height") != null) {
            member.setHeight(((Number) body.get("height")).doubleValue());
        }

        memberRepository.save(member);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "회원 프로필 수정 완료"
        ));
    }

    @GetMapping("/schedule/this-week")
    public ResponseEntity<List<Map<String, Object>>> getThisWeek(
            @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(memberHomeService.getMyThisWeek(authorization));
    }

    // GET /api/member/check-trainer?code=XXXX - 트레이너 코드 유효성 확인 (연결 X)
    @Transactional(readOnly = true)
    @GetMapping("/check-trainer")
    public ResponseEntity<Map<String, Object>> checkTrainer(
            @RequestParam("code") String code) {

        if (code == null || code.isBlank())
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "코드를 입력해주세요."));

        Trainer trainer = trainerRepository.findByTrainerCode(code.trim().toUpperCase()).orElse(null);

        if (trainer == null)
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "유효하지 않은 트레이너 코드예요."));

        long memberCount = memberRepository.countByTrainer(trainer);
        boolean isFree = "FREE".equals(trainer.getPlan());

        if (isFree && memberCount >= 3) {
            return ResponseEntity.ok(Map.of(
                    "valid", false,
                    "full", true,
                    "message", "해당 트레이너는 현재 무료 플랜으로 회원을 더 받을 수 없어요.\n트레이너에게 PRO 플랜 업그레이드를 요청해주세요.",
                    "trainerName", trainer.getUser().getName()
            ));
        }

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "trainerName", trainer.getUser().getName(),
                "gymName", trainer.getGymName() != null ? trainer.getGymName() : ""
        ));
    }

    // POST /api/member/connect-trainer
    @Transactional
    @PostMapping("/connect-trainer")
    public ResponseEntity<Map<String, Object>> connectTrainer(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body) {

        String trainerCode = body.get("trainerCode");
        if (trainerCode == null || trainerCode.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "트레이너 코드를 입력해주세요."));

        // findByUserId 한번에 조회
        Member member = memberHomeService.getMemberByToken(authorization);

        Trainer trainer = trainerRepository.findByTrainerCode(trainerCode.trim().toUpperCase())
                .orElse(null);

        if (trainer == null)
            return ResponseEntity.badRequest().body(Map.of("message", "유효하지 않은 트레이너 코드예요."));

        // 무료 플랜 제한
        long memberCount = memberRepository.countByTrainer(trainer);
        boolean isFree = "FREE".equals(trainer.getPlan());

        if (isFree && memberCount >= 3) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "message",
                            "무료 플랜은 회원 3명까지 등록 가능합니다."
                    )
            );
        }

        member.setTrainer(trainer);
        memberRepository.save(member);

        // ── 미연동 회원 자동 병합: 같은 트레이너 + 같은 이름이면 PT 데이터 이전 ──
        String memberName = member.getUser().getName();
        List<ManualMember> manualMatches = manualMemberRepository.findByTrainer(trainer)
                .stream()
                .filter(mm -> mm.getName().trim().equalsIgnoreCase(memberName.trim()))
                .toList();

        boolean merged = false;
        if (manualMatches.size() == 1) {
            ManualMember mm = manualMatches.get(0);

            // 1. PT 데이터 이전 (미연동에만 있고 연동엔 없을 때)
            if (mm.getPtTotal() != null && mm.getPtTotal() > 0
                    && (member.getPtTotal() == null || member.getPtTotal() == 0)) {
                member.setPtTotal(mm.getPtTotal());
                member.setPtRemaining(mm.getPtRemaining());
                memberRepository.save(member);
            }

            // 2. 메모 이전: manual_member_id → member_id 로 교체 후 저장
            //    이렇게 해야 manualMember 삭제 시 CASCADE로 메모가 날아가지 않음
            List<MemberMemo> memos = memberMemoRepository.findByManualMemberOrderByCreatedAtDesc(mm);
            for (MemberMemo memo : memos) {
                memo.setMember(member);       // 연동 회원으로 교체
                memo.setManualMember(null);   // 미연동 참조 제거
                memberMemoRepository.save(memo);
            }

            // 3. 미연동 회원 삭제 (이 시점엔 메모 참조가 없으므로 CASCADE 영향 없음)
            manualMemberRepository.delete(mm);
            merged = true;
        }

        return ResponseEntity.ok(Map.of(
                "message",     "트레이너 연결 완료!",
                "trainerName", trainer.getUser().getName(),
                "gymName",     trainer.getGymName() != null ? trainer.getGymName() : "",
                "merged",      merged   // 프론트에서 "기존 정보가 이전됐어요" 안내용
        ));
    }
}