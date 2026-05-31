package com.fitlog.fitlog.gym.controller;

import com.fitlog.fitlog.gym.entity.Gym;
import com.fitlog.fitlog.gym.repository.GymRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/gym")
public class GymController {

    private final GymRepository gymRepository;

    public GymController(GymRepository gymRepository) {
        this.gymRepository = gymRepository;
    }

    // 제휴 코드 유효성 확인 (가입/수정 시 "확인" 버튼)
    // GET /api/gym/verify?code=ABC123
    @GetMapping("/verify")
    public ResponseEntity<Map<String, Object>> verifyAffiliateCode(@RequestParam String code) {
        Optional<Gym> gymOpt = gymRepository.findByAffiliateCode(code.toUpperCase().trim());

        if (gymOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                "valid", false,
                "message", "유효하지 않은 제휴 코드예요."
            ));
        }

        Gym gym = gymOpt.get();

        if (!"ACTIVE".equals(gym.getStatus()) || gym.getContractEnd().isBefore(LocalDate.now())) {
            return ResponseEntity.badRequest().body(Map.of(
                "valid", false,
                "message", "계약이 만료된 헬스장이에요."
            ));
        }

        return ResponseEntity.ok(Map.of(
            "valid", true,
            "gymId", gym.getGymId(),
            "gymName", gym.getName()
        ));
    }
}
