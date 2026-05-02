package com.fitlog.fitlog.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class KakaoService {

    private final WebClient webClient = WebClient.create("https://kapi.kakao.com");

    public KakaoUserInfo getUserInfo(String accessToken) {
        Map<?, ?> response = webClient.get()
                .uri("/v2/user/me")
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        System.out.println("카카오 응답 = " + response);

        if (response == null || response.get("id") == null) {
            throw new RuntimeException("카카오 사용자 정보를 가져오지 못했습니다.");
        }

        Long kakaoId = ((Number) response.get("id")).longValue();

        String email = kakaoId + "@kakao.com";
        String nickname = "카카오사용자";

        Object kakaoAccountObj = response.get("kakao_account");

        if (kakaoAccountObj instanceof Map<?, ?> kakaoAccount) {

            Object profileObj = kakaoAccount.get("profile");

            if (profileObj instanceof Map<?, ?> profile) {
                Object nicknameObj = profile.get("nickname");

                if (nicknameObj instanceof String && !((String) nicknameObj).isBlank()) {
                    nickname = (String) nicknameObj;
                }
            }

            Object emailObj = kakaoAccount.get("email");

            if (emailObj instanceof String && !((String) emailObj).isBlank()) {
                email = (String) emailObj;
            }
        }

        return new KakaoUserInfo(kakaoId, email, nickname);
    }

    public record KakaoUserInfo(Long kakaoId, String email, String nickname) {}
}