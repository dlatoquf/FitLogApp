package com.fitlog.fitlog.service;

import com.fitlog.fitlog.dto.DietFeedbackRequest;
import com.fitlog.fitlog.dto.DietLogRequest;
import com.fitlog.fitlog.dto.DietLogResponse;
import com.fitlog.fitlog.entity.*;
import com.fitlog.fitlog.repository.*;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DietService {

    private final DietLogRepository dietLogRepository;
    private final DietFeedbackRepository dietFeedbackRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public DietService(
            DietLogRepository dietLogRepository,
            DietFeedbackRepository dietFeedbackRepository,
            MemberRepository memberRepository,
            TrainerRepository trainerRepository,
            UserRepository userRepository,
            JwtService jwtService
    ) {
        this.dietLogRepository = dietLogRepository;
        this.dietFeedbackRepository = dietFeedbackRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    // ── 회원: 식단 기록 저장 ──────────────────────────────────────────────
    public void saveDietLog(String authorization, DietLogRequest request) {
        Member member = getMemberFromToken(authorization);

        DietLog log = new DietLog();
        log.setMember(member);
        log.setDate(LocalDate.parse(request.getDate()));
        log.setMealType(DietLog.MealType.valueOf(request.getMealType()));
        log.setFoodName(request.getFoodName());
        log.setCalories(request.getCalories());
        log.setCarbs(request.getCarbs());
        log.setProtein(request.getProtein());
        log.setFat(request.getFat());
        log.setFatSecretFoodId(request.getFatSecretFoodId());

        dietLogRepository.save(log);
    }

    // ── 회원: 식단 삭제 ───────────────────────────────────────────────────
    public void deleteDietLog(String authorization, Long logId) {
        Member member = getMemberFromToken(authorization);
        DietLog log = dietLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("식단 기록을 찾을 수 없습니다."));
        if (!log.getMember().getId().equals(member.getId())) {
            throw new RuntimeException("삭제 권한이 없습니다.");
        }
        dietLogRepository.delete(log);
    }

    // ── 회원/트레이너: 특정 날짜 식단 조회 ───────────────────────────────
    public DietLogResponse getDietByDate(Member member, LocalDate date) {
        List<DietLog> logs = dietLogRepository.findByMemberAndDate(member, date);

        double totalCalories = logs.stream().mapToDouble(l -> l.getCalories() != null ? l.getCalories() : 0).sum();
        double totalCarbs    = logs.stream().mapToDouble(l -> l.getCarbs()    != null ? l.getCarbs()    : 0).sum();
        double totalProtein  = logs.stream().mapToDouble(l -> l.getProtein()  != null ? l.getProtein()  : 0).sum();
        double totalFat      = logs.stream().mapToDouble(l -> l.getFat()      != null ? l.getFat()      : 0).sum();

        Map<String, String> mealLabels = Map.of(
                "BREAKFAST", "아침", "LUNCH", "점심", "DINNER", "저녁", "SNACK", "간식"
        );

        List<DietLogResponse.MealGroup> meals = Arrays.stream(DietLog.MealType.values())
                .map(type -> {
                    List<DietLogResponse.FoodItem> foods = logs.stream()
                            .filter(l -> l.getMealType() == type)
                            .map(l -> new DietLogResponse.FoodItem(
                                    l.getId(),
                                    l.getFoodName(),
                                    l.getCalories()  != null ? l.getCalories()  : 0,
                                    l.getCarbs()     != null ? l.getCarbs()     : 0,
                                    l.getProtein()   != null ? l.getProtein()   : 0,
                                    l.getFat()       != null ? l.getFat()       : 0
                            ))
                            .toList();
                    return new DietLogResponse.MealGroup(type.name(), foods);
                })
                .toList();

        return new DietLogResponse(date.toString(), totalCalories, totalCarbs, totalProtein, totalFat, meals);
    }

    // ── 회원: 내 식단 조회 ────────────────────────────────────────────────
    public DietLogResponse getMyDiet(String authorization, String date) {
        Member member = getMemberFromToken(authorization);
        return getDietByDate(member, LocalDate.parse(date));
    }

    // ── 회원: 주간 식단 조회 ──────────────────────────────────────────────
    public List<DietLogResponse> getMyWeeklyDiet(String authorization, String weekStart) {
        Member member = getMemberFromToken(authorization);
        LocalDate start = LocalDate.parse(weekStart);
        List<DietLogResponse> result = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            result.add(getDietByDate(member, start.plusDays(i)));
        }
        return result;
    }

    // ── 트레이너: 회원 식단 조회 ──────────────────────────────────────────
    public DietLogResponse getMemberDiet(String authorization, Long memberId, String date) {
        getTrainerFromToken(authorization); // 트레이너 권한 확인
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        return getDietByDate(member, LocalDate.parse(date));
    }

    // ── 트레이너: 회원 주간 식단 조회 ────────────────────────────────────
    public List<DietLogResponse> getMemberWeeklyDiet(String authorization, Long memberId, String weekStart) {
        getTrainerFromToken(authorization);
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        LocalDate start = LocalDate.parse(weekStart);
        List<DietLogResponse> result = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            result.add(getDietByDate(member, start.plusDays(i)));
        }
        return result;
    }

    // ── 트레이너: 피드백 저장 ─────────────────────────────────────────────
    public void saveFeedback(String authorization, DietFeedbackRequest request) {
        Trainer trainer = getTrainerFromToken(authorization);
        Member member = memberRepository.findById(request.getMemberId())
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        DietFeedback feedback = new DietFeedback();
        feedback.setMember(member);
        feedback.setTrainer(trainer);
        feedback.setTargetDate(LocalDate.parse(request.getTargetDate()));
        feedback.setComment(request.getComment());
        dietFeedbackRepository.save(feedback);
    }

    // ── 회원: 피드백 조회 ─────────────────────────────────────────────────
    public List<DietFeedback> getMyFeedbacks(String authorization) {
        Member member = getMemberFromToken(authorization);
        return dietFeedbackRepository.findByMemberOrderByCreatedAtDesc(member);
    }

    // ── 트레이너: 특정 회원 피드백 조회 ──────────────────────────────────
    public List<DietFeedback> getMemberFeedbacks(String authorization, Long memberId) {
        getTrainerFromToken(authorization);
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        return dietFeedbackRepository.findByMemberOrderByCreatedAtDesc(member);
    }

    // ── 공통 헬퍼 ─────────────────────────────────────────────────────────
    private Member getMemberFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        return memberRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
    }

    private Trainer getTrainerFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
        return trainerRepository.findByUser(user)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }
}