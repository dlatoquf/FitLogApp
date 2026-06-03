package com.fitlog.fitlog.notification.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Solapi 문자/알림톡 발송 서비스
 *
 * 사용 방법:
 *  1. solapi.com 가입 후 API Key / Secret 발급
 *  2. application.properties에 설정값 추가
 *  3. 카카오 알림톡 사용 시: 채널 연결 + 템플릿 등록/승인 필요
 *     (승인 전에도 SMS 폴백으로 발송 가능)
 *
 * 발송 흐름:
 *  미연동 회원 운동 로그 저장 → 전화번호 확인 → LMS 문자(또는 카카오 알림톡) 발송
 *  → "앱 설치 후 트레이너 연동하면 기록 확인 가능" 안내
 *
 * 현재 상태:
 *  kakao-channel-id, kakao-template-code 미설정 → LMS 문자로 발송 중
 *  카카오 알림톡 전환 방법:
 *    1) 카카오 채널 개설 (https://center-pf.kakao.com)
 *    2) Solapi 콘솔에서 카카오 채널 연결
 *    3) 알림톡 템플릿 등록 → 카카오 검수 승인 (수일 소요)
 *    4) application.properties에 kakao-channel-id, kakao-template-code 입력
 */
@Service
public class SolapiService {

    private static final String SOLAPI_URL = "https://api.solapi.com/messages/v4/send";

    // application.properties에서 주입
    @Value("${solapi.api-key:}")
    private String apiKey;

    @Value("${solapi.api-secret:}")
    private String apiSecret;

    // 카카오 알림톡 채널 (kakao.com/channel 채널 ID, 예: @fitlog)
    // 없으면 SMS로 자동 폴백됨
    @Value("${solapi.kakao-channel-id:}")
    private String kakaoChannelId;

    // 운동기록 알림 템플릿 코드
    @Value("${solapi.kakao-template-code:}")
    private String kakaoTemplateCode;

    // 수업확정 알림 템플릿 코드
    @Value("${solapi.kakao-schedule-template-code:}")
    private String kakaoScheduleTemplateCode;

    // 발신 번호 (사전 등록 필요)
    @Value("${solapi.sender-number:}")
    private String senderNumber;

    // 앱 다운로드 링크
    @Value("${app.download-link:https://fitlog.app/download}")
    private String appDownloadLink;

    /**
     * 미연동 회원에게 운동 로그 저장 알림 발송 (하위 호환 - 기본 정보만)
     */
    public void sendWorkoutLogNotice(String memberName, String phone,
                                     List<Map<String, Object>> exercises, String trainerName) {
        sendWorkoutLogNotice(memberName, phone, exercises, trainerName, null, null, Collections.emptyList(), null, null);
    }

