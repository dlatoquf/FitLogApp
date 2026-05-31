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
}