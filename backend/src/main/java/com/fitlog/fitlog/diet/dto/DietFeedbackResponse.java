package com.fitlog.fitlog.diet.dto;

import com.fitlog.fitlog.diet.entity.DietFeedback;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class DietFeedbackResponse {

    private Long id;
    private String comment;
    private LocalDate targetDate;
    private LocalDateTime createdAt;
    private Long memberId;
    private Long trainerId;

    public static DietFeedbackResponse from(DietFeedback feedback) {
        return DietFeedbackResponse.builder()
                .id(feedback.getId())
                .comment(feedback.getComment())
                .targetDate(feedback.getTargetDate())
                .createdAt(feedback.getCreatedAt())
                .memberId(feedback.getMember().getId())
                .trainerId(feedback.getTrainer().getId())
                .build();
    }
}