    /**
     * 미연동 회원에게 운동 로그 저장 알림 발송 (컨디션·피드백·미션 포함)
     *
     * @param memberName    회원 이름
     * @param phone         수신 전화번호
     * @param exercises     운동 목록 [{name, memo, sets:[{setNumber,weight,reps}]}]
     * @param trainerName   트레이너 이름
     * @param conditionScore 컨디션 점수 (1=나쁨, 2=보통, 3=좋음, 4=최상) — null 가능
     * @param feedback      수업 피드백 — null 가능
     * @param missions      챌린지 미션 목록 — empty 가능
     */
    public void sendWorkoutLogNotice(String memberName, String phone,
                                     List<Map<String, Object>> exercises, String trainerName,
                                     Integer conditionScore, String feedback, List<String> missions,
                                     String trainerCode, Integer sessionNumber) {
        // 설정값 없으면 발송 스킵
        if (apiKey.isBlank() || apiSecret.isBlank() || senderNumber.isBlank()) {
            System.out.println("[Solapi] API 키 미설정 — 알림톡 발송 스킵. application.properties 확인 필요.");
            return;
        }
        if (phone == null || phone.isBlank()) {
            System.out.println("[Solapi] 전화번호 없음 — 발송 스킵 (회원: " + memberName + ")");
            return;
        }

        // 전화번호 정규화: 하이픈 제거
        String normalizedPhone = phone.replaceAll("[^0-9]", "");

        // 전체 운동 포맷 메시지 생성
        String messageText = buildFullWorkoutText(memberName, trainerName, exercises, conditionScore, feedback, missions, trainerCode, sessionNumber);

        try {
            // Solapi HMAC-SHA256 인증 헤더 생성
            String authHeader = buildAuthHeader();

            // LMS 대체발송 내용 (세트/무게 전체 상세) — 카카오톡 없는 분께 자동 전송
            Map<String, Object> message = new HashMap<>();
            message.put("to", normalizedPhone);
            message.put("from", senderNumber.replaceAll("[^0-9]", ""));
            message.put("text", messageText); // 알림톡 실패 시 이 내용으로 LMS 발송

            if (!kakaoChannelId.isBlank() && !kakaoTemplateCode.isBlank()) {
                // 알림톡 (카카오톡 있는 분): 간단한 알림 + 앱 링크
                message.put("type", "ATA");

                Map<String, Object> kakaoOptions = new HashMap<>();
                kakaoOptions.put("pfId", kakaoChannelId);
                kakaoOptions.put("templateId", kakaoTemplateCode);

                // 템플릿 변수
                Map<String, String> variables = new HashMap<>();
                variables.put("#{name}", memberName);
                variables.put("#{trainerName}", trainerName);
                variables.put("#{appLink}", appDownloadLink);
                kakaoOptions.put("variables", variables);

                // 대체발송: 알림톡 실패 시 LMS로 자동 전환 (text 필드 = 세트 상세 내용)
                kakaoOptions.put("disableSms", false); // 폴백 활성화
                message.put("kakaoOptions", kakaoOptions);
            } else {
                // 알림톡 미설정 → 바로 LMS (세트 상세 내용)
                message.put("type", "LMS");
                message.put("subject", "[핏로그] PT 기록");
            }

            Map<String, Object> body = new HashMap<>();
            body.put("message", message);

            // Solapi API 호출 (비동기, 실패해도 로그 저장에 영향 없음)
            WebClient.create(SOLAPI_URL)
                    .post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", authHeader)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            response -> System.out.println("[Solapi] 발송 성공: " + response),
                            error   -> System.out.println("[Solapi] 발송 실패: " + error.getMessage())
                    );

        } catch (Exception e) {
            // 발송 실패해도 운동 로그 저장에는 영향 없음
            System.out.println("[Solapi] 예외 발생: " + e.getMessage());
        }
    }

    /**
     * 미연동 회원에게 수업 확정 알림 발송 (PT / OT 구분)
     *
     * @param memberName  회원 이름
     * @param phone       수신 전화번호
     * @param trainerName 트레이너 이름
     * @param date        수업 날짜 (예: 2026-05-27)
     * @param time        수업 시간 (예: 10:00)
     * @param isOt        true면 OT(체험) 수업 문구, false면 PT 수업 문구
     */
    public void sendScheduleConfirm(String memberName, String phone,
                                    String trainerName, String date, String time,
                                    boolean isOt) {
        if (apiKey.isBlank() || apiSecret.isBlank() || senderNumber.isBlank()) return;
        if (phone == null || phone.isBlank()) {
            System.out.println("[Solapi] 전화번호 없음 — 수업 확정 알림 스킵 (회원: " + memberName + ")");
            return;
        }

        String normalizedPhone = phone.replaceAll("[^0-9]", "");

        // 날짜 한국어 포맷 (2026-05-27 → 5월 27일)
        String dateKr = date;
        try {
            String[] parts = date.split("-");
            dateKr = parts[1].replaceFirst("^0", "") + "월 " + parts[2].replaceFirst("^0", "") + "일";
        } catch (Exception ignored) {}

        String messageText;
        if (isOt) {
            messageText = String.format(
                    "[핏로그] %s님, OT(체험 수업)이 확정됐어요! 🎉\n\n" +
                    "🗓 일시: %s %s\n" +
                    "👤 트레이너: %s\n\n" +
                    "첫 수업인 만큼 편하게 오세요 😊",
                    memberName, dateKr, time, trainerName
            );
        } else {
            messageText = String.format(
                    "[핏로그] %s님, PT 수업이 확정됐어요! 📅\n\n" +
                    "🗓 일시: %s %s\n" +
                    "👤 트레이너: %s\n\n" +
                    "수업 당일 잊지 마세요 😊",
                    memberName, dateKr, time, trainerName
            );
        }

        try {
            String authHeader = buildAuthHeader();
            Map<String, Object> message = new HashMap<>();
            message.put("to", normalizedPhone);
            message.put("from", senderNumber.replaceAll("[^0-9]", ""));
            message.put("text", messageText);

            // 알림톡 템플릿이 설정되어 있으면 ATA, 없으면 LMS
            if (!isOt && !kakaoChannelId.isBlank() && !kakaoScheduleTemplateCode.isBlank()) {
                // OT는 별도 알림톡 템플릿 없으므로 LMS로 발송
                message.put("type", "ATA");
                Map<String, Object> kakaoOptions = new HashMap<>();
                kakaoOptions.put("pfId", kakaoChannelId);
                kakaoOptions.put("templateId", kakaoScheduleTemplateCode);
                Map<String, String> variables = new HashMap<>();
                variables.put("#{name}", memberName);
                variables.put("#{date}", dateKr);
                variables.put("#{time}", time);
                variables.put("#{trainerName}", trainerName);
                kakaoOptions.put("variables", variables);
                kakaoOptions.put("disableSms", false);
                message.put("kakaoOptions", kakaoOptions);
            } else {
                message.put("type", "LMS");
                message.put("subject", isOt ? "[핏로그] OT 체험 수업 확정 안내" : "[핏로그] PT 수업 확정 안내");
            }

            Map<String, Object> body = new HashMap<>();
            body.put("message", message);

            WebClient.create(SOLAPI_URL)
                    .post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", authHeader)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            response -> System.out.println("[Solapi] 수업 확정 알림 발송 성공: " + response),
                            error    -> System.out.println("[Solapi] 수업 확정 알림 발송 실패: " + error.getMessage())
                    );
        } catch (Exception e) {
            System.out.println("[Solapi] 수업 확정 알림 예외: " + e.getMessage());
        }
    }

    /**
     * 하위 호환용 — isOt 없이 호출 시 PT로 처리
     */
    public void sendScheduleConfirm(String memberName, String phone,
                                    String trainerName, String date, String time) {
        sendScheduleConfirm(memberName, phone, trainerName, date, time, false);
    }

    /**
     * OT(체험) 회원에게 수업 완료 감사 문자 발송
     * 수업이 끝나고 운동 로그 저장 시 자동 발송
     */
    public void sendOtWorkoutComplete(String memberName, String phone,
                                      String trainerName, List<Map<String, Object>> exercises) {
        if (apiKey.isBlank() || apiSecret.isBlank() || senderNumber.isBlank()) return;
        if (phone == null || phone.isBlank()) return;

        String normalizedPhone = phone.replaceAll("[^0-9]", "");

        // 운동 목록 상세 (세트/무게/횟수 포함)
        StringBuilder exSummary = new StringBuilder();
        if (exercises != null && !exercises.isEmpty()) {
            for (Map<String, Object> ex : exercises) {
                String name = String.valueOf(ex.getOrDefault("name", ""));
                if (name.isBlank()) continue;
                List<Map<String, Object>> sets = Collections.emptyList();
                if (ex.get("sets") instanceof List<?> rawSets) {
                    sets = rawSets.stream()
                            .filter(s -> s instanceof Map)
                            .map(s -> (Map<String, Object>) s)
                            .collect(java.util.stream.Collectors.toList());
                }
                exSummary.append(name);
                if (!sets.isEmpty()) exSummary.append(" ").append(sets.size()).append("세트");
                exSummary.append("\n");
                for (Map<String, Object> set : sets) {
                    int setNum = toInt(set.get("setNumber"));
                    double weight = toDouble(set.get("weight"));
                    int reps = toInt(set.get("reps"));
                    String weightStr = weight == 0 ? "맨몸" : formatWeight(weight) + "kg";
                    exSummary.append(setNum).append("세트 ").append(weightStr).append(" × ").append(reps).append("회\n");
                }
                exSummary.append("\n");
            }
        }

        String text = String.format(
                "[핏로그] %s님, 오늘 체험 수업 수고하셨어요! 💪\n\n" +
                "오늘 하신 운동:\n%s" +
                "──────────────\n" +
                "PT는 이렇게 체계적으로 관리돼요.\n" +
                "정식 PT로 더 체계적인 관리를 받아보세요! 💪\n\n" +
                "트레이너: %s",
                memberName,
                exSummary.length() > 0 ? exSummary.toString() : "오늘의 운동\n\n",
                trainerName
        );

        try {
            String authHeader = buildAuthHeader();
            Map<String, Object> message = new HashMap<>();
            message.put("to",      normalizedPhone);
            message.put("from",    senderNumber.replaceAll("[^0-9]", ""));
            message.put("type",    "LMS");
            message.put("subject", "[핏로그] 체험 수업 완료");
            message.put("text",    text);

            Map<String, Object> body = new HashMap<>();
            body.put("message", message);

            WebClient.create(SOLAPI_URL)
                    .post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", authHeader)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            r -> System.out.println("[Solapi] OT 완료 문자 발송 성공"),
                            e -> System.out.println("[Solapi] OT 완료 문자 발송 실패: " + e.getMessage())
                    );
        } catch (Exception e) {
            System.out.println("[Solapi] OT 완료 문자 예외: " + e.getMessage());
        }
    }

    /**
     * 관리자에게 새 문의 접수 알림 발송
     */
    public void sendInquiryNoticeToAdmin(String adminPhone, String trainerName,
                                          String title, String content) {
        sendInquiryNoticeToAdmin(adminPhone, trainerName, title, content, null);
    }

    public void sendInquiryNoticeToAdmin(String adminPhone, String trainerName,
                                          String title, String content, Long inquiryId) {
        if (apiKey.isBlank() || apiSecret.isBlank() || senderNumber.isBlank()) return;
        if (adminPhone == null || adminPhone.isBlank()) return;

        String normalizedPhone = adminPhone.replaceAll("[^0-9]", "");
        String idInfo = inquiryId != null ? " (ID: " + inquiryId + ")" : "";
        String text = String.format(
                "[핏로그] 새 문의가 접수됐어요!%s\n\n" +
                "트레이너: %s\n" +
                "제목: %s\n\n" +
                "%s",
                idInfo, trainerName, title, content
        );

        try {
            String authHeader = buildAuthHeader();
            Map<String, Object> message = new HashMap<>();
            message.put("to",      normalizedPhone);
            message.put("from",    senderNumber.replaceAll("[^0-9]", ""));
            message.put("type",    "LMS");
            message.put("subject", "[핏로그] 새 문의 접수");
            message.put("text",    text);

            Map<String, Object> body = new HashMap<>();
            body.put("message", message);

            WebClient.create(SOLAPI_URL)
                    .post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", authHeader)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            r -> System.out.println("[Solapi] 문의 관리자 알림 발송 성공"),
                            e -> System.out.println("[Solapi] 문의 관리자 알림 발송 실패: " + e.getMessage())
                    );
        } catch (Exception e) {
            System.out.println("[Solapi] 문의 관리자 알림 예외: " + e.getMessage());
        }
    }

    /**
     * 미연동 회원에게 피드백 + 챌린지 미션 문자 발송
     */
    public void sendFeedbackAndMissions(String memberName, String phone,
                                        String trainerName, String feedback,
                                        List<String> missions) {
        if (apiKey.isBlank() || apiSecret.isBlank() || senderNumber.isBlank()) return;
        if (phone == null || phone.isBlank()) return;

        String normalizedPhone = phone.replaceAll("[^0-9]", "");
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("[핏로그] %s님, %s 트레이너 메시지예요! 💬\n\n", memberName, trainerName));

        if (feedback != null && !feedback.isBlank()) {
            sb.append(feedback).append("\n\n");
        }

        if (missions != null && !missions.isEmpty()) {
            sb.append("💪 다음 수업 전까지 해보세요!\n");
            for (String m : missions) {
                sb.append("• ").append(m).append("\n");
            }
            sb.append("\n");
        }

        // 앱 링크 제거 — 미등록 회원에게 불필요한 정보 제외

        try {
            String authHeader = buildAuthHeader();
            Map<String, Object> message = new HashMap<>();
            message.put("to", normalizedPhone);
            message.put("from", senderNumber.replaceAll("[^0-9]", ""));
            message.put("text", sb.toString());
            message.put("type", "LMS");
            message.put("subject", "[핏로그] " + trainerName + " 트레이너 메시지");

            Map<String, Object> body = new HashMap<>();
            body.put("message", message);

            WebClient.create(SOLAPI_URL)
                    .post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", authHeader)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(String.class)
                    .subscribe(
                            response -> System.out.println("[Solapi] 미션 문자 발송 성공: " + response),
                            error   -> System.out.println("[Solapi] 미션 문자 발송 실패: " + error.getMessage())
                    );
        } catch (Exception e) {
            System.out.println("[Solapi] 미션 문자 예외: " + e.getMessage());
        }
    }

    /**
     * Solapi HMAC-SHA256 인증 헤더 생성
     * 형식: HMAC-SHA256 ApiKey={key}, Date={date}, Salt={salt}, Signature={sig}
     * 서명 대상: {date}{salt}
     */
    private String buildAuthHeader() throws Exception {
        String date = Instant.now().toString();          // ISO-8601
        String salt = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String data = date + salt;

        // HMAC-SHA256 서명
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(apiSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] rawHmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));

        StringBuilder sb = new StringBuilder();
        for (byte b : rawHmac) {
            sb.append(String.format("%02x", b));
        }
        String signature = sb.toString();

        return String.format(
                "HMAC-SHA256 ApiKey=%s, Date=%s, Salt=%s, Signature=%s",
                apiKey, date, salt, signature
        );
    }

    /**
     * 운동 기록 전체 포맷 메시지
     * exercises: [{name, memo, sets:[{setNumber,weight,reps}]}]
     */
    @SuppressWarnings("unchecked")
    private String buildFullWorkoutText(String memberName, String trainerName,
                                        List<Map<String, Object>> exercises,
                                        Integer conditionScore, String feedback,
                                        List<String> missions, String trainerCode,
                                        Integer sessionNumber) {
        StringBuilder sb = new StringBuilder();
        if (sessionNumber != null && sessionNumber > 0) {
            sb.append("[핏로그] ").append(memberName).append("님 ")
              .append(sessionNumber).append("회차 수업 완료\n");
        } else {
            sb.append("[핏로그] ").append(memberName).append("님 오늘 PT 기록\n");
        }
        sb.append("──────────────\n");

        // 컨디션
        if (conditionScore != null) {
            String condLabel = switch (conditionScore) {
                case 4 -> "최상 😄";
                case 3 -> "좋음 🙂";
                case 2 -> "보통 😐";
                case 1 -> "나쁨 😓";
                default -> String.valueOf(conditionScore);
            };
            sb.append("컨디션: ").append(condLabel).append("\n\n");
        }

        // 운동 목록
        if (exercises == null || exercises.isEmpty()) {
            sb.append("오늘의 운동\n");
        } else {
            for (Map<String, Object> ex : exercises) {
                String name = String.valueOf(ex.getOrDefault("name", "운동"));
                if (name.isBlank()) continue;

                List<Map<String, Object>> sets = Collections.emptyList();
                if (ex.get("sets") instanceof List<?> rawSets) {
                    sets = rawSets.stream()
                            .filter(s -> s instanceof Map)
                            .map(s -> (Map<String, Object>) s)
                            .collect(java.util.stream.Collectors.toList());
                }

                // 운동명 + 세트 수 (공백 하나)
                sb.append(name);
                if (!sets.isEmpty()) sb.append(" ").append(sets.size()).append("세트");
                sb.append("\n");

                for (Map<String, Object> set : sets) {
                    int setNum = toInt(set.get("setNumber"));
                    double weight = toDouble(set.get("weight"));
                    int reps = toInt(set.get("reps"));
                    String weightStr = weight == 0 ? "맨몸" : formatWeight(weight) + "kg";
                    sb.append(setNum).append("세트 ")
                      .append(weightStr).append(" × ").append(reps).append("회\n");
                }

                // 운동별 메모
                String memo = ex.containsKey("memo") && ex.get("memo") != null
                        ? ex.get("memo").toString().trim() : "";
                if (!memo.isBlank()) {
                    sb.append("메모: ").append(memo).append("\n");
                }
                sb.append("\n");
            }
        }

        // 피드백
        if (feedback != null && !feedback.isBlank()) {
            sb.append("──────────────\n");
            sb.append("피드백: ").append(feedback).append("\n");
        }

        // 챌린지 미션
        if (missions != null && !missions.isEmpty()) {
            if (feedback == null || feedback.isBlank()) sb.append("──────────────\n");
            sb.append("\n다음 수업 전까지:\n");
            for (String m : missions) {
                if (m != null && !m.isBlank()) sb.append("• ").append(m).append("\n");
            }
        }

        sb.append("\n트레이너: ").append(trainerName);

        // 앱 설치 안내
        sb.append("\n\n──────────────\n");
        sb.append("자세한 세트 무게 횟수와 피드백은\n핏로그 앱에서 확인할 수 있어요 📱\n\n");
        if (trainerCode != null && !trainerCode.isBlank()) {
            sb.append("트레이너 코드: ").append(trainerCode).append("\n");
        }
        // 트레이너 코드가 있으면 링크에 박아주기
        String installLink = (trainerCode != null && !trainerCode.isBlank())
                ? appDownloadLink + "?code=" + trainerCode
                : appDownloadLink;
        sb.append("앱 설치: ").append(installLink);

        return sb.toString();
    }

    /** 하위 호환용 (조건 없는 기본 포맷) */
    @SuppressWarnings("unchecked")
    private String buildFullWorkoutText(String memberName, String trainerName,
                                        List<Map<String, Object>> exercises) {
        return buildFullWorkoutText(memberName, trainerName, exercises, null, null, Collections.emptyList(), null, null);
    }

    private int toInt(Object o) {
        if (o instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(o)); } catch (Exception e) { return 0; }
    }

    private double toDouble(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(o)); } catch (Exception e) { return 0; }
    }

    private String formatWeight(double w) {
        return w == Math.floor(w) ? String.valueOf((int) w) : String.valueOf(w);
    }
}
