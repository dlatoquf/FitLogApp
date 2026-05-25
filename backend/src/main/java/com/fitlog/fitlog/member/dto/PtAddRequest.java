package com.fitlog.fitlog.member.dto;

public class PtAddRequest {

    private int sessions;      // 추가할 횟수
    private Long amount;       // 결제 금액
    private String startDate;  // 시작일 (첫 등록이면 세팅)
    private String endDate;    // 만료일
    private String memo;

    public int getSessions() { return sessions; }
    public Long getAmount() { return amount; }
    public String getStartDate() { return startDate; }
    public String getEndDate() { return endDate; }
    public String getMemo() { return memo; }
}