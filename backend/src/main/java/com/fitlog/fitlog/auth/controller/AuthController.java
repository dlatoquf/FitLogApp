package com.fitlog.fitlog.auth.controller;

import com.fitlog.fitlog.auth.dto.KakaoLoginRequest;
import com.fitlog.fitlog.auth.dto.KakaoLoginResponse;
import com.fitlog.fitlog.auth.dto.ProfileSetupRequest;
import com.fitlog.fitlog.auth.service.AuthService;
import org.springframework.http.ResponseEntity;
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

    /**
     * 앱 시작 시 저장된 JWT가 유효한지 검증하는 엔드포인트
     * 유효하면 유저 정보 반환, 만료/invalid면 401
     */
    @GetMapping("/me")
    public ResponseEntity<KakaoLoginResponse> getMe(
            @RequestHeader("Authorization") String authorization
    ) {
        try {
            String token = authorization.replace("Bearer ", "");
            KakaoLoginResponse response = authService.getMe(token);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            // 토큰 만료 또는 유효하지 않은 경우 → 프론트에서 로그인 화면으로 이동
            return ResponseEntity.status(401).build();
        }
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