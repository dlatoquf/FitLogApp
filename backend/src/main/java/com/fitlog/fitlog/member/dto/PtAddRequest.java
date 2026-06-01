package com.fitlog.fitlog.member.dto;

public class PtAddRequest {

    private int sessions;         // 추가할 횟수
    private Long amount;          // 결제 금액
    private String startDate;     // 시작일 (첫 등록이면 세팅)
    private String endDate;       // 만료일
    private String memo;
    private String contractDate;  // 결제 기준일 (과거 건 등록 시, 예: "2026-03-15")

    public int getSessions() { return sessions; }
    public Long getAmount() { return amount; }
    public String getStartDate() { return startDate; }
    public String getEndDate() { return endDate; }
    public String getMemo() { return memo; }
    public String getContractDate() { return contractDate; }

    public void setSessions(int sessions) { this.sessions = sessions; }
    public void setAmount(Long amount) { this.amount = amount; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public void setMemo(String memo) { this.memo = memo; }
    public void setContractDate(String contractDate) { this.contractDate = contractDate; }
}