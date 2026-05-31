package com.fitlog.fitlog.mission.dto;

import com.fitlog.fitlog.mission.entity.Mission;
import java.time.LocalDateTime;

public class MissionResponse {
    private Long id;
    private String content;
    private Boolean isDone;
    private String status;   // PENDING / DONE / FAILED
    private Long workoutLogId;
    private LocalDateTime createdAt;
    private LocalDateTime doneAt;
    private LocalDateTime failedAt;
    private String trainerName;

    public MissionResponse(Mission m) {
        this.id = m.getId();
        this.content = m.getContent();
        this.isDone = m.getIsDone();
        this.status = m.getStatus() != null ? m.getStatus().name() : "PENDING";
        this.workoutLogId = m.getWorkoutLogId();
        this.createdAt = m.getCreatedAt();
        this.doneAt = m.getDoneAt();
        this.failedAt = m.getFailedAt();
        this.trainerName = m.getTrainer() != null && m.getTrainer().getUser() != null
                ? m.getTrainer().getUser().getName() : null;
    }

    public Long getId() { return id; }
    public String getContent() { return content; }
    public Boolean getIsDone() { return isDone; }
    public String getStatus() { return status; }
    public Long getWorkoutLogId() { return workoutLogId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getDoneAt() { return doneAt; }
    public LocalDateTime getFailedAt() { return failedAt; }
    public String getTrainerName() { return trainerName; }
}
