package com.fitlog.fitlog.member.dto;

public class MemberProfileRequest {

    private String name;
    private String phone;
    private String trainerCode;   // 선택
    private Double height;
    private Double weight;
    private Double bodyFat;       // 선택
    private Double muscleMass;    // 선택

    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getTrainerCode() { return trainerCode; }
    public Double getHeight() { return height; }
    public Double getWeight() { return weight; }
    public Double getBodyFat() { return bodyFat; }
    public Double getMuscleMass() { return muscleMass; }
}