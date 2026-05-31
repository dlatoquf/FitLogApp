package com.fitlog.fitlog.mission.controller;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.mission.dto.MissionResponse;
import com.fitlog.fitlog.mission.service.MissionService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/missions")
public class MissionController {

    private final MissionService missionService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;

    public MissionController(MissionService missionService, JwtService jwtService,
                             UserRepository userRepository, MemberRepository memberRepository,
                             TrainerRepository trainerRepository) {
        this.missionService = missionService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
    }

    // 회원: 내 미션 목록 조회
    @GetMapping("/my")
    public ResponseEntity<List<MissionResponse>> getMyMissions(
            @RequestHeader("Authorization") String authorization) {
        Member member = getMemberFromToken(authorization);
        return ResponseEntity.ok(missionService.getMyMissions(member.getId()));
    }

    // 회원: 미션 완료 처리
    @PatchMapping("/{id}/done")
    public ResponseEntity<MissionResponse> completeMission(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id) {
        Member member = getMemberFromToken(authorization);
        return ResponseEntity.ok(missionService.completeMission(id, member.getId()));
    }

    // 트레이너: 특정 회원 미션 전체 조회
    @GetMapping("/member/{memberId}")
    public ResponseEntity<List<MissionResponse>> getMemberMissions(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId) {
        Trainer trainer = getTrainerFromToken(authorization);
        return ResponseEntity.ok(missionService.getMemberMissions(trainer.getId(), memberId));
    }

    // 트레이너: 미연동 회원 미션 전체 조회
    @GetMapping("/manual-member/{manualMemberId}")
    public ResponseEntity<List<MissionResponse>> getManualMemberMissions(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId) {
        Trainer trainer = getTrainerFromToken(authorization);
        return ResponseEntity.ok(missionService.getManualMemberMissions(trainer.getId(), manualMemberId));
    }

    // 트레이너: 특정 회원의 직전 수업 챌린지 결과 조회
    @GetMapping("/member/{memberId}/last-session")
    public ResponseEntity<List<MissionResponse>> getLastSessionMissions(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId) {
        getTrainerFromToken(authorization); // 권한 확인
        return ResponseEntity.ok(missionService.getLastSessionMissions(memberId));
    }

    // ── 공통 헬퍼 ─────────────────────────────────────────────────────────────
    private Member getMemberFromToken(String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        return memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
    }

    private Trainer getTrainerFromToken(String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        return trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }
}
