package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.dto.MemberGoalRequest;
import com.fitlog.fitlog.member.dto.MemberGoalResponse;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.entity.MemberGoal;
import com.fitlog.fitlog.member.repository.MemberGoalRepository;
import com.fitlog.fitlog.member.repository.MemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Service
public class MemberGoalService {

    private final MemberGoalRepository memberGoalRepository;
    private final MemberRepository memberRepository;
    private final JwtService jwtService;

    public MemberGoalService(MemberGoalRepository memberGoalRepository,
                             MemberRepository memberRepository,
                             JwtService jwtService) {
        this.memberGoalRepository = memberGoalRepository;
        this.memberRepository = memberRepository;
        this.jwtService = jwtService;
    }

    @Transactional
    public MemberGoalResponse getMyGoals(String authorization) {

        Member member = getMemberFromToken(authorization);

        MemberGoal goal = memberGoalRepository
                .findTopByMemberOrderByCreatedAtDesc(member)
                .orElseGet(() -> memberGoalRepository.save(createDefaultGoal(member)));

        return new MemberGoalResponse(goal);
    }


    @Transactional
    public MemberGoalResponse getMemberGoals(Long memberId) {

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() ->
                        new RuntimeException("회원 정보를 찾을 수 없습니다."));

        MemberGoal goal = memberGoalRepository
                .findTopByMemberOrderByCreatedAtDesc(member)
                .orElseGet(() -> memberGoalRepository.save(createDefaultGoal(member)));

        // 고정 기본값(1800kcal)이고 체중이 있으면 재계산
        if (goal.getTargetCalories() != null
                && goal.getTargetCalories() == 1800.0
                && member.getWeight() != null
                && member.getWeight() > 0) {
            applyWeightBasedGoal(goal, member.getWeight());
            goal = memberGoalRepository.save(goal);
        }

        return new MemberGoalResponse(goal);
    }

    private void applyWeightBasedGoal(MemberGoal goal, Double weight) {
        double calories = Math.round(weight * 33);
        double protein  = Math.round(weight * 2.2);
        double fat      = Math.round(weight * 1.0);
        double carbs    = Math.round(Math.max(calories - protein * 4 - fat * 9, 0) / 4);
        goal.setTargetCalories(calories);
        goal.setTargetProtein(protein);
        goal.setTargetFat(fat);
        goal.setTargetCarbs(carbs);
    }

    @Transactional
    public MemberGoalResponse updateMyGoals(
            String authorization,
            MemberGoalRequest request
    ) {

        Member member = getMemberFromToken(authorization);

        MemberGoal goal = memberGoalRepository
                .findTopByMemberOrderByCreatedAtDesc(member)
                .orElseGet(() -> {
                    MemberGoal newGoal = new MemberGoal();
                    newGoal.setMember(member);
                    newGoal.setPurpose(MemberGoal.Purpose.MAINTAIN);
                    newGoal.setStartDate(LocalDate.now());
                    return newGoal;
                });

        // 목적
        if (request.getPurpose() != null &&
                !request.getPurpose().isBlank()) {

            goal.setPurpose(
                    MemberGoal.Purpose.valueOf(
                            request.getPurpose().toUpperCase()
                    )
            );
        }

        // 목표 체중
        if (request.getTargetWeight() != null) {
            goal.setTargetWeight(request.getTargetWeight());
        }

        // 목표 칼로리
        if (request.getTargetCalories() != null) {
            goal.setTargetCalories(request.getTargetCalories());
        }

        // 목표 탄수화물
        if (request.getTargetCarbs() != null) {
            goal.setTargetCarbs(request.getTargetCarbs());
        }

        // 목표 단백질
        if (request.getTargetProtein() != null) {
            goal.setTargetProtein(request.getTargetProtein());
        }

        // 목표 지방
        if (request.getTargetFat() != null) {
            goal.setTargetFat(request.getTargetFat());
        }

        MemberGoal saved = memberGoalRepository.save(goal);

        return new MemberGoalResponse(saved);
    }

    private Member getMemberFromToken(String authorization) {

        String token = authorization.replace("Bearer ", "");

        Long userId = jwtService.getUserIdFromToken(token);

        return memberRepository.findByUserId(userId)
                .orElseThrow(() ->
                        new RuntimeException("회원 정보를 찾을 수 없습니다."));
    }

    private MemberGoal createDefaultGoal(Member member) {

        MemberGoal goal = new MemberGoal();

        goal.setMember(member);
        goal.setPurpose(MemberGoal.Purpose.MAINTAIN);
        goal.setStartDate(LocalDate.now());

        Double weight = member.getWeight();

        // 체중 없을 경우 기본값
        if (weight == null || weight <= 0) {

            goal.setTargetCalories(1800.0);
            goal.setTargetCarbs(225.0);
            goal.setTargetProtein(90.0);
            goal.setTargetFat(60.0);

            return goal;
        }

        // 유지 칼로리
        double targetCalories = Math.round(weight * 33);

        // 단백질
        double targetProtein = Math.round(weight * 2.2);

        // 지방
        double targetFat = Math.round(weight * 1.0);

        // 탄수화물
        double remainCalories =
                Math.max(
                        targetCalories
                                - (targetProtein * 4)
                                - (targetFat * 9),
                        0
                );

        double targetCarbs = Math.round(remainCalories / 4);

        goal.setTargetWeight(weight);
        goal.setTargetCalories(targetCalories);
        goal.setTargetProtein(targetProtein);
        goal.setTargetFat(targetFat);
        goal.setTargetCarbs(targetCarbs);

        return goal;
    }
}