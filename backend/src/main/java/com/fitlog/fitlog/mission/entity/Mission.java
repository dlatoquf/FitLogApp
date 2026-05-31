package com.fitlog.fitlog.mission.entity;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "missions")
public class Mission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workout_log_id")
    private Long workoutLogId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manual_member_id")
    private ManualMember manualMember;

    @Column(name = "content", nullable = false, length = 500)
    private String content;

    @Column(name = "is_done")
    private Boolean isDone = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "done_at")
    private LocalDateTime doneAt;

    @Column(name = "failed_at")
    private LocalDateTime failedAt;

    public enum Status { PENDING, DONE, FAILED }

    // Getters
    public Long getId() { return id; }
    public Long getWorkoutLogId() { return workoutLogId; }
    public Trainer getTrainer() { return trainer; }
    public Member getMember() { return member; }
    public ManualMember getManualMember() { return manualMember; }
    public String getContent() { return content; }
    public Boolean getIsDone() { return isDone; }
    public Status getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getDoneAt() { return doneAt; }
    public LocalDateTime getFailedAt() { return failedAt; }

    // Setters
    public void setWorkoutLogId(Long workoutLogId) { this.workoutLogId = workoutLogId; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setMember(Member member) { this.member = member; }
    public void setManualMember(ManualMember manualMember) { this.manualMember = manualMember; }
    public void setContent(String content) { this.content = content; }
    public void setIsDone(Boolean isDone) { this.isDone = isDone; }
    public void setStatus(Status status) { this.status = status; }
    public void setDoneAt(LocalDateTime doneAt) { this.doneAt = doneAt; }
    public void setFailedAt(LocalDateTime failedAt) { this.failedAt = failedAt; }
}
