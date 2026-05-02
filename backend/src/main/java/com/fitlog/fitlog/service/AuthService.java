package com.fitlog.fitlog.service;

import com.fitlog.fitlog.dto.KakaoLoginResponse;
import com.fitlog.fitlog.dto.ProfileSetupRequest;
import com.fitlog.fitlog.entity.User;
import com.fitlog.fitlog.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final KakaoService kakaoService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthService(
            KakaoService kakaoService,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.kakaoService = kakaoService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    public KakaoLoginResponse kakaoLogin(String accessToken) {
        KakaoService.KakaoUserInfo kakaoUser = kakaoService.getUserInfo(accessToken);

        System.out.println("kakaoId 값: " + kakaoUser.kakaoId());
        System.out.println("nickname 값: " + kakaoUser.nickname());

        // 기존 유저 찾거나 신규 생성
        User user = userRepository.findByKakaoId(kakaoUser.kakaoId())
                .orElseGet(() -> {
                    System.out.println("신규 유저 생성!");
                    User newUser = new User();
                    newUser.setKakaoId(kakaoUser.kakaoId());
                    newUser.setEmail(kakaoUser.email());
                    newUser.setName(kakaoUser.nickname());
                    return userRepository.save(newUser);
                });

        System.out.println("유저 role: " + user.getRole());

        boolean isNewUser = user.getRole() == null;
        String role = user.getRole() != null ? user.getRole().name() : null;
        String jwt = jwtService.generateToken(user.getId(), user.getEmail());

        return new KakaoLoginResponse(jwt, isNewUser, role);
    }

    public void setupProfile(String authorization, ProfileSetupRequest request) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        user.setName(request.getName());
        user.setRole(User.Role.valueOf(request.getRole().toUpperCase()));
        userRepository.save(user);
    }

    public void deleteAllUsers() {
        userRepository.deleteAll();
    }
}