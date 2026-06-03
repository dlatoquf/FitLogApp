package com.fitlog.fitlog.profile.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.gym.entity.Gym;
import com.fitlog.fitlog.gym.repository.GymRepository;
import com.fitlog.fitlog.member.dto.MemberProfileRequest;
import com.fitlog.fitlog.trainer.dto.TrainerProfileRequest;
import com.fitlog.fitlog.trainer.dto.TrainerProfileResponse;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.schedule.service.ScheduleService;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Service
public class ProfileService {

    private final UserRepository userRepository;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final GymRepository gymRepository;
    private final JwtService jwtService;
    private final ScheduleService scheduleService;

    public ProfileService(
            UserRepository userRepository,
            TrainerRepository trainerRepository,
            MemberRepository memberRepository,
            GymRepository gymRepository,
            JwtService jwtService,
            @Lazy ScheduleService scheduleService
    ) {
        this.userRepository = userRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.gymRepository = gymRepository;
        this.jwtService = jwtService;
        this.scheduleService = scheduleService;
    }

    // ── 트레이너 프로필 설정 ─────────────────────────────────────────────
    @Transactional
    public void setupTrainerProfile(String token, TrainerProfileRequest req) {
        User user = getUserFromToken(token);
        user.setName(req.getName());
        user.setRole(User.Role.TRAINER);
        userRepository.save(user);

        boolean isNew = !trainerRepository.findByUser(user).isPresent();
        Trainer trainer = trainerRepository.findByUser(user).orElse(new Trainer());
        trainer.setUser(user);
        trainer.setGymName(req.getGymName());
        trainer.setWorkDays(req.getWorkDays());
        trainer.setStartTime(req.getStartTime());
        trainer.setEndTime(req.getEndTime());

        if (trainer.getTrainerCode() == null || trainer.getTrainerCode().isBlank()) {
            trainer.setTrainerCode(UUID.randomUUID().toString().substring(0, 6).toUpperCase());
        }

        // 제휴 코드 처리
        applyAffiliateCode(trainer, req.getAffiliateCode());

        // 최초 등록 시 1개월 무료 체험 부여
        if (isNew && trainer.getTrialEndDate() == null) {
            trainer.setTrialEndDate(java.time.LocalDate.now().plusMonths(1));
        }

        Trainer saved = trainerRepository.save(trainer);

        // 슬롯 생성은 트레이너가 스케줄 탭에서 직접 offset 선택 후 진행
    }

    // 트레이너 조회
    public TrainerProfileResponse getTrainerProfile(String authorization) {
        User user = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));
        boolean affiliated = trainer.isGymAffiliationActive();
        String affiliatedGymName = affiliated ? trainer.getGym().getName() : null;
        String gymConfirmedAt = trainer.getGymConfirmedAt() != null ? trainer.getGymConfirmedAt().toString() : null;
        return new TrainerProfileResponse(
                trainer.getId(),
                user.getName(),
                trainer.getGymName(),
                trainer.getWorkDays(),
                trainer.getStartTime(),
                trainer.getEndTime(),
                trainer.getTrainerCode(),
                affiliated,
                affiliatedGymName,
                gymConfirmedAt
        );
    }

    // 트레이너 수정
    @Transactional
    public void updateTrainerProfile(String authorization, TrainerProfileRequest req) {
        User user = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 없음"));
        trainer.setGymName(req.getGymName());
        trainer.setWorkDays(req.getWorkDays());
        trainer.setStartTime(req.getStartTime());
        trainer.setEndTime(req.getEndTime());
        // 코드가 명시적으로 전달된 경우에만 제휴 업데이트
        if (req.getAffiliateCode() != null) {
            applyAffiliateCode(trainer, req.getAffiliateCode());
        }
        trainerRepository.save(trainer);
    }

    // 제휴 코드 처리 공통 메서드
    private void applyAffiliateCode(Trainer trainer, String code) {
        if (code == null || code.isBlank()) return;
        Optional<Gym> gymOpt = gymRepository.findByAffiliateCode(code.toUpperCase().trim());
        if (gymOpt.isEmpty()) {
            throw new RuntimeException("유효하지 않은 제휴 코드예요.");
        }
        Gym gym = gymOpt.get();
        if (!"ACTIVE".equals(gym.getStatus()) || gym.getContractEnd().isBefore(LocalDate.now())) {
            throw new RuntimeException("계약이 만료된 헬스장이에요.");
        }
        trainer.setGym(gym);
        trainer.setGymConfirmedAt(LocalDate.now());
    }

    // ── 회원 프로필 설정 ─────────────────────────────────────────────────
    @Transactional
    public void setupMemberProfile(String token, MemberProfileRequest req) {
        if (req.getPhone() == null || req.getPhone().isBlank()) {
            throw new RuntimeException("전화번호를 입력해주세요.");
        }
        if (req.getHeight() == null) {
            throw new RuntimeException("키를 입력해주세요.");
        }
        if (req.getWeight() == null) {
            throw new RuntimeException("체중을 입력해주세요.");
        }

        User user = getUserFromToken(token);
        if (req.getName() != null && !req.getName().isBlank()) {
            user.setName(req.getName());
        }
        user.setRole(User.Role.MEMBER);
        final User savedUser = userRepository.save(user);

        Member member = memberRepository.findByUser(savedUser).orElseGet(() -> {
            Member m = new Member();
            m.setUser(savedUser);
            return m;
        });
        if (member.getUser() == null) member.setUser(savedUser);
        member.setPhone(req.getPhone());
        if (req.getBirthDate() != null && !req.getBirthDate().isBlank()) {
            member.setBirthDate(req.getBirthDate());
        }
        member.setHeight(req.getHeight());
        member.setWeight(req.getWeight());
        member.setBodyFat(req.getBodyFat());
        member.setMuscleMass(req.getMuscleMass());
        if (member.getPtRemaining() == null) member.setPtRemaining(0);

        memberRepository.save(member);
    }

    // ── 공통 ─────────────────────────────────────────────────────────────
    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }
}
