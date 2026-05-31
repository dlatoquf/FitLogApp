package com.fitlog.fitlog.gym.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "gyms")
public class Gym {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "gym_id")
    private Long gymId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "affiliate_code", nullable = false, unique = true)
    private String affiliateCode;

    @Column(name = "email")
    private String email;

    @Column(name = "contract_end", nullable = false)
    private LocalDate contractEnd;

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getGymId() { return gymId; }
    public String getName() { return name; }
    public String getAffiliateCode() { return affiliateCode; }
    public String getEmail() { return email; }
    public LocalDate getContractEnd() { return contractEnd; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setName(String name) { this.name = name; }
    public void setAffiliateCode(String affiliateCode) { this.affiliateCode = affiliateCode; }
    public void setEmail(String email) { this.email = email; }
    public void setContractEnd(LocalDate contractEnd) { this.contractEnd = contractEnd; }
    public void setStatus(String status) { this.status = status; }
}
