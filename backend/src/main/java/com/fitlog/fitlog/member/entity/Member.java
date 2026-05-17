package com.fitlog.fitlog.member.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;

@Entity
@Table(name = "members")
public class Member {

    @Id
    private Long id;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id")
    private Trainer trainer;

    private String phone;
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

    public enum Status { ACTIVE, INACTIVE }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public Trainer getTrainer() { return trainer; }
    public String getPhone() { return phone; }
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

    public void setUser(User user) { this.user = user; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setPhone(String phone) { this.phone = phone; }
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
}