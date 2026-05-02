package com.fitlog.fitlog.controller;

import com.fitlog.fitlog.dto.MemberProfileRequest;
import com.fitlog.fitlog.dto.TrainerProfileRequest;
import com.fitlog.fitlog.service.ProfileService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    // POST /api/profile/trainer
    @PostMapping("/trainer")
    public ResponseEntity<Void> setupTrainer(
            @RequestHeader("Authorization") String authorization,
            @RequestBody TrainerProfileRequest request
    ) {
        profileService.setupTrainerProfile(authorization, request);
        return ResponseEntity.ok().build();
    }

    // POST /api/profile/member
    @PostMapping("/member")
    public ResponseEntity<Void> setupMember(
            @RequestHeader("Authorization") String authorization,
            @RequestBody MemberProfileRequest request
    ) {
        profileService.setupMemberProfile(authorization, request);
        return ResponseEntity.ok().build();
    }
}