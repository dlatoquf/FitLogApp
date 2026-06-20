package com.fitlog.fitlog.trainer.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.gym.entity.Gym;
import com.fitlog.fitlog.member.entity.Member;
import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "trainers")
public class Trainer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @JsonIgnore
    @OneToMany(mappedBy = "trainer", fetch = FetchType.LAZY)
    private List<Member> members;

    @Column(name = "gym_name")
    private String gymName;

    @Column(name = "work_days")
    private String workDays;

    @Column(name = "start_time")
    private String startTime;

    @Column(name = "end_time")
    private String endTime;

    @Column(name = "trainer_code")
    private String trainerCode;

    // FREE : 회원 3명까지 무료
    // PRO  : 회원 무제한 유료
    @Column(name = "plan")
    private String plan = "FREE";

    @Column(name = "goal_sessions")
    private Integer goalSessions;

    @Column(name = "goal_revenue")
    private Long goalRevenue;

    @Column(name = "notif_birthday")
    private Boolean notifBirthday = true;

    @Column(name = "notif_mission_done")
    private Boolean notifMissionDone = true;

    @Column(name = "notif_personal_workout")
    private Boolean notifPersonalWorkout = true;

    @Column(name = "notif_diet")
    private Boolean notifDiet = true;

    @Column(name = "notif_new_member")
    private Boolean notifNewMember = true;

    @Column(name = "notif_incomplete_session")
    private Boolean notifIncompleteSession = true;

    // 슬롯 시작 분 오프셋: null=미설정, 0=정각(:00), 30=30분(:30)
    @Column(name = "slot_offset")
    private Integer slotOffset;

    // 1개월 무료 체험 종료일 (이 날까지 PRO 기능 사용 가능)
    @Column(name = "trial_end_date")
    private java.time.LocalDate trialEndDate;

    // 제휴 헬스장
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gym_id")
    private Gym gym;

    // 제휴 코드 마지막 확인일 (1년마다 갱신)
    @Column(name = "gym_confirmed_at")
    private java.time.LocalDate gymConfirmedAt;

    // Google Sheets 연동
    @Column(name = "google_sheets_spreadsheet_id")
    private String googleSheetsSpreadsheetId;

    @Column(name = "google_sheets_token", columnDefinition = "TEXT")
    private String googleSheetsToken;

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getGymName() { return gymName; }
    public String getWorkDays() { return workDays; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
    public String getTrainerCode() { return trainerCode; }
    public String getPlan() { return plan; }
    public List<Member> getMembers() { return members; }
    public Integer getGoalSessions() { return goalSessions; }
    public Long getGoalRevenue() { return goalRevenue; }
    public Boolean getNotifBirthday() { return notifBirthday == null || notifBirthday; }
    public Boolean getNotifMissionDone() { return notifMissionDone == null || notifMissionDone; }
    public Boolean getNotifPersonalWorkout() { return notifPersonalWorkout == null || notifPersonalWorkout; }
    public Boolean getNotifDiet() { return notifDiet == null || notifDiet; }
    public Boolean getNotifNewMember() { return notifNewMember == null || notifNewMember; }
    public Boolean getNotifIncompleteSession() { return notifIncompleteSession == null || notifIncompleteSession; }
    public void setUser(User user) { this.user = user; }
    public void setGymName(String gymName) { this.gymName = gymName; }
    public void setWorkDays(String workDays) { this.workDays = workDays; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public void setTrainerCode(String trainerCode) { this.trainerCode = trainerCode; }
    public void setPlan(String plan) { this.plan = plan; }
    public void setMembers(List<Member> members) { this.members = members; }
    public void setGoalSessions(Integer goalSessions) { this.goalSessions = goalSessions; }
    public void setGoalRevenue(Long goalRevenue) { this.goalRevenue = goalRevenue; }
    public void setNotifBirthday(Boolean notifBirthday) { this.notifBirthday = notifBirthday; }
    public void setNotifMissionDone(Boolean notifMissionDone) { this.notifMissionDone = notifMissionDone; }
    public void setNotifPersonalWorkout(Boolean notifPersonalWorkout) { this.notifPersonalWorkout = notifPersonalWorkout; }
    public void setNotifDiet(Boolean notifDiet) { this.notifDiet = notifDiet; }
    public void setNotifNewMember(Boolean notifNewMember) { this.notifNewMember = notifNewMember; }
    public void setNotifIncompleteSession(Boolean v) { this.notifIncompleteSession = v; }
    public Integer getSlotOffset() { return slotOffset; }
    public void setSlotOffset(Integer slotOffset) { this.slotOffset = slotOffset; }
    public java.time.LocalDate getTrialEndDate() { return trialEndDate; }
    public void setTrialEndDate(java.time.LocalDate trialEndDate) { this.trialEndDate = trialEndDate; }
    public Gym getGym() { return gym; }
    public void setGym(Gym gym) { this.gym = gym; }
    public java.time.LocalDate getGymConfirmedAt() { return gymConfirmedAt; }
    public void setGymConfirmedAt(java.time.LocalDate gymConfirmedAt) { this.gymConfirmedAt = gymConfirmedAt; }
    public String getGoogleSheetsSpreadsheetId() { return googleSheetsSpreadsheetId; }
    public void setGoogleSheetsSpreadsheetId(String id) { this.googleSheetsSpreadsheetId = id; }
    public String getGoogleSheetsToken() { return googleSheetsToken; }
    public void setGoogleSheetsToken(String token) { this.googleSheetsToken = token; }

    /** 제휴 헬스장이 유효하면 true (올해 1월 1일 이후에 확인한 경우) */
    public boolean isGymAffiliationActive() {
        if (gym == null || gymConfirmedAt == null) return false;
        java.time.LocalDate jan1 = java.time.LocalDate.of(java.time.LocalDate.now().getYear(), 1, 1);
        return !gymConfirmedAt.isBefore(jan1);
    }

    /** 무료 체험 또는 구독 중이면 true */
    public boolean isProEffective() {
        if ("PRO".equals(plan)) return true;
        if (trialEndDate != null && !java.time.LocalDate.now().isAfter(trialEndDate)) return true;
        return false;
    }
}
