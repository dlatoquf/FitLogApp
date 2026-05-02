package com.fitlog.fitlog.entity;

import jakarta.persistence.*;
import java.util.List;

@Entity
@Table(name = "trainers")
public class Trainer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    private String gymName;
    private String workDays;
    private String startTime;
    private String endTime;
    private String trainerCode;

    @OneToMany(mappedBy = "trainer", cascade = CascadeType.ALL)
    private List<Member> members;

    public Long getId() { return id; }
    public User getUser() { return user; }
    public String getGymName() { return gymName; }
    public String getWorkDays() { return workDays; }
    public String getStartTime() { return startTime; }
    public String getEndTime() { return endTime; }
    public String getTrainerCode() { return trainerCode; }
    public List<Member> getMembers() { return members; }

    public void setUser(User user) { this.user = user; }
    public void setGymName(String gymName) { this.gymName = gymName; }
    public void setWorkDays(String workDays) { this.workDays = workDays; }
    public void setStartTime(String startTime) { this.startTime = startTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }
    public void setTrainerCode(String trainerCode) { this.trainerCode = trainerCode; }
    public void setMembers(List<Member> members) { this.members = members; }
}