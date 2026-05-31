package com.fitlog.fitlog.gym.repository;

import com.fitlog.fitlog.gym.entity.Gym;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GymRepository extends JpaRepository<Gym, Long> {
    Optional<Gym> findByAffiliateCode(String affiliateCode);
}
