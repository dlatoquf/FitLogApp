package com.fitlog.fitlog.member.controller;

import com.fitlog.fitlog.member.dto.MemberGoalRequest;
import com.fitlog.fitlog.member.dto.MemberGoalResponse;
import com.fitlog.fitlog.member.service.MemberGoalService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/member/goals")
public class MemberGoalController {

    private final MemberGoalService memberGoalService;

    public MemberGoalController(MemberGoalService memberGoalService) {
        this.memberGoalService = memberGoalService;
    }

    // 회원 본인 목표값 조회
    // GET /api/member/goals
    @GetMapping
    public ResponseEntity<MemberGoalResponse> getMyGoals(
            @RequestHeader("Authorization") String authorization
    ) {
        return ResponseEntity.ok(memberGoalService.getMyGoals(authorization));
    }

    // 트레이너가 특정 회원의 목표값 조회
    // GET /api/member/goals/member/{memberId}
    // 트레이너 화면(member-detail.tsx)에서 회원 목표 칼로리/탄수화물/단백질/지방 조회용
    @GetMapping("/member/{memberId}")
    public ResponseEntity<MemberGoalResponse> getMemberGoals(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId
    ) {
        return ResponseEntity.ok(memberGoalService.getMemberGoals(memberId));
    }

    // 회원 본인 목표값 수정
    // PUT /api/member/goals
    @PutMapping
    public ResponseEntity<MemberGoalResponse> updateMyGoals(
            @RequestHeader("Authorization") String authorization,
            @RequestBody MemberGoalRequest request
    ) {
        return ResponseEntity.ok(memberGoalService.updateMyGoals(authorization, request));
    }
}
