package com.fitlog.fitlog.member.dto;

public class MemberProfileRequest {

    private String name;
    private String phone;
    private String birthDate;     // 필수 (YYYY-MM-DD)
    private String trainerCode;   // 필수
    private Double height;        // 필수
    private Double weight;        // 필수
    private Double bodyFat;       // 선택
    private Double muscleMass;    // 선택

    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getBirthDate() { return birthDate; }
    public String getTrainerCode() { return trainerCode; }
    public Double getHeight() { return height; }
    public Double getWeight() { return weight; }
    public Double getBodyFat() { return bodyFat; }
    public Double getMuscleMass() { return muscleMass; }
}