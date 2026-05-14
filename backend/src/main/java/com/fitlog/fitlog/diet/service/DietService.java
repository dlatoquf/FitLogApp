package com.fitlog.fitlog.diet.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.diet.dto.DietFeedbackRequest;
import com.fitlog.fitlog.diet.dto.DietFeedbackResponse;
import com.fitlog.fitlog.diet.dto.DietLogRequest;
import com.fitlog.fitlog.diet.dto.DietLogResponse;
import com.fitlog.fitlog.diet.entity.DietFeedback;
import com.fitlog.fitlog.diet.entity.DietLog;
import com.fitlog.fitlog.diet.repository.DietFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietLogRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.entity.Notification;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
public class DietService {

    private final DietLogRepository dietLogRepository;
    private final DietFeedbackRepository dietFeedbackRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final NotificationRepository notificationRepository;

    public DietService(
            DietLogRepository dietLogRepository,
            DietFeedbackRepository dietFeedbackRepository,
            MemberRepository memberRepository,
            TrainerRepository trainerRepository,
            JwtService jwtService,
            NotificationRepository notificationRepository
    ) {
        this.dietLogRepository = dietLogRepository;
        this.dietFeedbackRepository = dietFeedbackRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void saveDietLog(String authorization, DietLogRequest request) {
        Member member = getMemberFromToken(authorization);

        DietLog log = new DietLog();
        log.setMember(member);
        applyDietLogRequest(log, request);

        dietLogRepository.save(log);

        // 식단 등록 알림: 회원 -> 트레이너
        if (member.getTrainer() != null && member.getTrainer().getUser() != null) {
            Notification notification = new Notification();
            notification.setUser(member.getTrainer().getUser());
            notification.setType("DIET_LOG");
            notification.setContent(member.getUser().getName() + " 회원이 식단을 등록했어요.");
            notification.setTargetType("MEMBER");
            notification.setTargetId(member.getId());

            notificationRepository.save(notification);
        }
    }

    @Transactional
    public void updateDietLog(String authorization, Long logId, DietLogRequest request) {
        Member member = getMemberFromToken(authorization);

        DietLog log = dietLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("식단 기록을 찾을 수 없습니다."));

        if (log.getMember() == null || !log.getMember().getId().equals(member.getId())) {
            throw new RuntimeException("수정 권한이 없습니다.");
        }

        applyDietLogRequest(log, request);
        dietLogRepository.save(log);
    }

    @Transactional
    public void deleteDietLog(String authorization, Long logId) {
        Member member = getMemberFromToken(authorization);

        DietLog log = dietLogRepository.findById(logId)
                .orElseThrow(() -> new RuntimeException("식단 기록을 찾을 수 없습니다."));

        if (log.getMember() == null || !log.getMember().getId().equals(member.getId())) {
            throw new RuntimeException("삭제 권한이 없습니다.");
        }

        dietLogRepository.delete(log);
    }

    private void applyDietLogRequest(DietLog log, DietLogRequest request) {
        if (request.getDate() != null) {
            log.setDate(LocalDate.parse(request.getDate()));
        }

        if (request.getMealType() != null) {
            log.setMealType(DietLog.MealType.valueOf(request.getMealType()));
        }

        // 식약처/내부DB 결과는 한글 이름 → ko 컬럼에 저장
        // FatSecret 결과는 영어 이름 → en 컬럼에 저장
        String foodName = request.getFoodName();
        if (request.getFatSecretFoodId() != null && request.getFatSecretFoodId().startsWith("fatsecret:")) {
            log.setFoodNameEn(foodName);
            log.setFoodNameKo(foodName);
        } else {
            // 내부DB, 식약처, 직접입력 모두 한글 이름
            log.setFoodNameKo(foodName);
            log.setFoodNameEn(foodName);  // NOT NULL 제약으로 같은 값 채움
        }

        log.setCalories(request.getCalories());
        log.setCarbs(request.getCarbs());
        log.setProtein(request.getProtein());
        log.setFat(request.getFat());
    }

