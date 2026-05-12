package com.fitlog.fitlog.profile.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.dto.MemberProfileRequest;
import com.fitlog.fitlog.trainer.dto.TrainerProfileRequest;
import com.fitlog.fitlog.trainer.dto.TrainerProfileResponse;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.auth.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class ProfileService {

    private final UserRepository userRepository;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final JwtService jwtService;

    public ProfileService(
            UserRepository userRepository,
            TrainerRepository trainerRepository,
            MemberRepository memberRepository,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.jwtService = jwtService;
    }

    // ── 트레이너 프로필 설정 ─────────────────────────────────────────────
    @Transactional
    public void setupTrainerProfile(String token, TrainerProfileRequest req) {
        User user = getUserFromToken(token);
        user.setName(req.getName());
        user.setRole(User.Role.TRAINER);
        userRepository.save(user);

        Trainer trainer = trainerRepository.findByUser(user).orElse(new Trainer());
        trainer.setUser(user);
        trainer.setGymName(req.getGymName());
        trainer.setWorkDays(req.getWorkDays());
        trainer.setStartTime(req.getStartTime());
        trainer.setEndTime(req.getEndTime());

        // 트레이너 초대 코드 자동 생성 (6자리)
        if (trainer.getTrainerCode() == null || trainer.getTrainerCode().isBlank()) {
            trainer.setTrainerCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        }

        trainerRepository.save(trainer);
    }

    // 트레이너 조회
    public TrainerProfileResponse getTrainerProfile(String authorization) {
        User user = getUserFromToken(authorization);

        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        return new TrainerProfileResponse(
                trainer.getId(),
                user.getName(),
                trainer.getGymName(),
                trainer.getWorkDays(),
                trainer.getStartTime(),
                trainer.getEndTime(),
                trainer.getTrainerCode()
        );
    }

    // 트레이너 수정
    public void updateTrainerProfile(String authorization, TrainerProfileRequest req) {
        User user = getUserFromToken(authorization);

        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));

        trainer.setGymName(req.getGymName());
        trainer.setWorkDays(req.getWorkDays());
        trainer.setStartTime(req.getStartTime());
        trainer.setEndTime(req.getEndTime());

        trainerRepository.save(trainer);
    }

    // ── 회원 프로필 설정 ─────────────────────────────────────────────────
    @Transactional
    public void setupMemberProfile(String token, MemberProfileRequest req) {
        User user = getUserFromToken(token);
        user.setName(req.getName());
        user.setRole(User.Role.MEMBER);
        userRepository.save(user);

        Member member = memberRepository.findByUser(user).orElse(new Member());
        member.setUser(user);
        member.setPhone(req.getPhone());
        member.setHeight(req.getHeight());
        member.setWeight(req.getWeight());
        member.setBodyFat(req.getBodyFat());
        member.setMuscleMass(req.getMuscleMass());
        member.setPtRemaining(0);

        // 트레이너 코드로 트레이너 연결
        if (req.getTrainerCode() != null && !req.getTrainerCode().isBlank()) {
            trainerRepository.findByTrainerCode(req.getTrainerCode())
                    .ifPresent(member::setTrainer);
        }

        memberRepository.save(member);
    }

    // ── 공통 ─────────────────────────────────────────────────────────────
    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }

    private TrainerProfileResponse toTrainerProfileResponse(User user, Trainer trainer) {
        return new TrainerProfileResponse(
                trainer.getId(),
                user.getName(),
                trainer.getGymName(),
                trainer.getWorkDays(),
                trainer.getStartTime(),
                trainer.getEndTime(),
                trainer.getTrainerCode()
        );
    }
}
