package com.fitlog.fitlog.workout.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "Workout_Sets")
public class WorkoutSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "set_id")
    private Long setId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workout_id", nullable = false)
    private WorkoutLog workoutLog;

    @Column(name = "exercise_name", nullable = false)
    private String exerciseName;

    @Column(name = "weight")
    private BigDecimal weight;

    @Column(name = "reps")
    private Integer reps;

    @Column(name = "rpe")
    private Integer rpe;

    @Column(name = "memo")
    private String memo;

    // Getters & Setters
    public Long getSetId() { return setId; }
    public WorkoutLog getWorkoutLog() { return workoutLog; }
    public void setWorkoutLog(WorkoutLog workoutLog) { this.workoutLog = workoutLog; }
    public String getExerciseName() { return exerciseName; }
    public void setExerciseName(String exerciseName) { this.exerciseName = exerciseName; }
    public BigDecimal getWeight() { return weight; }
    public void setWeight(BigDecimal weight) { this.weight = weight; }
    public Integer getReps() { return reps; }
    public void setReps(Integer reps) { this.reps = reps; }
    public Integer getRpe() { return rpe; }
    public void setRpe(Integer rpe) { this.rpe = rpe; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
}