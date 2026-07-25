package com.fitlog.fitlog.bodylog.controller;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.models.messages.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/bodylog")
public class InBodyAnalyzeController {

    @Value("${ANTHROPIC_API_KEY:disabled}")
    private String anthropicApiKey;

    @PostMapping("/analyze-inbody")
    public ResponseEntity<Map<String, Object>> analyzeInbody(@RequestBody Map<String, String> body) {
        String imageUrl = body.get("imageUrl");
        if (imageUrl == null || imageUrl.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "imageUrl이 필요해요."));
        }

        try {
            AnthropicClient client = AnthropicOkHttpClient.builder()
                    .apiKey(anthropicApiKey)
                    .build();

            Message message = client.messages().create(
                    MessageCreateParams.builder()
                            .model(Model.CLAUDE_3_5_SONNET_LATEST)
                            .maxTokens(512)
                            .addUserMessageOfBlockParams(List.of(
                                    ContentBlockParam.ofImage(
                                            ImageBlockParam.builder()
                                                    .source(ImageBlockParam.Source.ofUrl(
                                                            UrlImageSource.builder()
                                                                    .url(imageUrl)
                                                                    .build()
                                                    ))
                                                    .build()
                                    ),
                                    ContentBlockParam.ofText(
                                            TextBlockParam.builder()
                                                    .text("이 인바디(체성분) 결과지 이미지에서 다음 수치를 추출해줘. " +
                                                          "반드시 JSON 형식으로만 응답해. 다른 설명 없이 JSON만. " +
                                                          "형식: {\"weight\": 숫자, \"muscleMass\": 숫자, \"bodyFatMass\": 숫자, \"bodyFat\": 숫자} " +
                                                          "weight=체중(kg), muscleMass=골격근량(kg), bodyFatMass=체지방량(kg), bodyFat=체지방률(%). " +
                                                          "값을 찾을 수 없으면 null로.")
                                                    .build()
                                    )
                            ))
                            .build()
            );

            String responseText = message.content().stream()
                    .filter(ContentBlock::isText)
                    .map(b -> b.asText().text())
                    .findFirst()
                    .orElse("{}");

            Map<String, Object> result = parseJson(responseText);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            System.err.println("[InBody 분석 오류] " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "분석에 실패했어요: " + e.getMessage()));
        }
    }

    private Map<String, Object> parseJson(String text) {
        Map<String, Object> result = new HashMap<>();
        Matcher jsonMatcher = Pattern.compile("\\{[^}]+\\}").matcher(text);
        if (!jsonMatcher.find()) return result;
        String json = jsonMatcher.group();

        extractDouble(json, "weight").ifPresent(v -> result.put("weight", v));
        extractDouble(json, "muscleMass").ifPresent(v -> result.put("muscleMass", v));
        extractDouble(json, "bodyFatMass").ifPresent(v -> result.put("bodyFatMass", v));
        extractDouble(json, "bodyFat").ifPresent(v -> result.put("bodyFat", v));
        return result;
    }

    private java.util.Optional<Double> extractDouble(String json, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*([0-9]+\\.?[0-9]*)").matcher(json);
        if (m.find()) {
            try { return java.util.Optional.of(Double.parseDouble(m.group(1))); }
            catch (NumberFormatException e) { return java.util.Optional.empty(); }
        }
        return java.util.Optional.empty();
    }
}
