package com.fitlog.fitlog.auth.service;

import com.fitlog.fitlog.auth.dto.KakaoLoginResponse;
import com.fitlog.fitlog.auth.dto.ProfileSetupRequest;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final KakaoService kakaoService;
    private final AppleService appleService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public AuthService(
            KakaoService kakaoService,
            AppleService appleService,
            JwtService jwtService,
            UserRepository userRepository
    ) {
        this.kakaoService = kakaoService;
        this.appleService = appleService;
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

        if (user.getDeletedAt() != null) {
            throw new RuntimeException("삭제된 계정입니다. 7일 이내에 트레이너에게 복구를 요청하세요.");
        }

        System.out.println("유저 role: " + user.getRole());

        boolean isNewUser = user.getRole() == null;
        String role = user.getRole() != null ? user.getRole().name() : null;
        String jwt = jwtService.generateToken(user.getId(), user.getEmail());

        return new KakaoLoginResponse(jwt, isNewUser, role);
    }

    public KakaoLoginResponse appleLogin(String identityToken, String name) {
        AppleService.AppleUserInfo appleUser = appleService.verifyIdentityToken(identityToken, name);

        User user = userRepository.findByAppleId(appleUser.appleId())
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setAppleId(appleUser.appleId());
                    newUser.setEmail(appleUser.email());
                    // 이름은 최초 로그인 시에만 Apple이 제공 — 있으면 저장, 없으면 signup에서 입력
                    if (appleUser.name() != null && !appleUser.name().isBlank()) {
                        newUser.setName(appleUser.name());
                    }
                    return userRepository.save(newUser);
                });

        if (user.getDeletedAt() != null) {
            throw new RuntimeException("삭제된 계정입니다. 7일 이내에 트레이너에게 복구를 요청하세요.");
        }

        boolean isNewUser = user.getRole() == null;
        String role = user.getRole() != null ? user.getRole().name() : null;
        String jwt = jwtService.generateToken(user.getId(), user.getEmail());

        return new KakaoLoginResponse(jwt, isNewUser, role);
    }

    /**
     * 저장된 JWT로 유저 정보를 가져오는 메서드
     * 토큰이 만료되었거나 유효하지 않으면 JwtService에서 예외 발생 → Controller에서 401 반환
     */
    public KakaoLoginResponse getMe(String token) {
        Long userId = jwtService.getUserIdFromToken(token); // 만료 시 예외 발생

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        String role = user.getRole() != null ? user.getRole().name() : null;

        // JWT는 그대로 재사용 (재발급 하지 않음)
        return new KakaoLoginResponse(token, false, role);
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