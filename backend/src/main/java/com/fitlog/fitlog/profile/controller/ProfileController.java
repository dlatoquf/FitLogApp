package com.fitlog.fitlog.profile.controller;

import com.fitlog.fitlog.member.dto.MemberProfileRequest;
import com.fitlog.fitlog.trainer.dto.TrainerProfileRequest;
import com.fitlog.fitlog.trainer.dto.TrainerProfileResponse;
import com.fitlog.fitlog.profile.service.ProfileService;
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

    // 조회
    @GetMapping("/trainer")
    public ResponseEntity<TrainerProfileResponse> getTrainer(
            @RequestHeader("Authorization") String authorization
    ) {
        return ResponseEntity.ok(profileService.getTrainerProfile(authorization));
    }

    // 수정
    @PutMapping("/trainer")
    public ResponseEntity<Void> updateTrainer(
            @RequestHeader("Authorization") String authorization,
            @RequestBody TrainerProfileRequest request
    ) {
        profileService.updateTrainerProfile(authorization, request);
        return ResponseEntity.ok().build();
    }
}