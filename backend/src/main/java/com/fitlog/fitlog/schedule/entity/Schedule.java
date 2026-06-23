package com.fitlog.fitlog.schedule.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.schedule.dto.ScheduleRequest;
import com.fitlog.fitlog.trainer.entity.ManualMember;
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

    // 확정된 연동 회원
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    // 확정된 미연동 회원
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manual_member_id")
    private ManualMember manualMember;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "status")
    private String status = "OPEN";

    // PT / OT / PERSONAL_WORKOUT / PERSONAL_SCHEDULE 구분 (기본값 PT)
    @Column(name = "session_type")
    private String sessionType = "PT";

    // 개인운동·개인일정 메모 (선택)
    @Column(name = "note", length = 200)
    private String note;

    // 회원 탈퇴/해제 후에도 이름 보존
    @Column(name = "member_name", length = 100)
    private String memberName;

    @JsonIgnore
    @OneToMany(mappedBy = "schedule", fetch = FetchType.LAZY)
    private List<ScheduleRequest> requests;


    public enum Status { OPEN, REQUESTED, CONFIRMED, COMPLETED, CANCELED, NO_SHOW } // 스케줄 상태 6가지

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
    public void setManualMember(ManualMember manualMember) { this.manualMember = manualMember; }
    public ManualMember getManualMember() { return manualMember; }
    public void setDate(LocalDate date) { this.date = date; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public String getSessionType() { return sessionType != null ? sessionType : "PT"; }
    public void setSessionType(String sessionType) { this.sessionType = sessionType; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getMemberName() { return memberName; }
    public void setMemberName(String memberName) { this.memberName = memberName; }

}