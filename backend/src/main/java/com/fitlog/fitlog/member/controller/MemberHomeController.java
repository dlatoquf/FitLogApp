package com.fitlog.fitlog.member.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.service.MemberDeleteService;
import com.fitlog.fitlog.member.service.MemberHomeService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
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

    public MemberHomeController(MemberHomeService memberHomeService,
                                MemberRepository memberRepository,
                                TrainerRepository trainerRepository,
                                JwtService jwtService,
                                UserRepository userRepository,
                                MemberDeleteService memberDeleteService) {
        this.memberHomeService = memberHomeService;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.memberDeleteService = memberDeleteService;
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

    // POST /api/member/connect-trainer
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

        // TODO: 실제 배포 시 memberCount >= 3 으로 변경 (FREE 플랜 3명 제한)
        // 현재는 테스트용으로 1명 초과 시 결제 유도
        if (isFree && memberCount >= 1) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "message",
                            "무료 플랜은 회원 3명까지 등록 가능합니다."
                    )
            );
        }

        member.setTrainer(trainer);
        memberRepository.save(member);

        return ResponseEntity.ok(Map.of(
                "message",     "트레이너 연결 완료!",
                "trainerName", trainer.getUser().getName(),
                "gymName",     trainer.getGymName() != null ? trainer.getGymName() : ""
        ));
    }
}