package com.fitlog.fitlog.workout.repository;

import com.fitlog.fitlog.workout.entity.WorkoutMedia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkoutMediaRepository extends JpaRepository<WorkoutMedia, Long> {
    List<WorkoutMedia> findByWorkoutLogWorkoutId(Long workoutId);
    void deleteByWorkoutLogWorkoutId(Long workoutId);
}
