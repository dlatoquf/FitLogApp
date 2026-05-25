package com.fitlog.fitlog.diet.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.BodyInserters;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class FatSecretService {

    @Value("${fatsecret.client-id}")
    private String clientId;

    @Value("${fatsecret.client-secret}")
    private String clientSecret;

    private String accessToken = null;
    private long tokenExpiresAt = 0; // epoch millis

    private final WebClient authClient = WebClient.create("https://oauth.fatsecret.com");
    private final WebClient apiClient = WebClient.create("https://platform.fatsecret.com");

    // ── OAuth2 토큰 발급 ────────────────────────────────────────────────────
    private String getAccessToken() {
        if (accessToken != null && System.currentTimeMillis() < tokenExpiresAt) return accessToken;

        Map<?, ?> response = authClient.post()
                .uri("/connect/token")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .body(BodyInserters.fromFormData("grant_type", "client_credentials")
                        .with("client_id", clientId)
                        .with("client_secret", clientSecret)
                        .with("scope", "basic"))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null || response.get("access_token") == null) {
            throw new RuntimeException("FatSecret 토큰 발급 실패");
        }

        accessToken = (String) response.get("access_token");
        // FatSecret 토큰 유효기간 86400초(24h), 안전하게 1시간 전에 갱신
        Object expiresIn = response.get("expires_in");
        long expirySec = expiresIn != null ? ((Number) expiresIn).longValue() : 86400L;
        tokenExpiresAt = System.currentTimeMillis() + (expirySec - 3600) * 1000L;
        return accessToken;
    }

    // ── 음식 검색 ────────────────────────────────────────────────────────────
    public List<FoodSearchResult> searchFood(String query) {
        String token = getAccessToken();
        System.out.println("FatSecret 토큰: " + token);

        Map<?, ?> response = apiClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/rest/server.api")
                        .queryParam("method", "foods.search")
                        .queryParam("search_expression", query)
                        .queryParam("format", "json")
                        .queryParam("max_results", "10")
                        .build())
                .header("Authorization", "Bearer " + token)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        System.out.println("FatSecret 응답: " + response);

        if (response == null) return List.of();
        if (response.get("error") != null) {
            // IP 차단 등 API 오류 → 토큰 초기화 후 빈 결과 반환 (검색 전체를 실패시키지 않음)
            accessToken = null;
            System.out.println("FatSecret API 오류 (토큰 초기화): " + response.get("error"));
            return List.of();
        }

        try {
            Map<?, ?> foods = (Map<?, ?>) response.get("foods");
            if (foods == null) return List.of();
            List<?> foodList = (List<?>) foods.get("food");
            if (foodList == null) return List.of();

            List<FoodSearchResult> result = new ArrayList<>();
            for (Object f : foodList) {
                if (!(f instanceof Map)) continue;
                Map<Object, Object> food = (Map<Object, Object>) f;
                String foodId = String.valueOf(food.get("food_id"));
                String foodName = String.valueOf(food.get("food_name"));
                Object descObj = food.get("food_description");
                String description = descObj != null ? String.valueOf(descObj) : "";
                double calories = parseNutrient(description, "Calories", "kcal");
                double fat      = parseNutrient(description, "Fat", "g");
                double carbs    = parseNutrient(description, "Carbs", "g");
                double protein  = parseNutrient(description, "Protein", "g");
                result.add(new FoodSearchResult(foodId, foodName, calories, carbs, protein, fat));
            }
            return result;
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── 영양소 파싱 ──────────────────────────────────────────────────────────
    private double parseNutrient(String description, String nutrient, String unit) {
        try {
            String pattern = nutrient + ": ";
            int start = description.indexOf(pattern);
            if (start == -1) return 0.0;
            start += pattern.length();
            int end = description.indexOf(unit, start);
            if (end == -1) return 0.0;
            return Double.parseDouble(description.substring(start, end).trim());
        } catch (Exception e) {
            return 0.0;
        }
    }

    // ── 음식 검색 결과 DTO ────────────────────────────────────────────────────
    public record FoodSearchResult(
            String foodId,
            String foodName,
            double calories,
            double carbs,
            double protein,
            double fat
    ) {}
}