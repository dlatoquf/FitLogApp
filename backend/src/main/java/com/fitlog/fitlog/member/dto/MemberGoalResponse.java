package com.fitlog.fitlog.member.dto;

import com.fitlog.fitlog.member.entity.MemberGoal;

public class MemberGoalResponse {

    private String purpose;
    private Double targetWeight;
    private Double targetCalories;
    private Double targetCarbs;
    private Double targetProtein;
    private Double targetFat;

    public MemberGoalResponse(MemberGoal goal) {
        this.purpose = goal.getPurpose().name();
        this.targetWeight = goal.getTargetWeight();
        this.targetCalories = goal.getTargetCalories();
        this.targetCarbs = goal.getTargetCarbs();
        this.targetProtein = goal.getTargetProtein();
        this.targetFat = goal.getTargetFat();
    }

    public String getPurpose() { return purpose; }
    public Double getTargetWeight() { return targetWeight; }
    public Double getTargetCalories() { return targetCalories; }
    public Double getTargetCarbs() { return targetCarbs; }
    public Double getTargetProtein() { return targetProtein; }
    public Double getTargetFat() { return targetFat; }
}