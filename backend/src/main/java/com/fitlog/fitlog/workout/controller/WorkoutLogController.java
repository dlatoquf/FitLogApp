package com.fitlog.fitlog.workout.controller;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.entity.WorkoutLog;
import com.fitlog.fitlog.workout.entity.WorkoutMedia;
import com.fitlog.fitlog.workout.entity.WorkoutSet;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import com.fitlog.fitlog.workout.repository.WorkoutMediaRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.util.Optional;

@RestController
@RequestMapping("/api/fitlog")
public class WorkoutLogController {

    private final WorkoutLogRepository workoutLogRepository;
    private final WorkoutMediaRepository workoutMediaRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;
    private final ScheduleRepository scheduleRepository;

    public WorkoutLogController(WorkoutLogRepository workoutLogRepository,
                                WorkoutMediaRepository workoutMediaRepository,
                                MemberRepository memberRepository,
                                TrainerRepository trainerRepository,
                                UserRepository userRepository,
                                JwtService jwtService,
                                NotificationService notificationService,
                                ScheduleRepository scheduleRepository){
        this.workoutLogRepository = workoutLogRepository;
        this.workoutMediaRepository = workoutMediaRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
        this.scheduleRepository = scheduleRepository;
    }

    // ── 트레이너: 회원 운동로그 저장 + 알림 ──────────────────────────────
    @Transactional
    @PostMapping
    public ResponseEntity<Map<String, Object>> saveWorkoutLog(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {

        User trainerUser = getUserFromToken(authorization);
        Trainer trainer  = trainerRepository.findByUser(trainerUser)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        Long memberId = ((Number) body.get("memberId")).longValue();
        Member member = memberRepository.findByIdWithUser(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        WorkoutLog log = buildLog(body, member, trainer, "PT");
        workoutLogRepository.save(log);
        saveMediaFiles(body, log);

        // 운동 저장 후 COMPLETED 처리 + 스케줄 없는 경우 PT 차감
        boolean scheduleFound = false;

        if (body.containsKey("scheduleId") && body.get("scheduleId") != null) {
            Long scheduleId = ((Number) body.get("scheduleId")).longValue();
            Optional<com.fitlog.fitlog.schedule.entity.Schedule> scheduleOpt = scheduleRepository.findById(scheduleId);
            if (scheduleOpt.isPresent()) {
                scheduleOpt.get().setStatusStr("COMPLETED");
                scheduleRepository.save(scheduleOpt.get());
                scheduleFound = true;
            }
        } else {
            // scheduleId 없으면 로그 날짜 + 해당 회원 CONFIRMED 스케줄 자동 완료 처리
            LocalDate logDate = log.getLogDate();
            Optional<com.fitlog.fitlog.schedule.entity.Schedule> matchedSchedule =
                scheduleRepository.findByTrainerAndDateAndStatus(trainer, logDate, "CONFIRMED")
                    .stream()
                    .filter(s -> s.getMember() != null && s.getMember().getId().equals(member.getId()))
                    .findFirst();

            if (matchedSchedule.isPresent()) {
                matchedSchedule.get().setStatusStr("COMPLETED");
                scheduleRepository.save(matchedSchedule.get());
                scheduleFound = true;
            }
        }

        // 스케줄 없이 직접 등록한 경우 PT 차감
        String notiContent;
        if (!scheduleFound && member.getPtRemaining() != null && member.getPtRemaining() > 0) {
            member.setPtRemaining(member.getPtRemaining() - 1);
            memberRepository.save(member);
            notiContent = trainerUser.getName() + " 트레이너가 " + log.getLogDate() + " 운동 로그를 등록했어요. PT 1회 차감 · 잔여 " + member.getPtRemaining() + "회";
        } else {
            notiContent = trainerUser.getName() + " 트레이너가 " + log.getLogDate() + " 운동 로그를 등록했어요!";
        }

        // FCM 푸시 + 인앱 알림
        notificationService.sendNotification(
                member.getUser(),
                "WORKOUT_LOG",
                notiContent,
                "WORKOUT_LOG",
                log.getWorkoutId()
        );

        return ResponseEntity.ok(Map.of("message", "운동 로그가 저장됐어요.", "workoutId", log.getWorkoutId()));
    }

    // ── 회원: 개인 운동 저장 ─────────────────────────────────────────────
    @PostMapping("/personal")
    public ResponseEntity<Map<String, Object>> savePersonalLog(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {

        // 1번 조회로 줄임
        Member member = getMemberFromToken(authorization);
        WorkoutLog log = buildLog(body, member, null, "PERSONAL");
        workoutLogRepository.save(log);
        return ResponseEntity.ok(Map.of("message", "개인 운동 로그가 저장됐어요.", "workoutId", log.getWorkoutId()));
    }

    // ── 트레이너: 회원 운동로그 조회 ─────────────────────────────────────
    @GetMapping("/member/{id}")
    public ResponseEntity<List<Map<String, Object>>> getMemberWorkoutLogs(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        System.out.println("🔥 getMemberWorkoutLogs 호출 id=" + id + ", from=" + from + ", to=" + to);

        getUserFromToken(authorization);
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusWeeks(4);
        LocalDate toDate   = to   != null ? LocalDate.parse(to)   : LocalDate.now();

        System.out.println("🔥 workoutLogRepository 조회 직전");

        return ResponseEntity.ok(toResponse(workoutLogRepository.findByMemberAndDateBetween(member, fromDate, toDate)));
    }

    // ── 회원: 내 운동로그 조회 ────────────────────────────────────────────
    @GetMapping("/me")
    public ResponseEntity<List<Map<String, Object>>> getMyWorkoutLogs(
            @RequestHeader("Authorization") String authorization,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        // 1번 조회로 줄임
        Member member = getMemberFromToken(authorization);
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusWeeks(4);
        LocalDate toDate   = to   != null ? LocalDate.parse(to)   : LocalDate.now();
        return ResponseEntity.ok(toResponse(workoutLogRepository.findByMemberAndDateBetween(member, fromDate, toDate)));
    }

    // ── 공통: 운동로그 생성 헬퍼 ─────────────────────────────────────────
    private WorkoutLog buildLog(Map<String, Object> body, Member member, Trainer trainer, String type) {
        WorkoutLog log = new WorkoutLog();
        log.setMember(member);
        log.setTrainer(trainer);
        log.setLogDate(LocalDate.parse((String) body.get("date")));
        log.setWorkoutType(type);
        if (body.containsKey("scheduleId") && body.get("scheduleId") != null) {
            log.setScheduleId(((Number) body.get("scheduleId")).longValue());
        }
        if (body.containsKey("conditionScore") && body.get("conditionScore") != null)
            log.setConditionScore(((Number) body.get("conditionScore")).intValue());
        if (body.containsKey("painPoints"))
            log.setPainPoints((String) body.get("painPoints"));
        if (body.containsKey("feedback"))
            log.setFeedback((String) body.get("feedback"));

        List<Map<String, Object>> exercises = (List<Map<String, Object>>) body.get("exercises");
        List<WorkoutSet> sets = new ArrayList<>();
        if (exercises != null) {
            for (Map<String, Object> ex : exercises) {
                String name = (String) ex.get("name");
                String exMemo = ex.containsKey("memo") ? (String) ex.get("memo") : null;
                List<Map<String, Object>> exSets = (List<Map<String, Object>>) ex.get("sets");
                if (exSets != null) {
                    for (Map<String, Object> s : exSets) {
                        WorkoutSet ws = new WorkoutSet();
                        ws.setWorkoutLog(log);
                        ws.setExerciseName(name);
                        if (s.get("weight") != null) ws.setWeight(new BigDecimal(s.get("weight").toString()));
                        if (s.get("reps")   != null) ws.setReps(((Number) s.get("reps")).intValue());
                        if (s.get("rpe")    != null) ws.setRpe(((Number) s.get("rpe")).intValue());
                        ws.setMemo(exMemo);
                        sets.add(ws);
                    }
                }
            }
        }
        log.setSets(sets);
        return log;
    }

    // ── 공통: 응답 변환 ───────────────────────────────────────────────────
    private List<Map<String, Object>> toResponse(List<WorkoutLog> logs) {
        return logs.stream()
                .sorted(Comparator.comparing(WorkoutLog::getLogDate))
                .map(log -> {
                    Map<String, List<WorkoutSet>> byExercise = new LinkedHashMap<>();

                    for (WorkoutSet ws : log.getSets()) {
                        byExercise
                                .computeIfAbsent(ws.getExerciseName(), k -> new ArrayList<>())
                                .add(ws);
                    }

                    // 운동별 미디어 맵: exerciseName → media
                    List<com.fitlog.fitlog.workout.entity.WorkoutMedia> allMedia =
                            workoutMediaRepository.findByWorkoutLogWorkoutId(log.getWorkoutId());
                    Map<String, com.fitlog.fitlog.workout.entity.WorkoutMedia> mediaByExercise = new HashMap<>();
                    List<Map<String, Object>> logLevelMedia = new ArrayList<>();
                    for (com.fitlog.fitlog.workout.entity.WorkoutMedia m : allMedia) {
                        if (m.getExerciseName() != null) {
                            mediaByExercise.put(m.getExerciseName(), m);
                        } else {
                            Map<String, Object> mm = new HashMap<>();
                            mm.put("id", m.getId()); mm.put("url", m.getUrl());
                            mm.put("publicId", m.getPublicId()); mm.put("mediaType", m.getMediaType());
                            logLevelMedia.add(mm);
                        }
                    }

                    List<Map<String, Object>> exercises = byExercise.entrySet().stream()
                            .map(ex -> {
                                Map<String, Object> exMap = new HashMap<>();
                                exMap.put("name", ex.getKey());
                                String firstMemo = ex.getValue().stream()
                                        .map(WorkoutSet::getMemo)
                                        .filter(Objects::nonNull)
                                        .findFirst()
                                        .orElse(null);
                                exMap.put("memo", firstMemo);

                                exMap.put("sets", ex.getValue().stream().map(s -> {
                                    Map<String, Object> sm = new HashMap<>();
                                    sm.put("setId", s.getSetId());
                                    sm.put("weight", s.getWeight());
                                    sm.put("reps", s.getReps());
                                    sm.put("rpe", s.getRpe());
                                    return sm;
                                }).collect(Collectors.toList()));

                                // 운동별 미디어
                                com.fitlog.fitlog.workout.entity.WorkoutMedia exMedia = mediaByExercise.get(ex.getKey());
                                if (exMedia != null) {
                                    Map<String, Object> mm = new HashMap<>();
                                    mm.put("id", exMedia.getId()); mm.put("url", exMedia.getUrl());
                                    mm.put("publicId", exMedia.getPublicId()); mm.put("mediaType", exMedia.getMediaType());
                                    exMap.put("media", mm);
                                } else {
                                    exMap.put("media", null);
                                }

                                return exMap;
                            })
                            .collect(Collectors.toList());

                    Map<String, Object> map = new HashMap<>();
                    map.put("workoutId", log.getWorkoutId());
                    map.put("date", log.getLogDate().toString());
                    map.put("workoutType", log.getWorkoutType());
                    map.put("conditionScore", log.getConditionScore());
                    map.put("painPoints", log.getPainPoints());
                    map.put("feedback", log.getFeedback());
                    map.put("exercises", exercises);
                    map.put("mediaList", logLevelMedia);

                    return map;
                })
                .collect(Collectors.toList());
    }

    // ── 미디어 저장 헬퍼 (운동별 1개) ─────────────────────────────────────
    @SuppressWarnings("unchecked")
    private void saveMediaFiles(Map<String, Object> body, WorkoutLog log) {
        List<Map<String, Object>> exercises = (List<Map<String, Object>>) body.get("exercises");
        if (exercises != null) {
            for (Map<String, Object> ex : exercises) {
                if (!ex.containsKey("mediaUrl") || ex.get("mediaUrl") == null) continue;
                Map<String, Object> m = (Map<String, Object>) ex.get("mediaUrl");
                String url = (String) m.get("url");
                if (url == null || url.isEmpty()) continue;
                WorkoutMedia media = new WorkoutMedia();
                media.setWorkoutLog(log);
                media.setUrl(url);
                media.setPublicId((String) m.getOrDefault("publicId", ""));
                media.setMediaType(((String) m.getOrDefault("mediaType", "IMAGE")).toUpperCase());
                media.setExerciseName((String) ex.get("name"));
                workoutMediaRepository.save(media);
            }
        }
    }

    //  회원용: JWT → userId → member 한 번에
    private Member getMemberFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        return memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));
    }

