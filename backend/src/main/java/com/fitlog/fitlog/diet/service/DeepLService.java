package com.fitlog.fitlog.diet.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Service
public class DeepLService {

    @Value("${deepl.api-key}")
    private String apiKey;

    // DeepL Free API 엔드포인트 (유료는 api.deepl.com)
    private final WebClient client = WebClient.create("https://api-free.deepl.com");

    public String translateToEnglish(String koreanText) {
        try {
            Map<?, ?> response = client.post()
                    .uri("/v2/translate")
                    .header("Authorization", "DeepL-Auth-Key " + apiKey)
                    .header("Content-Type", "application/json")
                    .bodyValue(Map.of(
                            "text", List.of(koreanText),
                            "source_lang", "KO",
                            "target_lang", "EN"
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response == null) return koreanText;

            List<?> translations = (List<?>) response.get("translations");
            if (translations == null || translations.isEmpty()) return koreanText;

            Map<?, ?> first = (Map<?, ?>) translations.get(0);
            String translated = (String) first.get("text");
            return translated != null ? translated : koreanText;

        } catch (Exception e) {
            System.out.println("DeepL 번역 실패: " + e.getMessage());
            return koreanText; // 실패하면 원본 그대로 반환
        }
    }
}