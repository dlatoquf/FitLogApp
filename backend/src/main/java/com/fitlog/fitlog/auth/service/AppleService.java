package com.fitlog.fitlog.auth.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AppleService {

    private final WebClient webClient = WebClient.create("https://appleid.apple.com");

    public AppleUserInfo verifyIdentityToken(String identityToken, String nameFromApp) {
        try {
            // 1. Apple 공개키 목록 가져오기
            Map<?, ?> jwksResponse = webClient.get()
                    .uri("/auth/keys")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            List<Map<String, String>> keys = (List<Map<String, String>>) jwksResponse.get("keys");

            // 2. 토큰 헤더에서 kid 추출 (정규식으로 파싱)
            String[] parts = identityToken.split("\\.");
            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            Matcher kidMatcher = Pattern.compile("\"kid\"\\s*:\\s*\"([^\"]+)\"").matcher(headerJson);
            if (!kidMatcher.find()) throw new RuntimeException("kid 파싱 실패");
            String kid = kidMatcher.group(1);

            // 3. kid 일치하는 공개키 찾기
            Map<String, String> matchingKey = keys.stream()
                    .filter(k -> kid.equals(k.get("kid")))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Apple 공개키를 찾지 못했습니다."));

            // 4. RSA 공개키 생성
            byte[] nBytes = Base64.getUrlDecoder().decode(matchingKey.get("n"));
            byte[] eBytes = Base64.getUrlDecoder().decode(matchingKey.get("e"));
            BigInteger n = new BigInteger(1, nBytes);
            BigInteger e = new BigInteger(1, eBytes);
            PublicKey publicKey = KeyFactory.getInstance("RSA")
                    .generatePublic(new RSAPublicKeySpec(n, e));

            // 5. JWT 서명 검증 및 claims 파싱
            Claims claims = Jwts.parser()
                    .verifyWith((java.security.interfaces.RSAPublicKey) publicKey)
                    .build()
                    .parseSignedClaims(identityToken)
                    .getPayload();

            String appleId = claims.getSubject();  // Apple 고유 사용자 ID
            String email = claims.get("email", String.class);

            // 이메일이 없으면 appleId 기반으로 생성
            if (email == null || email.isBlank()) {
                email = appleId + "@apple.com";
            }

            return new AppleUserInfo(appleId, email, nameFromApp);

        } catch (Exception ex) {
            throw new RuntimeException("Apple identityToken 검증 실패: " + ex.getMessage(), ex);
        }
    }

    public record AppleUserInfo(String appleId, String email, String name) {}
}
