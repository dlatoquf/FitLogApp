package com.fitlog.fitlog.repository;

import com.fitlog.fitlog.entity.Trainer;
import com.fitlog.fitlog.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TrainerRepository extends JpaRepository<Trainer, Long> {
    Optional<Trainer> findByUser(User user);
    Optional<Trainer> findByTrainerCode(String trainerCode);
}