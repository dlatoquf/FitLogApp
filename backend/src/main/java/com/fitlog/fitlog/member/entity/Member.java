package com.fitlog.fitlog.member.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;

@Entity
@Table(name = "members")
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id")
    private Trainer trainer;

    private String phone;
    private String birthDate;
    private Double height;
    private Double weight;
    private Double bodyFat;
    private Double muscleMass;
    private Integer ptRemaining;
    private Integer ptTotal;
    private String ptStartDate;
    private String ptExpDate;
    private String goal;
    private String memo;


    @Enumerated(EnumType.STRING)
    private Status status = Status.ACTIVE;

    // 연결 해제일 (INACTIVE로 전환된 날짜)
    private java.time.LocalDate disconnectedAt;

    // 이전 트레이너 ID (새 트레이너로 이동 시 저장 — 이전 트레이너가 해제일까지 기록 열람 가능)
    private Long previousTrainerId;

    // PT 잔여 0회가 된 날짜 — 7일 후 자동 INACTIVE 전환 기준
    private java.time.LocalDate ptEndedAt;

    // 연동 전 미연동 회원 ID (연동 시 저장 — 트레이너가 구 ID로 요청 시 리다이렉트용)
    @Column(name = "former_manual_member_id")
    private Long formerManualMemberId;

    // 연동 시점에 저장한 이름 (user 탈퇴 후 개인정보 삭제돼도 트레이너 화면에 이름 표시용)
    @Column(name = "cached_name")
    private String cachedName;

    @Column(name = "notif_feedback")
    private Boolean notifFeedback = true;

    @Column(name = "notif_schedule")
    private Boolean notifSchedule = true;

    @Column(name = "notif_pt_payment")
    private Boolean notifPtPayment = true;

    @Column(name = "notif_workout")
    private Boolean notifWorkout = true;

    @Column(name = "notif_bodylog")
    private Boolean notifBodyLog = true;

    @Column(name = "notif_notice")
    private Boolean notifNotice = true;

    public enum Status { ACTIVE, INACTIVE }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Trainer getTrainer() { return trainer; }
    public String getPhone() { return phone; }
    public String getBirthDate() { return birthDate; }
    public Double getHeight() { return height; }
    public Double getWeight() { return weight; }
    public Double getBodyFat() { return bodyFat; }
    public Double getMuscleMass() { return muscleMass; }
    public Integer getPtRemaining() { return ptRemaining; }
    public Integer getPtTotal() { return ptTotal; }
    public String getPtStartDate() { return ptStartDate; }
    public String getPtExpDate() { return ptExpDate; }
    public String getGoal() { return goal; }
    public String getMemo() { return memo; }
    public Status getStatus() { return status; }
    public java.time.LocalDate getDisconnectedAt() { return disconnectedAt; }
    public Long getPreviousTrainerId() { return previousTrainerId; }

    public void setUser(User user) { this.user = user; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setBirthDate(String birthDate) { this.birthDate = birthDate; }
    public void setHeight(Double height) { this.height = height; }
    public void setWeight(Double weight) { this.weight = weight; }
    public void setBodyFat(Double bodyFat) { this.bodyFat = bodyFat; }
    public void setMuscleMass(Double muscleMass) { this.muscleMass = muscleMass; }
    public void setPtRemaining(Integer ptRemaining) { this.ptRemaining = ptRemaining; }
    public void setPtTotal(Integer ptTotal) { this.ptTotal = ptTotal; }
    public void setPtStartDate(String ptStartDate) { this.ptStartDate = ptStartDate; }
    public void setPtExpDate(String ptExpDate) { this.ptExpDate = ptExpDate; }
    public void setGoal(String goal) { this.goal = goal; }
    public void setMemo(String memo) { this.memo = memo; }
    public void setStatus(Status status) { this.status = status; }
    public void setDisconnectedAt(java.time.LocalDate disconnectedAt) { this.disconnectedAt = disconnectedAt; }
    public void setPreviousTrainerId(Long previousTrainerId) { this.previousTrainerId = previousTrainerId; }
    public java.time.LocalDate getPtEndedAt() { return ptEndedAt; }
    public void setPtEndedAt(java.time.LocalDate ptEndedAt) { this.ptEndedAt = ptEndedAt; }
    public Long getFormerManualMemberId() { return formerManualMemberId; }
    public void setFormerManualMemberId(Long formerManualMemberId) { this.formerManualMemberId = formerManualMemberId; }
    public String getCachedName() { return cachedName; }
    public void setCachedName(String cachedName) { this.cachedName = cachedName; }

    public Boolean getNotifFeedback() { return notifFeedback == null || notifFeedback; }
    public Boolean getNotifSchedule() { return notifSchedule == null || notifSchedule; }
    public Boolean getNotifPtPayment() { return notifPtPayment == null || notifPtPayment; }
    public Boolean getNotifWorkout() { return notifWorkout == null || notifWorkout; }
    public Boolean getNotifBodyLog() { return notifBodyLog == null || notifBodyLog; }
    public Boolean getNotifNotice() { return notifNotice == null || notifNotice; }
    public void setNotifFeedback(Boolean v) { this.notifFeedback = v; }
    public void setNotifSchedule(Boolean v) { this.notifSchedule = v; }
    public void setNotifPtPayment(Boolean v) { this.notifPtPayment = v; }
    public void setNotifWorkout(Boolean v) { this.notifWorkout = v; }
    public void setNotifBodyLog(Boolean v) { this.notifBodyLog = v; }
    public void setNotifNotice(Boolean v) { this.notifNotice = v; }
}