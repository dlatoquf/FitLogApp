package com.fitlog.fitlog.trainer.dto;

public class TrainerProfileResponse {

    private Long id;
    private String name;
    private String gymName;
    private String workDays;
    private String startTime;
    private String endTime;
    private String trainerCode;
    private Boolean gymAffiliated;       // 제휴 헬스장 연결 여부
    private String affiliatedGymName;    // 제휴 헬스장명
    private String gymConfirmedAt;       // 마지막 제휴 확인일 (YYYY-MM-DD)

    public TrainerProfileResponse(
            Long id, String name, String gymName,
            String workDays, String startTime, String endTime,
            String trainerCode,
            Boolean gymAffiliated, String affiliatedGymName, String gymConfirmedAt
    ) {
        this.id = id;
        this.name = name;
        this.gymName = gymName;
        this.workDays = workDays;
        this.startTime = startTime;
        this.endTime = endTime;
        this.trainerCode = trainerCode;
        this.gymAffiliated = gymAffiliated;
        this.affiliatedGymName = affiliatedGymName;
        this.gymConfirmedAt = gymConfirmedAt;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getGymName() { return gymName; }
    public String getWorkDays() { return workDays; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
    public String getTrainerCode() { return trainerCode; }
    public Boolean getGymAffiliated() { return gymAffiliated; }
    public String getAffiliatedGymName() { return affiliatedGymName; }
    public String getGymConfirmedAt() { return gymConfirmedAt; }
}
