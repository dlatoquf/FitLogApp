package com.fitlog.fitlog.trainer.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "manual_members")
public class ManualMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "phone")
    private String phone;

    @Column(name = "pt_remaining")
    private Integer ptRemaining; // OT는 null, PT는 0 이상

    @Column(name = "pt_total")
    private Integer ptTotal; // OT는 null, PT는 0 이상

    @Column(name = "memo")
    private String memo;


    // 결제 금액 및 날짜 (신규 회원 등록 시)
    @Column(name = "amount")
    private Long amount;

    @Column(name = "payment_date")
    private java.time.LocalDate paymentDate;

    // PT 잔여 0회가 된 날짜 — 7일 후 비활성화 기준
    @Column(name = "pt_ended_at")
    private java.time.LocalDate ptEndedAt;

    // OT 완료 횟수 — PT 전환 시 기록 (운동일지·바디로그 연속성 추적용)
    @Column(name = "ot_count")
    private Integer otCount;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public Integer getPtRemaining() { return ptRemaining; }
    public void setPtRemaining(Integer ptRemaining) { this.ptRemaining = ptRemaining; }
    public Integer getPtTotal() { return ptTotal; }
    public void setPtTotal(Integer ptTotal) { this.ptTotal = ptTotal; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getAmount() { return amount; }
    public void setAmount(Long amount) { this.amount = amount; }
    public java.time.LocalDate getPaymentDate() { return paymentDate; }
    public void setPaymentDate(java.time.LocalDate paymentDate) { this.paymentDate = paymentDate; }
    public java.time.LocalDate getPtEndedAt() { return ptEndedAt; }
    public void setPtEndedAt(java.time.LocalDate ptEndedAt) { this.ptEndedAt = ptEndedAt; }
    public Integer getOtCount() { return otCount; }
    public void setOtCount(Integer otCount) { this.otCount = otCount; }
}
