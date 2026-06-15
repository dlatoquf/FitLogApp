package com.fitlog.fitlog.trainer.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class TrainerHomeResponse {

    private Long trainerId;
    private String trainerName;
    private int totalMembers;
    private int todaySchedules;
    private int attendanceRate;
    private List<TodayPt> todayPtList;
    private String plan;
    private String trainerCode;
    private String trialEndDate; // "YYYY-MM-DD" 형식, 무료 체험 중일 때만

    // 목표값
    private Integer goalSessions;
    private Long goalRevenue;

    // 이번 달 실적
    private int monthSessions;
    private long monthRevenue;
    private List<MonthRevenueDetail> monthRevenueDetails;

    // 오늘 노쇼
    private int noShowCount;

    public TrainerHomeResponse(Long trainerId, String trainerName, int totalMembers, int todaySchedules,
                               int attendanceRate, List<TodayPt> todayPtList, String plan,
                               String trainerCode, Integer goalSessions, Long goalRevenue,
                               int monthSessions, long monthRevenue,
                               List<MonthRevenueDetail> monthRevenueDetails, int noShowCount,
                               String trialEndDate) {
        this.trainerId = trainerId;
        this.trainerName = trainerName;
        this.totalMembers = totalMembers;
        this.todaySchedules = todaySchedules;
        this.attendanceRate = attendanceRate;
        this.todayPtList = todayPtList;
        this.plan = plan;
        this.trainerCode = trainerCode;
        this.goalSessions = goalSessions;
        this.goalRevenue = goalRevenue;
        this.monthSessions = monthSessions;
        this.monthRevenue = monthRevenue;
        this.monthRevenueDetails = monthRevenueDetails;
        this.noShowCount = noShowCount;
        this.trialEndDate = trialEndDate;
    }

    public Long getTrainerId() { return trainerId; }
    public String getTrainerName() { return trainerName; }
    public int getTotalMembers() { return totalMembers; }
    public int getTodaySchedules() { return todaySchedules; }
    public int getAttendanceRate() { return attendanceRate; }
    public List<TodayPt> getTodayPtList() { return todayPtList; }
    public String getPlan() { return plan; }
    public String getTrainerCode() { return trainerCode; }
    public Integer getGoalSessions() { return goalSessions; }
    public Long getGoalRevenue() { return goalRevenue; }
    public int getMonthSessions() { return monthSessions; }
    public long getMonthRevenue() { return monthRevenue; }
    public List<MonthRevenueDetail> getMonthRevenueDetails() { return monthRevenueDetails; }
    public int getNoShowCount() { return noShowCount; }
    public String getTrialEndDate() { return trialEndDate; }

    public static class TodayPt {
        private Long scheduleId;
        private Long memberId;
        private String memberName;
        private String time;
        private int ptRemaining;
        private boolean completed;
        private boolean isManual;
        private String sessionType; // "PT" or "OT"
        private boolean isNoShow;   // 명시적 NO_SHOW 처리됨
        private int otSessionCount; // OT 회원의 누적 OT 수업 횟수 (OT가 아니면 0)

        public TodayPt(Long scheduleId, Long memberId, String memberName, String time, int ptRemaining, boolean completed, boolean isManual, String sessionType, boolean isNoShow, int otSessionCount) {
            this.scheduleId = scheduleId;
            this.memberId = memberId;
            this.memberName = memberName;
            this.time = time;
            this.ptRemaining = ptRemaining;
            this.completed = completed;
            this.isManual = isManual;
            this.sessionType = sessionType != null ? sessionType : "PT";
            this.isNoShow = isNoShow;
            this.otSessionCount = otSessionCount;
        }

        public Long getScheduleId() { return scheduleId; }
        public Long getMemberId() { return memberId; }
        public String getMemberName() { return memberName; }
        public String getTime() { return time; }
        public int getPtRemaining() { return ptRemaining; }
        public boolean isCompleted() { return completed; }
        @JsonProperty("isManual")
        public boolean isManual() { return isManual; }
        public String getSessionType() { return sessionType; }
        @JsonProperty("isNoShow")
        public boolean isNoShow() { return isNoShow; }
        public int getOtSessionCount() { return otSessionCount; }
    }

    public static class MonthRevenueDetail {
        private String memberName;
        private int sessions;
        private long amount;
        private String memo;
        private String date;     // "5/25" 형식 (표시용)
        private String sortDate; // "YYYY-MM-DD" 형식 (정렬용)
        private Long contractId;
        private Long manualMemberId;

        public MonthRevenueDetail(String memberName, int sessions, long amount, String memo, String date, String sortDate, Long contractId, Long manualMemberId) {
            this.memberName = memberName;
            this.sessions = sessions;
            this.amount = amount;
            this.memo = memo;
            this.date = date;
            this.sortDate = sortDate;
            this.contractId = contractId;
            this.manualMemberId = manualMemberId;
        }

        public String getMemberName() { return memberName; }
        public int getSessions() { return sessions; }
        public long getAmount() { return amount; }
        public String getMemo() { return memo; }
        public String getDate() { return date; }
        public String getSortDate() { return sortDate; }
        public Long getContractId() { return contractId; }
        public Long getManualMemberId() { return manualMemberId; }
    }
}
