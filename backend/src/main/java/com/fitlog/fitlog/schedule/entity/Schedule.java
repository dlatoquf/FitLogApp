package com.fitlog.fitlog.schedule.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "schedules")
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    // 확정된 회원 직접 참조
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "status")
    private String status = "OPEN";

    @JsonIgnore
    @OneToMany(mappedBy = "schedule", fetch = FetchType.LAZY)
    private List<ScheduleRequest> requests;

    public enum Status { OPEN, REQUESTED, CONFIRMED ,COMPLETED, CANCELED} // 스케줄 상태 5가지로 수정

    public String getStatusStr() { return status; }

    public Status getStatus() {
        if (status == null) return Status.OPEN;
        try { return Status.valueOf(status); }
        catch (Exception e) { return Status.OPEN; }
    }

    public void setStatus(Status s) { this.status = s.name(); }
    public void setStatusStr(String s) { this.status = s; }

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public Member getMember() { return member; }
    public LocalDate getDate() { return date; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public List<ScheduleRequest> getRequests() { return requests; }

    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setMember(Member member) { this.member = member; }
    public void setDate(LocalDate date) { this.date = date; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
}