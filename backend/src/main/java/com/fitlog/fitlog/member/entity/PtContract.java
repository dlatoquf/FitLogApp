package com.fitlog.fitlog.member.entity;

import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "pt_contracts")
public class PtContract {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "contract_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id")
    private Trainer trainer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(name = "total_sessions", nullable = false)
    private int totalSessions;

    @Column(name = "remain_sessions", nullable = false)
    private int remainSessions;

    @Column(name = "start_date")
    private String startDate;

    @Column(name = "end_date")
    private String endDate;

    @Column(name = "memo")
    private String memo;

    @Column(name = "status")
    private String status = "ACTIVE";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public Member getMember() { return member; }
    public int getTotalSessions() { return totalSessions; }
    public int getRemainSessions() { return remainSessions; }
    public String getStartDate() { return startDate; }
    public String getEndDate() { return endDate; }
    public String getMemo() { return memo; }
    public String getStatus() { return status; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setMember(Member member) { this.member = member; }
    public void setTotalSessions(int totalSessions) { this.totalSessions = totalSessions; }
    public void setRemainSessions(int remainSessions) { this.remainSessions = remainSessions; }
    public void setStartDate(String startDate) { this.startDate = startDate; }
    public void setEndDate(String endDate) { this.endDate = endDate; }
    public void setMemo(String memo) { this.memo = memo; }
    public void setStatus(String status) { this.status = status; }
}