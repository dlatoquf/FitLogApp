package com.fitlog.fitlog.dto;

import com.fitlog.fitlog.entity.Member;
import com.fitlog.fitlog.entity.Schedule;
import jakarta.persistence.*;

@Entity
@Table(name = "schedule_requests")
public class ScheduleRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    private Status status = Status.PENDING;

    public enum Status {
        PENDING,    // 신청 대기
        CONFIRMED,  // 확정
        REJECTED    // 거절
    }

    // ── Getters & Setters ──────────────────────────────────────────
    public Long getId() { return id; }
    public Schedule getSchedule() { return schedule; }
    public Member getMember() { return member; }
    public Status getStatus() { return status; }

    public void setSchedule(Schedule schedule) { this.schedule = schedule; }
    public void setMember(Member member) { this.member = member; }
    public void setStatus(Status status) { this.status = status; }
}