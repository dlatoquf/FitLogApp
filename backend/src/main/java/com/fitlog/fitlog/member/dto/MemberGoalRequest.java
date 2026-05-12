package com.fitlog.fitlog.member.dto;

public class MemberGoalRequest {

    private String purpose;
    private Double targetWeight;
    private Double targetCalories;
    private Double targetCarbs;
    private Double targetProtein;
    private Double targetFat;

    public String getPurpose() { return purpose; }
    public Double getTargetWeight() { return targetWeight; }
    public Double getTargetCalories() { return targetCalories; }
    public Double getTargetCarbs() { return targetCarbs; }
    public Double getTargetProtein() { return targetProtein; }
    public Double getTargetFat() { return targetFat; }
}