    @Transactional(readOnly = true)
    public DietLogResponse getDietByDate(Member member, LocalDate date) {
        List<DietLog> logs = dietLogRepository.findByMemberAndDate(member, date);

        double totalCalories = logs.stream()
                .mapToDouble(l -> l.getCalories() != null ? l.getCalories() : 0)
                .sum();

        double totalCarbs = logs.stream()
                .mapToDouble(l -> l.getCarbs() != null ? l.getCarbs() : 0)
                .sum();

        double totalProtein = logs.stream()
                .mapToDouble(l -> l.getProtein() != null ? l.getProtein() : 0)
                .sum();

        double totalFat = logs.stream()
                .mapToDouble(l -> l.getFat() != null ? l.getFat() : 0)
                .sum();

        List<DietLogResponse.MealGroup> meals = Arrays.stream(DietLog.MealType.values())
                .map(type -> {
                    List<DietLogResponse.FoodItem> foods = logs.stream()
                            .filter(l -> l.getMealType() == type)
                            .map(l -> new DietLogResponse.FoodItem(
                                    l.getId(),
                                    l.getFoodNameKo() != null ? l.getFoodNameKo() : l.getFoodNameEn(),
                                    l.getCalories() != null ? l.getCalories() : 0,
                                    l.getCarbs() != null ? l.getCarbs() : 0,
                                    l.getProtein() != null ? l.getProtein() : 0,
                                    l.getFat() != null ? l.getFat() : 0
                            ))
                            .toList();

                    return new DietLogResponse.MealGroup(type.name(), foods);
                })
                .toList();

        return new DietLogResponse(
                date.toString(),
                totalCalories,
                totalCarbs,
                totalProtein,
                totalFat,
                meals
        );
    }

    @Transactional(readOnly = true)
    public DietLogResponse getMyDiet(String authorization, String date) {
        Member member = getMemberFromToken(authorization);
        return getDietByDate(member, LocalDate.parse(date));
    }

    @Transactional(readOnly = true)
    public List<DietLogResponse> getMyWeeklyDiet(String authorization, String weekStart) {
        Member member = getMemberFromToken(authorization);
        LocalDate start = LocalDate.parse(weekStart);

        List<DietLogResponse> result = new ArrayList<>();

        for (int i = 0; i < 7; i++) {
            result.add(getDietByDate(member, start.plusDays(i)));
        }

        return result;
    }

    @Transactional(readOnly = true)
    public DietLogResponse getMemberDiet(String authorization, Long memberId, String date) {
        Long trainerId = getTrainerIdFromToken(authorization);

        Member member = memberRepository.findByIdAndTrainerId(memberId, trainerId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        return getDietByDate(member, LocalDate.parse(date));
    }

    @Transactional(readOnly = true)
    public List<DietLogResponse> getMemberWeeklyDiet(String authorization, Long memberId, String weekStart) {
        Long trainerId = getTrainerIdFromToken(authorization);

        Member member = memberRepository.findByIdAndTrainerId(memberId, trainerId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        LocalDate start = LocalDate.parse(weekStart);

        List<DietLogResponse> result = new ArrayList<>();

        for (int i = 0; i < 7; i++) {
            result.add(getDietByDate(member, start.plusDays(i)));
        }

        return result;
    }

    @Transactional
    public void saveFeedback(String authorization, DietFeedbackRequest request) {
        Trainer trainer = getTrainerFromToken(authorization);

        Member member = memberRepository.findByIdAndTrainerId(request.getMemberId(), trainer.getId())
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        DietFeedback feedback = new DietFeedback();
        feedback.setMember(member);
        feedback.setTrainer(trainer);
        feedback.setTargetDate(LocalDate.parse(request.getTargetDate()));
        feedback.setComment(request.getComment());

        DietFeedback savedFeedback = dietFeedbackRepository.save(feedback);

        Notification notification = new Notification();
        notification.setUser(member.getUser());
        notification.setType("FEEDBACK");
        notification.setContent("트레이너가 " + request.getTargetDate() + " 식단 피드백을 남겼어요!");
        notification.setTargetType("FEEDBACK");
        notification.setTargetId(savedFeedback.getId());

        notificationRepository.save(notification);
    }

    @Transactional(readOnly = true)
    public List<DietFeedbackResponse> getMyFeedbacks(String authorization) {
        Member member = getMemberFromToken(authorization);

        return dietFeedbackRepository.findByMemberOrderByCreatedAtDesc(member)
                .stream()
                .map(DietFeedbackResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DietFeedbackResponse> getMemberFeedbacks(String authorization, Long memberId) {
        Long trainerId = getTrainerIdFromToken(authorization);

        Member member = memberRepository.findByIdAndTrainerId(memberId, trainerId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        return dietFeedbackRepository.findByMemberOrderByCreatedAtDesc(member)
                .stream()
                .map(DietFeedbackResponse::from)
                .toList();
    }

    private Member getMemberFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        // 기존: userRepository.findById(userId) -> memberRepository.findByUser(user)
        // 수정: userId로 바로 member + user + trainer + trainer.user 조회
        return memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
    }

    private Trainer getTrainerFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        // 기존: userRepository.findById(userId) -> trainerRepository.findByUser(user)
        // 수정: userId로 바로 trainer + user 조회
        return trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }

    private Long getTrainerIdFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        return trainerRepository.findTrainerIdByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }
}