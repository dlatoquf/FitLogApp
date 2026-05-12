package com.fitlog.fitlog.member.dto;

import com.fitlog.fitlog.member.entity.Member;

public class MemberResponse {

    private Long id;
    private UserInfo user;
    private Integer ptRemaining;
    private Integer ptTotal;
    private String ptStartDate;
    private String ptExpDate;
    private String goal;
    private String memo;
    private Double height;
    private Double weight;
    private Double bodyFat;
    private Double muscleMass;
    private String phone;
    private double todayProtein;

    public MemberResponse(Member member) {
        this.id = member.getId();

        if (member.getUser() != null) {
            this.user = new UserInfo(
                    member.getUser().getId(),
                    member.getUser().getName()
            );
        }

        this.ptRemaining = member.getPtRemaining();
        this.ptTotal = member.getPtTotal();
        this.ptStartDate = member.getPtStartDate();
        this.ptExpDate = member.getPtExpDate();
        this.goal = member.getGoal();
        this.memo = member.getMemo();
        this.height = member.getHeight();
        this.weight = member.getWeight();
        this.bodyFat = member.getBodyFat();
        this.muscleMass = member.getMuscleMass();
        this.phone = member.getPhone();
    }

    public Long getId() { return id; }
    public UserInfo getUser() { return user; }
    public Integer getPtRemaining() { return ptRemaining; }
    public Integer getPtTotal() { return ptTotal; }
    public String getPtStartDate() { return ptStartDate; }
    public String getPtExpDate() { return ptExpDate; }
    public String getGoal() { return goal; }
    public String getMemo() { return memo; }
    public Double getHeight() { return height; }
    public Double getWeight() { return weight; }
    public Double getBodyFat() { return bodyFat; }
    public Double getMuscleMass() { return muscleMass; }
    public String getPhone() { return phone; }

    public static class UserInfo {
        private Long id;
        private String name;

        public UserInfo(Long id, String name) {
            this.id = id;
            this.name = name;
        }

        public Long getId() { return id; }
        public String getName() { return name; }
    }
}