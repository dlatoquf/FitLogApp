package com.fitlog.fitlog.trainer.dto;

public class TrainerProfileRequest {
    private String name;
    private String gymName;
    private String workDays;    // "월,화,수,목,금"
    private String startTime;   // "09:00"
    private String endTime;     // "22:00"

    public String getName() { return name; }
    public String getGymName() { return gymName; }
    public String getWorkDays() { return workDays; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }

    public void setName(String name) { this.name = name; }
    public void setGymName(String gymName) { this.gymName = gymName; }
    public void setWorkDays(String workDays) { this.workDays = workDays; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
}