    // 트레이너용
    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }

    // WorkoutLogController.java 안에 추가
    // 위치: getMyWorkoutLogs 메서드 아래, buildLog 메서드 위 추천

    @Transactional
    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateWorkoutLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        User user = getUserFromToken(authorization);

        WorkoutLog log = workoutLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("운동 기록을 찾을 수 없습니다."));

        boolean isMemberOwner =
                log.getMember() != null &&
                        log.getMember().getUser() != null &&
                        log.getMember().getUser().getId().equals(user.getId());

        boolean isTrainerOwner = false;
        Optional<Trainer> trainerOpt = trainerRepository.findByUser(user);

        if (trainerOpt.isPresent()) {
            Trainer trainer = trainerOpt.get();
            isTrainerOwner =
                    log.getTrainer() != null &&
                            log.getTrainer().getId().equals(trainer.getId());
        }

        if (!isMemberOwner && !isTrainerOwner) {
            throw new RuntimeException("수정 권한이 없습니다.");
        }

        if (body.get("date") != null) {
            log.setLogDate(LocalDate.parse((String) body.get("date")));
        }
        if (body.containsKey("conditionScore") && body.get("conditionScore") != null)
            log.setConditionScore(((Number) body.get("conditionScore")).intValue());
        if (body.containsKey("painPoints"))
            log.setPainPoints((String) body.get("painPoints"));
        if (body.containsKey("feedback"))
            log.setFeedback((String) body.get("feedback"));

        log.getSets().clear();

        List<Map<String, Object>> exercises =
                (List<Map<String, Object>>) body.get("exercises");

        if (exercises != null) {
            for (Map<String, Object> ex : exercises) {
                String name = (String) ex.get("name");
                String exMemo = ex.containsKey("memo") ? (String) ex.get("memo") : null;
                List<Map<String, Object>> exSets =
                        (List<Map<String, Object>>) ex.get("sets");

                if (exSets != null) {
                    for (Map<String, Object> s : exSets) {
                        WorkoutSet ws = new WorkoutSet();
                        ws.setWorkoutLog(log);
                        ws.setExerciseName(name);

                        if (s.get("weight") != null) {
                            ws.setWeight(new BigDecimal(s.get("weight").toString()));
                        }
                        if (s.get("reps") != null) {
                            ws.setReps(((Number) s.get("reps")).intValue());
                        }
                        if (s.get("rpe") != null) {
                            ws.setRpe(((Number) s.get("rpe")).intValue());
                        }
                        ws.setMemo(exMemo);

                        log.getSets().add(ws);
                    }
                }
            }
        }

        workoutLogRepository.save(log);

        // 미디어 처리: keepMediaIds에 없는 기존 미디어 삭제 + 새 미디어 추가
        List<Long> keepIds = Collections.emptyList();
        if (body.containsKey("keepMediaIds") && body.get("keepMediaIds") != null) {
            keepIds = ((List<?>) body.get("keepMediaIds")).stream()
                    .map(v -> ((Number) v).longValue())
                    .collect(Collectors.toList());
        }

        List<WorkoutMedia> currentMedia = workoutMediaRepository.findByWorkoutLogWorkoutId(log.getWorkoutId());
        final List<Long> finalKeepIds = keepIds;
        for (WorkoutMedia m : currentMedia) {
            if (!finalKeepIds.contains(m.getId())) {
                workoutMediaRepository.delete(m);
            }
        }

        saveMediaFiles(body, log);

        return ResponseEntity.ok(Map.of(
                "message", "운동 로그가 수정됐어요.",
                "workoutId", log.getWorkoutId()
        ));
    }

}