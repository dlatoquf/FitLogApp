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

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private Status status = Status.PENDING;

    public enum Status { PENDING, CONFIRMED, REJECTED }

    public Status getStatus() { return status; }
    public void setStatus(Status s) { this.status = s; }

    public Long getId() { return id; }
    public Schedule getSchedule() { return schedule; }
    public Member getMember() { return member; }

    public void setSchedule(Schedule schedule) { this.schedule = schedule; }
    public void setMember(Member member) { this.member = member; }
}