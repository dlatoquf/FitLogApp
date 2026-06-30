package com.fitlog.fitlog.workout.entity;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "Workout_Logs")
public class WorkoutLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "workout_id")
    private Long workoutId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = true)
    private Member member;

    // 미연동 회원 운동 로그 지원 — 연동 시 member 로 이전됨
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manual_member_id", nullable = true)
    private com.fitlog.fitlog.trainer.entity.ManualMember manualMember;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id")
    private Trainer trainer;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(name = "condition_score")
    private Integer conditionScore;

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @Column(name = "pain_points")
    private String painPoints;

    @Column(name = "workout_type")
    private String workoutType = "PERSONAL";

    @Column(name = "schedule_id")
    private Long scheduleId;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @OneToMany(mappedBy = "workoutLog", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<WorkoutSet> sets = new ArrayList<>();

    @OneToMany(mappedBy = "workoutLog", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    private List<WorkoutMedia> mediaList = new ArrayList<>();

    // Getters & Setters
    public Long getWorkoutId() { return workoutId; }
    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }
    public com.fitlog.fitlog.trainer.entity.ManualMember getManualMember() { return manualMember; }
    public void setManualMember(com.fitlog.fitlog.trainer.entity.ManualMember manualMember) { this.manualMember = manualMember; }
    public Trainer getTrainer() { return trainer; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public LocalDate getLogDate() { return logDate; }
    public void setLogDate(LocalDate logDate) { this.logDate = logDate; }
    public Integer getConditionScore() { return conditionScore; }
    public void setConditionScore(Integer conditionScore) { this.conditionScore = conditionScore; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
    public String getPainPoints() { return painPoints; }
    public void setPainPoints(String painPoints) { this.painPoints = painPoints; }
    public String getWorkoutType() { return workoutType; }
    public void setWorkoutType(String workoutType) { this.workoutType = workoutType; }
    public Long getScheduleId() { return scheduleId; }
    public void setScheduleId(Long scheduleId) { this.scheduleId = scheduleId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
    public List<WorkoutSet> getSets() { return sets; }
    public void setSets(List<WorkoutSet> sets) { this.sets = sets; }
    public List<WorkoutMedia> getMediaList() { return mediaList; }
    public void setMediaList(List<WorkoutMedia> mediaList) { this.mediaList = mediaList; }
}