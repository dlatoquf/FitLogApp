package com.fitlog.fitlog.trainer.dto;

import java.util.List;

public class TrainerHomeResponse {

    private String trainerName;
    private int totalMembers;
    private int todaySchedules;
    private int attendanceRate;
    private List<TodayPt> todayPtList;
    private String plan;
    private String trainerCode;

    public TrainerHomeResponse(String trainerName, int totalMembers, int todaySchedules,
                               int attendanceRate, List<TodayPt> todayPtList, String plan,
                               String trainerCode) {
        this.trainerName = trainerName;
        this.totalMembers = totalMembers;
        this.todaySchedules = todaySchedules;
        this.attendanceRate = attendanceRate;
        this.todayPtList = todayPtList;
        this.plan = plan;
        this.trainerCode = trainerCode;
    }

    public String getTrainerName() { return trainerName; }
    public int getTotalMembers() { return totalMembers; }
    public int getTodaySchedules() { return todaySchedules; }
    public int getAttendanceRate() { return attendanceRate; }
    public List<TodayPt> getTodayPtList() { return todayPtList; }
    public String getPlan() { return plan; }
    public String getTrainerCode() { return trainerCode; } //

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
}