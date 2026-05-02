package com.fitlog.fitlog.controller;

import com.fitlog.fitlog.entity.Member;
import com.fitlog.fitlog.entity.Trainer;
import com.fitlog.fitlog.entity.User;
import com.fitlog.fitlog.repository.MemberRepository;
import com.fitlog.fitlog.repository.TrainerRepository;
import com.fitlog.fitlog.repository.UserRepository;
import com.fitlog.fitlog.service.JwtService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/trainer")
public class TrainerController {

    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public TrainerController(
            TrainerRepository trainerRepository,
            MemberRepository memberRepository,
            UserRepository userRepository,
            JwtService jwtService
    ) {
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    // GET /api/trainer/members - 내 회원 목록 조회
    @GetMapping("/members")
    public List<Member> getMyMembers(@RequestHeader("Authorization") String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        return memberRepository.findAllByTrainer(trainer);
    }

    // GET /api/trainer/me - 내 트레이너 정보 조회
    @GetMapping("/me")
    public Trainer getMyInfo(@RequestHeader("Authorization") String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        return trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }
}