package com.fitlog.fitlog.trainer.dto;

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
                               List<MonthRevenueDetail> monthRevenueDetails, int noShowCount) {
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

    public static class TodayPt {
        private Long memberId;
        private String memberName;
        private String time;
        private int ptRemaining;
        private boolean completed;

        public TodayPt(Long memberId, String memberName, String time, int ptRemaining, boolean completed) {
            this.memberId = memberId;
            this.memberName = memberName;
            this.time = time;
            this.ptRemaining = ptRemaining;
            this.completed = completed;
        }

        public Long getMemberId() { return memberId; }
        public String getMemberName() { return memberName; }
        public String getTime() { return time; }
        public int getPtRemaining() { return ptRemaining; }
        public boolean isCompleted() { return completed; }
    }

    public static class MonthRevenueDetail {
        private String memberName;
        private int sessions;
        private long amount;
        private String memo;

        public MonthRevenueDetail(String memberName, int sessions, long amount, String memo) {
            this.memberName = memberName;
            this.sessions = sessions;
            this.amount = amount;
            this.memo = memo;
        }

        public String getMemberName() { return memberName; }
        public int getSessions() { return sessions; }
        public long getAmount() { return amount; }
        public String getMemo() { return memo; }
    }
}
