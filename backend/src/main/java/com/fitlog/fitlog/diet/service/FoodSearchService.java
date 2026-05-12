package com.fitlog.fitlog.diet.service;

import com.fitlog.fitlog.diet.entity.Food;
import com.fitlog.fitlog.diet.repository.FoodRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class FoodSearchService {

    private final FoodRepository foodRepository;
    private final FatSecretService fatSecretService;
    private final DeepLService deepLService;

    @Value("${kfood.api-key:}")
    private String kfoodApiKey;

    private final WebClient kfoodClient = WebClient.create("https://apis.data.go.kr");

    public FoodSearchService(FoodRepository foodRepository, FatSecretService fatSecretService, DeepLService deepLService) {
        this.foodRepository = foodRepository;
        this.fatSecretService = fatSecretService;
        this.deepLService = deepLService;
    }

    // ── 통합 검색 결과 DTO ────────────────────────────────────────────────────
    public record FoodSearchResult(
            String foodId,       // foods.food_id (내부) 또는 fatsecret food_id (외부)
            String foodName,     // 한글 이름
            double calories,
            double carbs,
            double protein,
            double fat,
            String source        // "internal" | "kfood" | "fatsecret"
    ) {}

    // ── 메인 통합 검색 ─────────────────────────────────────────────────────────
    public List<FoodSearchResult> search(String query) {

        // Step 1: 내부 DB 조회
        List<Food> internalResults = foodRepository.findByFoodNameContaining(query);
        if (!internalResults.isEmpty()) {
            return internalResults.stream()
                    .limit(10)
                    .map(f -> new FoodSearchResult(
                            "internal:" + f.getFoodId(),
                            f.getFoodName(),
                            f.getCalories() != null ? f.getCalories() : 0,
                            f.getCarbohydrate() != null ? f.getCarbohydrate() : 0,
                            f.getProtein() != null ? f.getProtein() : 0,
                            f.getFat() != null ? f.getFat() : 0,
                            "internal"
                    ))
                    .toList();
        }

        // Step 2: 식약처 공공 API 조회 (API 키가 있을 때만)
        if (kfoodApiKey != null && !kfoodApiKey.isBlank()) {
            List<FoodSearchResult> kfoodResults = searchKfood(query);
            if (!kfoodResults.isEmpty()) {
                return kfoodResults;
            }
        }

        // Step 3: DeepL로 한글 → 영어 번역 후 FatSecret fallback
        try {
            String englishQuery = deepLService.translateToEnglish(query);
            System.out.println("DeepL 번역: " + query + " → " + englishQuery);

            List<FatSecretService.FoodSearchResult> fsResults = fatSecretService.searchFood(englishQuery);
            return fsResults.stream()
                    .map(f -> new FoodSearchResult(
                            "fatsecret:" + f.foodId(),
                            f.foodName() + " (" + englishQuery + ")",  // 영어 이름 + 번역어 표시
                            f.calories(),
                            f.carbs(),
                            f.protein(),
                            f.fat(),
                            "fatsecret"
                    ))
                    .toList();
        } catch (Exception e) {
            return List.of();
        }
    }

    // ── 식약처 공공 API 호출 ─────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private List<FoodSearchResult> searchKfood(String query) {
        try {
            Map<?, ?> response = kfoodClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/1471000/FoodNtrIrdntInfoService1/getFoodNtrItdntList1")
                            .queryParam("serviceKey", kfoodApiKey)
                            .queryParam("desc_kor", query)
                            .queryParam("pageNo", "1")
                            .queryParam("numOfRows", "10")
                            .queryParam("type", "json")
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) return List.of();

            // 식약처 응답 파싱: response.body.items[].item
            Map<?, ?> body = (Map<?, ?>) ((Map<?, ?>) response.get("response")).get("body");
            if (body == null) return List.of();

            Object itemsObj = body.get("items");
            if (itemsObj == null) return List.of();

            List<?> items;
            if (itemsObj instanceof Map) {
                Object itemObj = ((Map<?, ?>) itemsObj).get("item");
                if (itemObj instanceof List) {
                    items = (List<?>) itemObj;
                } else if (itemObj instanceof Map) {
                    items = List.of(itemObj); // 단건
                } else {
                    return List.of();
                }
            } else {
                return List.of();
            }

            List<FoodSearchResult> results = new ArrayList<>();
            for (Object i : items) {
                if (!(i instanceof Map)) continue;
                Map<Object, Object> item = (Map<Object, Object>) i;

                String foodName = getString(item, "DESC_KOR");
                if (foodName == null || foodName.isBlank()) continue;

                results.add(new FoodSearchResult(
                        "kfood:" + getString(item, "FOOD_CD"),
                        foodName,
                        parseDouble(item, "NUTR_CONT1"),  // 칼로리
                        parseDouble(item, "NUTR_CONT3"),  // 탄수화물
                        parseDouble(item, "NUTR_CONT2"),  // 단백질 (실제 순서: 단백질=2, 지방=4, 탄수=3)
                        parseDouble(item, "NUTR_CONT4"),  // 지방
                        "kfood"
                ));
            }
            return results;

        } catch (Exception e) {
            System.out.println("식약처 API 오류: " + e.getMessage());
            return List.of();
        }
    }

    // ── 식약처 결과를 foods 테이블에 캐싱 ───────────────────────────────────
    public Food cacheKfoodResult(FoodSearchResult result) {
        Food food = new Food();
        food.setFoodName(result.foodName());
        food.setCalories((float) result.calories());
        food.setCarbohydrate((float) result.carbs());
        food.setProtein((float) result.protein());
        food.setFat((float) result.fat());
        food.setSourceType(result.source()); // "kfood" or "fatsecret"
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
            if (val == null) return 0.0;
            return Double.parseDouble(String.valueOf(val));
        } catch (Exception e) {
            return 0.0;
        }
    }
}