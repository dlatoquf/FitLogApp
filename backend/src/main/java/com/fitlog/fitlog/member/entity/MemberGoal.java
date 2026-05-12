package com.fitlog.fitlog.member.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_goals")
public class MemberGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(name = "purpose", nullable = false)
    private Purpose purpose = Purpose.MAINTAIN;

    @Column(name = "target_weight")
    private Double targetWeight;

    @Column(name = "target_calories", nullable = false)
    private Double targetCalories = 1800.0;

    @Column(name = "target_carbs", nullable = false)
    private Double targetCarbs = 225.0;

    @Column(name = "target_protein", nullable = false)
    private Double targetProtein = 90.0;

    @Column(name = "target_fat", nullable = false)
    private Double targetFat = 60.0;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate = LocalDate.now();

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Purpose {
        DIET, MAINTAIN, BULKUP
    }

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public Purpose getPurpose() { return purpose; }
    public Double getTargetWeight() { return targetWeight; }
    public Double getTargetCalories() { return targetCalories; }
    public Double getTargetCarbs() { return targetCarbs; }
    public Double getTargetProtein() { return targetProtein; }
    public Double getTargetFat() { return targetFat; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setMember(Member member) { this.member = member; }
    public void setPurpose(Purpose purpose) { this.purpose = purpose; }
    public void setTargetWeight(Double targetWeight) { this.targetWeight = targetWeight; }
    public void setTargetCalories(Double targetCalories) { this.targetCalories = targetCalories; }
    public void setTargetCarbs(Double targetCarbs) { this.targetCarbs = targetCarbs; }
    public void setTargetProtein(Double targetProtein) { this.targetProtein = targetProtein; }
    public void setTargetFat(Double targetFat) { this.targetFat = targetFat; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
}