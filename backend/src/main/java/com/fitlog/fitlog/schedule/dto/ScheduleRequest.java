package com.fitlog.fitlog.schedule.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.member.entity.Member;
import jakarta.persistence.*;
import com.fitlog.fitlog.schedule.entity.Schedule;

@Entity
@Table(name = "schedule_requests")
public class ScheduleRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    private Schedule schedule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "status")
    private String status = "PENDING";

    public enum Status { PENDING, CONFIRMED, REJECTED }

    public Status getStatus() {
        if (status == null) return Status.PENDING;
        try { return Status.valueOf(status); }
        catch (Exception e) { return Status.PENDING; }
    }
    public void setStatus(Status s) { this.status = s.name(); }

    public Long getId() { return id; }
    public Schedule getSchedule() { return schedule; }
    public Member getMember() { return member; }

    public void setSchedule(Schedule schedule) { this.schedule = schedule; }
    public void setMember(Member member) { this.member = member; }
}