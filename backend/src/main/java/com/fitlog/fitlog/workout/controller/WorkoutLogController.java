package com.fitlog.fitlog.workout.controller;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.entity.Notification;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.entity.WorkoutLog;
import com.fitlog.fitlog.workout.entity.WorkoutSet;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/fitlog")
public class WorkoutLogController {

    private final WorkoutLogRepository workoutLogRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final NotificationRepository notificationRepository;
    private final ScheduleRepository scheduleRepository;

    public WorkoutLogController(WorkoutLogRepository workoutLogRepository,
                                MemberRepository memberRepository,
                                TrainerRepository trainerRepository,
                                UserRepository userRepository,
                                JwtService jwtService,
                                NotificationRepository notificationRepository,
                                ScheduleRepository scheduleRepository){
        this.workoutLogRepository = workoutLogRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.notificationRepository = notificationRepository;
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

        // 운동 저장 후 COMPLETED 처리
        // scheduleId가 있으면 그걸로, 없으면 오늘 날짜 + 해당 회원의 CONFIRMED 스케줄 자동 탐색
        if (body.containsKey("scheduleId") && body.get("scheduleId") != null) {
            Long scheduleId = ((Number) body.get("scheduleId")).longValue();
            scheduleRepository.findById(scheduleId).ifPresent(schedule -> {
                schedule.setStatusStr("COMPLETED");
                scheduleRepository.save(schedule);
            });
        } else {
            // scheduleId 없으면 오늘 날짜 + 해당 회원 CONFIRMED 스케줄 자동 완료 처리
            LocalDate logDate = log.getLogDate();
            scheduleRepository.findByTrainerAndDateAndStatus(trainer, logDate, "CONFIRMED")
                    .stream()
                    .filter(s -> s.getMember() != null && s.getMember().getId().equals(member.getId()))
                    .findFirst()
                    .ifPresent(schedule -> {
                        schedule.setStatusStr("COMPLETED");
                        scheduleRepository.save(schedule);
                    });
        }

        // 알림 저장
        Notification noti = new Notification();
        noti.setUser(member.getUser());
        noti.setType("WORKOUT_LOG");
        noti.setContent(trainerUser.getName() + " 트레이너가 " + log.getLogDate() + " 운동 로그를 등록했어요!");
        noti.setTargetType("WORKOUT_LOG");
        noti.setTargetId(log.getWorkoutId());
        notificationRepository.save(noti);

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

        List<Map<String, Object>> exercises = (List<Map<String, Object>>) body.get("exercises");
        List<WorkoutSet> sets = new ArrayList<>();
        if (exercises != null) {
            for (Map<String, Object> ex : exercises) {
                String name = (String) ex.get("name");
                List<Map<String, Object>> exSets = (List<Map<String, Object>>) ex.get("sets");
                if (exSets != null) {
                    for (Map<String, Object> s : exSets) {
                        WorkoutSet ws = new WorkoutSet();
                        ws.setWorkoutLog(log);
                        ws.setExerciseName(name);
                        if (s.get("weight") != null) ws.setWeight(new BigDecimal(s.get("weight").toString()));
                        if (s.get("reps")   != null) ws.setReps(((Number) s.get("reps")).intValue());
                        if (s.get("rpe")    != null) ws.setRpe(((Number) s.get("rpe")).intValue());
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

                    List<Map<String, Object>> exercises = byExercise.entrySet().stream()
                            .map(ex -> {
                                Map<String, Object> exMap = new HashMap<>();
                                exMap.put("name", ex.getKey());

                                exMap.put("sets", ex.getValue().stream().map(s -> {
                                    Map<String, Object> sm = new HashMap<>();
                                    sm.put("setId", s.getSetId());
                                    sm.put("weight", s.getWeight());
                                    sm.put("reps", s.getReps());
                                    sm.put("rpe", s.getRpe());
                                    return sm;
                                }).collect(Collectors.toList()));

                                return exMap;
                            })
                            .collect(Collectors.toList());

                    Map<String, Object> map = new HashMap<>();
                    map.put("workoutId", log.getWorkoutId());
                    map.put("date", log.getLogDate().toString());
                    map.put("workoutType", log.getWorkoutType());
                    map.put("conditionScore", log.getConditionScore());
                    map.put("painPoints", log.getPainPoints());
                    map.put("exercises", exercises);

                    return map;
                })
                .collect(Collectors.toList());
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

        User trainerUser = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(trainerUser)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        WorkoutLog log = workoutLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("운동 기록을 찾을 수 없습니다."));

        if (log.getTrainer() == null || !log.getTrainer().getId().equals(trainer.getId())) {
            throw new RuntimeException("수정 권한이 없습니다.");
        }

        if (body.get("date") != null) {
            log.setLogDate(LocalDate.parse((String) body.get("date")));
        }

        // 기존 세트 전체 삭제 후 다시 저장
        log.getSets().clear();

        List<Map<String, Object>> exercises = (List<Map<String, Object>>) body.get("exercises");
        if (exercises != null) {
            for (Map<String, Object> ex : exercises) {
                String name = (String) ex.get("name");
                List<Map<String, Object>> exSets = (List<Map<String, Object>>) ex.get("sets");

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

                        log.getSets().add(ws);
                    }
                }
            }
        }

        workoutLogRepository.save(log);

        return ResponseEntity.ok(Map.of(
                "message", "운동 로그가 수정됐어요.",
                "workoutId", log.getWorkoutId()
        ));
    }

}