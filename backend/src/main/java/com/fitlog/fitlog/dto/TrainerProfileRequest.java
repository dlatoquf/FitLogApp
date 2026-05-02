package com.fitlog.fitlog.dto;

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
}

