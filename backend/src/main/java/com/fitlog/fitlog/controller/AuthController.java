package com.fitlog.fitlog.controller;

import com.fitlog.fitlog.dto.KakaoLoginRequest;
import com.fitlog.fitlog.dto.KakaoLoginResponse;
import com.fitlog.fitlog.dto.ProfileSetupRequest;
import com.fitlog.fitlog.service.AuthService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/kakao")
    public KakaoLoginResponse kakaoLogin(@RequestBody KakaoLoginRequest request) {
        return authService.kakaoLogin(request.getAccessToken());
    }

    @PostMapping("/profile")
    public void setupProfile(
            @RequestHeader("Authorization") String authorization,
            @RequestBody ProfileSetupRequest request
    ) {
        authService.setupProfile(authorization, request);
    }
    @DeleteMapping("/test/users")
    public void deleteAllUsers() {
        authService.deleteAllUsers();
    }
}