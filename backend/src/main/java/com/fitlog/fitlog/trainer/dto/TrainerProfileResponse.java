package com.fitlog.fitlog.trainer.dto;

public class TrainerProfileResponse {

    private Long id;
    private String name;
    private String gymName;
    private String workDays;
    private String startTime;
    private String endTime;
    private String trainerCode;

    public TrainerProfileResponse(
            Long id,
            String name,
            String gymName,
            String workDays,
            String startTime,
            String endTime,
            String trainerCode
    ) {
        this.id = id;
        this.name = name;
        this.gymName = gymName;
        this.workDays = workDays;
        this.startTime = startTime;
        this.endTime = endTime;
        this.trainerCode = trainerCode;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getGymName() {
        return gymName;
    }

    public String getWorkDays() {
        return workDays;
    }

    public String getStartTime() {
        return startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public String getTrainerCode() {
        return trainerCode;
    }
}