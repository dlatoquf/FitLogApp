package com.fitlog.fitlog.entity;

import com.fitlog.fitlog.dto.ScheduleRequest;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Entity
@Table(name = "schedules")
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    private LocalDate date;
    private LocalTime startTime;
    private LocalTime endTime;

    @Enumerated(EnumType.STRING)
    private Status status = Status.OPEN;

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL)
    private List<ScheduleRequest> requests;

    public enum Status {
        OPEN,
        REQUESTED,
        CONFIRMED
    }

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public LocalDate getDate() { return date; }
    public LocalTime getStartTime() { return startTime; }
    public LocalTime getEndTime() { return endTime; }
    public Status getStatus() { return status; }
    public List<ScheduleRequest> getRequests() { return requests; }

    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setDate(LocalDate date) { this.date = date; }
    public void setStartTime(LocalTime startTime) { this.startTime = startTime; }
    public void setEndTime(LocalTime endTime) { this.endTime = endTime; }
    public void setStatus(Status status) { this.status = status; }
    public void setRequests(List<ScheduleRequest> requests) { this.requests = requests; }
}