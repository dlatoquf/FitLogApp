package com.fitlog.fitlog.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "members")
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "trainer_id")
    private Trainer trainer;         // 연결된 트레이너 (없을 수도 있음)

    private String phone;            // 전화번호

    private Double height;           // 키 (cm)

    private Double weight;           // 몸무게 (kg)

    private Double bodyFat;          // 체지방률 (%) - 선택

    private Double muscleMass;       // 골격근량 (kg) - 선택

    private Integer ptRemaining;     // PT 잔여 횟수

    // ── Getters & Setters ────────────────────────────────────────────────
    public Long getId() { return id; }
    public User getUser() { return user; }
    public Trainer getTrainer() { return trainer; }
    public String getPhone() { return phone; }
    public Double getHeight() { return height; }
    public Double getWeight() { return weight; }
    public Double getBodyFat() { return bodyFat; }
    public Double getMuscleMass() { return muscleMass; }
    public Integer getPtRemaining() { return ptRemaining; }

    public void setUser(User user) { this.user = user; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setPhone(String phone) { this.phone = phone; }
    public void setHeight(Double height) { this.height = height; }
    public void setWeight(Double weight) { this.weight = weight; }
    public void setBodyFat(Double bodyFat) { this.bodyFat = bodyFat; }
    public void setMuscleMass(Double muscleMass) { this.muscleMass = muscleMass; }
    public void setPtRemaining(Integer ptRemaining) { this.ptRemaining = ptRemaining; }
}