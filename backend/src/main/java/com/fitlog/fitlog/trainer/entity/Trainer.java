package com.fitlog.fitlog.trainer.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.member.entity.Member;
import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "trainers")
public class Trainer {

    @Id
    private Long id;

    @MapsId
    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @JsonIgnore
    @OneToMany(mappedBy = "trainer", fetch = FetchType.LAZY)
    private List<Member> members;

    @Column(name = "gym_name")
    private String gymName;

    @Column(name = "work_days")
    private String workDays;

    @Column(name = "start_time")
    private String startTime;

    @Column(name = "end_time")
    private String endTime;

    @Column(name = "trainer_code")
    private String trainerCode;

    // FREE : 회원 3명까지 무료
    // PRO  : 회원 무제한 유료
    @Column(name = "plan")
    private String plan = "FREE";

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getGymName() { return gymName; }
    public String getWorkDays() { return workDays; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
    public String getTrainerCode() { return trainerCode; }
    public String getPlan() { return plan; }
    public List<Member> getMembers() { return members; }

    public void setUser(User user) { this.user = user; }
    public void setGymName(String gymName) { this.gymName = gymName; }
    public void setWorkDays(String workDays) { this.workDays = workDays; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public void setTrainerCode(String trainerCode) { this.trainerCode = trainerCode; }
    public void setPlan(String plan) { this.plan = plan; }
    public void setMembers(List<Member> members) { this.members = members; }
}