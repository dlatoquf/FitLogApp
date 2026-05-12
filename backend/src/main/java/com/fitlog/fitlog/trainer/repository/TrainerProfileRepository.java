package com.fitlog.fitlog.trainer.repository;

import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TrainerProfileRepository extends JpaRepository<Trainer, Long> {

    Optional<Trainer> findByUser(User user);

    @Query("SELECT t FROM Trainer t JOIN FETCH t.user WHERE t.user.id = :userId")
    Optional<Trainer> findByUserId(@Param("userId") Long userId);

}