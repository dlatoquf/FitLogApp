package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.trainer.dto.TrainerHomeResponse;
import com.fitlog.fitlog.trainer.service.TrainerHomeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trainer")
public class TrainerHomeController {

    private final TrainerHomeService trainerHomeService;

    public TrainerHomeController(TrainerHomeService trainerHomeService) {
        this.trainerHomeService = trainerHomeService;
    }

    // GET /api/trainer/home
    @GetMapping("/home")
    public ResponseEntity<TrainerHomeResponse> getHome(
            @RequestHeader("Authorization") String authorization
    ) {
        return ResponseEntity.ok(trainerHomeService.getHome(authorization));
    }
}
