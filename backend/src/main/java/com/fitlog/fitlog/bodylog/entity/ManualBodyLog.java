package com.fitlog.fitlog.bodylog.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "manual_body_logs")
public class ManualBodyLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "manual_body_log_id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manual_member_id", nullable = false)
    private ManualMember manualMember;

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

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public ManualMember getManualMember() { return manualMember; }
    public void setManualMember(ManualMember manualMember) { this.manualMember = manualMember; }
    public LocalDate getLogDate() { return logDate; }
    public void setLogDate(LocalDate logDate) { this.logDate = logDate; }
    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }
    public Double getBodyFat() { return bodyFat; }
    public void setBodyFat(Double bodyFat) { this.bodyFat = bodyFat; }
    public Double getBodyFatMass() { return bodyFatMass; }
    public void setBodyFatMass(Double bodyFatMass) { this.bodyFatMass = bodyFatMass; }
    public Double getMuscleMass() { return muscleMass; }
    public void setMuscleMass(Double muscleMass) { this.muscleMass = muscleMass; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
