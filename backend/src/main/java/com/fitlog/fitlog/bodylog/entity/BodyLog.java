package com.fitlog.fitlog.bodylog.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.member.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "Body_Logs")
public class BodyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "body_log_id")
    private Long id;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    private Double weight;

    @Column(name = "body_fat")
    private Double bodyFat;        // 체지방률 (%)

    @Column(name = "body_fat_mass")
    private Double bodyFatMass;    // 체지방량 (kg)

    @Column(name = "muscle_mass")
    private Double muscleMass;

    private String memo;

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public LocalDate getLogDate() { return logDate; }
    public Double getWeight() { return weight; }
    public Double getBodyFat() { return bodyFat; }
    public Double getBodyFatMass() { return bodyFatMass; }
    public Double getMuscleMass() { return muscleMass; }
    public String getMemo() { return memo; }

    public void setMember(Member member) { this.member = member; }
    public void setLogDate(LocalDate logDate) { this.logDate = logDate; }
    public void setWeight(Double weight) { this.weight = weight; }
    public void setBodyFat(Double bodyFat) { this.bodyFat = bodyFat; }
    public void setBodyFatMass(Double bodyFatMass) { this.bodyFatMass = bodyFatMass; }
    public void setMuscleMass(Double muscleMass) { this.muscleMass = muscleMass; }
    public void setMemo(String memo) { this.memo = memo; }
}