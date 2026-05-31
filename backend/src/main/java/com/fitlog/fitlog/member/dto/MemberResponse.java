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
    private boolean connected;       // true = ACTIVE 현재 트레이너 소속
    private boolean moved;           // true = 다른 트레이너로 이동한 전 회원
    private String disconnectedAt;   // 연결 해제일 (이전 트레이너 기록 열람 기준일)
    private String ptEndedAt;        // PT 잔여 0회가 된 날짜 (7일 유예 기준)

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
        this.connected = member.getStatus() == Member.Status.ACTIVE;
        // previousTrainerId가 있고 현재 trainer가 다른 트레이너면 "이동된 회원"
        this.moved = member.getPreviousTrainerId() != null
                  && (member.getTrainer() == null
                      || !member.getPreviousTrainerId().equals(member.getTrainer().getId()));
        this.disconnectedAt = member.getDisconnectedAt() != null
                ? member.getDisconnectedAt().toString() : null;
        this.ptEndedAt = member.getPtEndedAt() != null
                ? member.getPtEndedAt().toString() : null;
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
    public boolean isConnected() { return connected; }
    public boolean isMoved() { return moved; }
    public String getDisconnectedAt() { return disconnectedAt; }
    public String getPtEndedAt() { return ptEndedAt; }

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