package com.fitlog.fitlog.diet.dto;

public class DietFeedbackRequest {
    private Long memberId;
    private String targetDate; // "2025-05-01"
    private String comment;

    public Long getMemberId() { return memberId; }
    public String getTargetDate() { return targetDate; }
    public String getComment() { return comment; }
}
