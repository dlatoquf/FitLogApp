package com.fitlog.fitlog.diet.service;

import com.fitlog.fitlog.diet.entity.Food;
import com.fitlog.fitlog.diet.repository.FoodRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import io.netty.resolver.DefaultAddressResolverGroup;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.HashSet;
import java.util.Set;

@Service
public class FoodSearchService {

    private final FoodRepository foodRepository;

    @Value("${kfood.api-key:}")
    private String kfoodApiKey;

    private final WebClient kfoodClient = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(
                    HttpClient.create()
                            .resolver(DefaultAddressResolverGroup.INSTANCE)
                            .responseTimeout(Duration.ofSeconds(5))
            ))
            .build();

    private final WebClient offClient = WebClient.builder()
            .clientConnector(new ReactorClientHttpConnector(
                    HttpClient.create()
                            .resolver(DefaultAddressResolverGroup.INSTANCE)
                            .responseTimeout(Duration.ofSeconds(5))
            ))
            .baseUrl("https://world.openfoodfacts.org")
            .build();

    public FoodSearchService(FoodRepository foodRepository) {
        this.foodRepository = foodRepository;
    }

    public record FoodSearchResult(
            String foodId,
            String foodName,
            double calories,
            double carbs,
            double protein,
            double fat,
            String source
    ) {}

    public List<FoodSearchResult> search(String query) {

        String normalizedQuery = query.replace(" ", "").toLowerCase();

        // Step 1: 내부 DB 조회
        List<FoodSearchResult> internalResults = foodRepository.findByFoodNameContaining(query)
                .stream()
                .map(f -> {
                    String cleanName = f.getFoodName().replaceAll("_.*", "").trim();
                    return new FoodSearchResult(
                            "internal:" + f.getFoodId(),
                            cleanName,
                            f.getCalories() != null ? Math.round(f.getCalories() * 10.0) / 10.0 : 0,
                            f.getCarbohydrate() != null ? Math.round(f.getCarbohydrate() * 10.0) / 10.0 : 0,
                            f.getProtein() != null ? Math.round(f.getProtein() * 10.0) / 10.0 : 0,
                            f.getFat() != null ? Math.round(f.getFat() * 10.0) / 10.0 : 0,
                            "internal"
                    );
                })
                .filter(r -> r.foodName().replace(" ", "").toLowerCase().contains(normalizedQuery))
                .toList();

        // Step 2: 식약처 + OpenFoodFacts 병렬 호출
        ExecutorService executor = Executors.newFixedThreadPool(2);

        Future<List<FoodSearchResult>> kfoodFuture = executor.submit(() -> {
            if (kfoodApiKey != null && !kfoodApiKey.isBlank()) {
                return searchKfood(query);
            }
            return List.of();
        });

        Future<List<FoodSearchResult>> offFuture = executor.submit(() -> {
            try {
                return searchOpenFoodFacts(query);
            } catch (Exception e) {
                return List.of();
            }
        });

        List<FoodSearchResult> kfoodResults = new ArrayList<>();
        List<FoodSearchResult> offResults = new ArrayList<>();

        try {
            kfoodResults = kfoodFuture.get(4, TimeUnit.SECONDS);
        } catch (Exception e) {
            System.out.println("식약처 타임아웃 또는 오류");
        }

        try {
            offResults = offFuture.get(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            System.out.println("OpenFoodFacts 타임아웃 또는 오류");
        }

        executor.shutdown();

        List<FoodSearchResult> combined = Stream.concat(
                internalResults.stream(),
                Stream.concat(
                        kfoodResults.stream(),
                        offResults.stream()
                )
        ).collect(Collectors.toList());

        return sortResults(combined, query)
                .stream()
                .limit(10)
                .toList();
    }

    private List<FoodSearchResult> sortResults(List<FoodSearchResult> results, String query) {

        return results.stream()
                .sorted(Comparator.comparingInt(r ->
                        scoreFoodName(r.foodName(), query)
                ))
                .toList();
    }

    private int scoreFoodName(String name, String query) {
        if (name == null) return 999;
        String normalizedName =
                name.replace(" ", "")
                        .replace(",", "")
                        .toLowerCase();

        String normalizedQuery =
                query.replace(" ", "")
                        .replace(",", "")
                        .toLowerCase();

        // 완전 일치
        if (normalizedName.equals(normalizedQuery)) return 0;
        // 시작 일치
        if (normalizedName.startsWith(normalizedQuery)) return 1;
        // _우유 / _김치찌개
        if (normalizedName.contains("_" + normalizedQuery)) return 2;
        // 포함
        if (normalizedName.contains(normalizedQuery)) return 3;

        return 999;
    }

    @SuppressWarnings("unchecked")
    private List<FoodSearchResult> searchKfood(String query) {

        try {

            String encodedQuery =
                    java.net.URLEncoder.encode(
                            query,
                            java.nio.charset.StandardCharsets.UTF_8
                    );

            String rawUrl =
                    "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo02/getFoodNtrCpntDbInq02"
                            + "?serviceKey=" + kfoodApiKey
                            + "&FOOD_NM_KR=" + encodedQuery
                            + "&pageNo=1&numOfRows=30&type=json";

            Map<?, ?> response = kfoodClient.get()
                    .uri(java.net.URI.create(rawUrl))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(2));

            if (response == null) return List.of();

            Map<?, ?> body = (Map<?, ?>) response.get("body");
            if (body == null) return List.of();

            Object itemsObj = body.get("items");
            if (itemsObj == null) return List.of();

            List<?> items;

            if (itemsObj instanceof Map) {

                Object itemObj = ((Map<?, ?>) itemsObj).get("item");

                if (itemObj instanceof List) {
                    items = (List<?>) itemObj;
                } else if (itemObj instanceof Map) {
                    items = List.of(itemObj);
                } else {
                    return List.of();
                }

            } else {
                return List.of();
            }

            List<FoodSearchResult> results = new ArrayList<>();

            Set<String> seen = new HashSet<>();

            String normalizedQuery =
                    query.replace(" ", "")
                            .toLowerCase();

            for (Object i : items) {

                if (!(i instanceof Map)) continue;

                Map<Object, Object> item =
                        (Map<Object, Object>) i;

                String foodName =
                        getString(item, "FOOD_NM_KR");

                if (foodName == null || foodName.isBlank()) {
                    continue;
                }

                // 이름 정리
                foodName =
                        foodName.replaceAll("_.*", "")
                                .trim();

                String normalizedFood =
                        foodName.replace(" ", "")
                                .toLowerCase();

                // 검색어 포함 안되면 제거
                if (!normalizedFood.contains(normalizedQuery)) {
                    continue;
                }

                // 우유 예외처리: "우유" 검색시 우유크림/우유맛 파생 제품 제거
                if (normalizedQuery.equals("우유")) {

                    if (
                            normalizedFood.contains("도넛") ||
                                    normalizedFood.contains("빵") ||
                                    normalizedFood.contains("과자") ||
                                    normalizedFood.contains("크림") ||
                                    normalizedFood.contains("우유크림") ||
                                    normalizedFood.contains("우유맛") ||
                                    normalizedFood.contains("케이크")
                    ) {
                        continue;
                    }
                }

                double calories =
                        parseDouble(item, "AMT_NUM1");

                double protein =
                        parseDouble(item, "AMT_NUM3");

                double fat =
                        parseDouble(item, "AMT_NUM4");

                double carbs =
                        parseDouble(item, "AMT_NUM6");

                // 중복 제거
                String dedupeKey =
                        foodName + "_" + calories;

                if (seen.contains(dedupeKey)) {
                    continue;
                }

                seen.add(dedupeKey);

                results.add(new FoodSearchResult(
                        "kfood:" + getString(item, "FOOD_CD"),
                        foodName,
                        calories,
                        carbs,
                        protein,
                        fat,
                        "kfood"
                ));
            }

            return results;

        } catch (Exception e) {

            System.out.println(
                    "식약처 API 오류: " + e.getMessage()
            );

            return List.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<FoodSearchResult> searchOpenFoodFacts(String query) {
        try {
            String encodedQuery = java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8);
            String rawUrl = "https://world.openfoodfacts.org/cgi/search.pl"
                    + "?search_terms=" + encodedQuery
                    + "&search_simple=1&action=process&json=1&page_size=20&lc=ko";

            Map<?, ?> response = offClient.get()
                    .uri(java.net.URI.create(rawUrl))
                    .header("User-Agent", "FitLogApp/1.0")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofSeconds(4));

            if (response == null) return List.of();

            List<?> products = (List<?>) response.get("products");
            if (products == null) return List.of();

            String normalizedQuery = query.replace(" ", "").toLowerCase();
            List<FoodSearchResult> results = new ArrayList<>();

            for (Object p : products) {
                if (!(p instanceof Map)) continue;
                Map<Object, Object> product = (Map<Object, Object>) p;

                String name = getString(product, "product_name_ko");
                if (name == null || name.isBlank()) name = getString(product, "product_name");
                if (name == null || name.isBlank()) continue;
                if (!name.replace(" ", "").toLowerCase().contains(normalizedQuery)) continue;

                Map<?, ?> nutriments = (Map<?, ?>) product.get("nutriments");
                if (nutriments == null) continue;

                double calories = parseDoubleFromMap(nutriments, "energy-kcal_100g");
                double carbs    = parseDoubleFromMap(nutriments, "carbohydrates_100g");
                double protein  = parseDoubleFromMap(nutriments, "proteins_100g");
                double fat      = parseDoubleFromMap(nutriments, "fat_100g");

                if (calories == 0 && carbs == 0 && protein == 0) continue;

                String id = getString(product, "code");
                results.add(new FoodSearchResult(
                        "off:" + (id != null ? id : name),
                        name.trim(),
                        Math.round(calories * 10.0) / 10.0,
                        Math.round(carbs * 10.0) / 10.0,
                        Math.round(protein * 10.0) / 10.0,
                        Math.round(fat * 10.0) / 10.0,
                        "openfoodfacts"
                ));
            }
            return results;
        } catch (Exception e) {
            System.out.println("OpenFoodFacts 오류: " + e.getMessage());
            return List.of();
        }
    }

    private double parseDoubleFromMap(Map<?, ?> map, String key) {
        try {
            Object val = map.get(key);
            if (val == null) return 0.0;
            return Double.parseDouble(String.valueOf(val));
        } catch (Exception e) {
            return 0.0;
        }
    }

    public Food cacheKfoodResult(FoodSearchResult result) {
        Food food = new Food();
        food.setFoodName(result.foodName());
        food.setCalories((float) result.calories());
        food.setCarbohydrate((float) result.carbs());
        food.setProtein((float) result.protein());
        food.setFat((float) result.fat());
        food.setSourceType(result.source());
        food.setBaseAmount("100g");
        return foodRepository.save(food);
    }

    private String getString(Map<Object, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? String.valueOf(val) : null;
    }

    private double parseDouble(Map<Object, Object> map, String key) {
        try {
            Object val = map.get(key);
            if (val == null || String.valueOf(val).isBlank()) return 0.0;
            return Double.parseDouble(String.valueOf(val));
        } catch (Exception e) {
            return 0.0;
        }
    }
}