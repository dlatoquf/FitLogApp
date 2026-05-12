package com.fitlog.fitlog.diet.entity;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "diet_feedbacks")
public class DietFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(columnDefinition = "BIGINT COMMENT '피드백 고유 ID (PK)'")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false, columnDefinition = "BIGINT COMMENT 'members 테이블 FK - 피드백 받는 회원'")
    private Member member;

    @ManyToOne
    @JoinColumn(name = "trainer_id", nullable = false, columnDefinition = "BIGINT COMMENT 'trainers 테이블 FK - 피드백 작성 트레이너'")
    private Trainer trainer;

    @Column(nullable = false, columnDefinition = "DATE COMMENT '피드백 대상 날짜'")
    private LocalDate targetDate;

    @Column(nullable = false, columnDefinition = "TEXT COMMENT '피드백 내용'")
    private String comment;

    @Column(columnDefinition = "DATETIME COMMENT '작성 시간'")
    private LocalDateTime createdAt = LocalDateTime.now();

    // ── Getters & Setters ──────────────────────────────────────────────────
    public Long getId() { return id; }
    public Member getMember() { return member; }
    public Trainer getTrainer() { return trainer; }
    public LocalDate getTargetDate() { return targetDate; }
    public String getComment() { return comment; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setMember(Member member) { this.member = member; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }
    public void setComment(String comment) { this.comment = comment; }
}