package com.fitlog.fitlog.workout.controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.mission.service.MissionService;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.notification.service.SolapiService;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.entity.WorkoutLog;
import com.fitlog.fitlog.workout.entity.WorkoutMedia;
import com.fitlog.fitlog.workout.entity.WorkoutSet;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import com.fitlog.fitlog.workout.repository.WorkoutMediaRepository;

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
    private final ManualMemberRepository manualMemberRepository;
    private final SolapiService solapiService;
    private final MissionService missionService;

    public WorkoutLogController(WorkoutLogRepository workoutLogRepository,
                                WorkoutMediaRepository workoutMediaRepository,
                                MemberRepository memberRepository,
                                TrainerRepository trainerRepository,
                                UserRepository userRepository,
                                JwtService jwtService,
                                NotificationService notificationService,
                                ScheduleRepository scheduleRepository,
                                ManualMemberRepository manualMemberRepository,
                                SolapiService solapiService,
                                MissionService missionService){
        this.workoutLogRepository = workoutLogRepository;
        this.workoutMediaRepository = workoutMediaRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
        this.scheduleRepository = scheduleRepository;
        this.manualMemberRepository = manualMemberRepository;
        this.solapiService = solapiService;
        this.missionService = missionService;
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

        // 피드백 필드 처리
        WorkoutLog log = buildLog(body, member, trainer, "PT");
        if (body.containsKey("feedback")) log.setFeedback((String) body.get("feedback"));
        workoutLogRepository.save(log);
        saveMediaFiles(body, log);

        // 새 수업 등록 시 이전 PENDING 미션 → FAILED 처리
        missionService.failPendingMissions(member.getId());

        // 미션 저장
        List<String> missions = body.containsKey("missions")
                ? (List<String>) body.get("missions") : null;
        missionService.createMissions(log.getWorkoutId(), missions, trainer, member);

        // 운동일지 등록 시 CONFIRMED 상태인 스케줄만 COMPLETED + PT -1 처리
        boolean scheduleFound = false;

        if (body.containsKey("scheduleId") && body.get("scheduleId") != null) {
            Long scheduleId = ((Number) body.get("scheduleId")).longValue();
            Optional<com.fitlog.fitlog.schedule.entity.Schedule> scheduleOpt = scheduleRepository.findById(scheduleId);
            if (scheduleOpt.isPresent()) {
                com.fitlog.fitlog.schedule.entity.Schedule sch = scheduleOpt.get();
                boolean wasConfirmed = "CONFIRMED".equals(sch.getStatusStr());
                sch.setStatusStr("COMPLETED");
                scheduleRepository.save(sch);
                scheduleFound = true;
                if (wasConfirmed && member.getPtRemaining() != null && member.getPtRemaining() > 0) {
                    int newRemaining = member.getPtRemaining() - 1;
                    member.setPtRemaining(newRemaining);
                    if (newRemaining == 0) member.setPtEndedAt(java.time.LocalDate.now());
                    memberRepository.save(member);
                }
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
                if (member.getPtRemaining() != null && member.getPtRemaining() > 0) {
                    int newRemaining = member.getPtRemaining() - 1;
                    member.setPtRemaining(newRemaining);
                    if (newRemaining == 0) member.setPtEndedAt(java.time.LocalDate.now());
                    memberRepository.save(member);
                }
            }
        }

        String ptStr = member.getPtRemaining() != null ? " 잔여 PT " + member.getPtRemaining() + "회" : "";
        String notiContent = trainerUser.getName() + " 트레이너가 " + log.getLogDate() + " PT 운동 로그를 등록했어요." + ptStr;


        // FCM 푸시 + 인앱 알림
        if (member.getNotifWorkout()) {
            notificationService.sendNotification(
                    member.getUser(),
                    "WORKOUT_LOG",
                    notiContent,
                    "WORKOUT_LOG",
                    log.getWorkoutId(),
                    log.getLogDate() != null ? log.getLogDate().toString() : null
            );
        }

        return ResponseEntity.ok(Map.of("message", "운동 로그가 저장됐어요.", "workoutId", log.getWorkoutId()));
    }

    // ── 트레이너: 미연동 회원 운동 로그 저장 ────────────────────────────────
    @Transactional
    @PostMapping("/manual/{manualMemberId}")
    public ResponseEntity<Map<String, Object>> saveManualMemberLog(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId,
            @RequestBody Map<String, Object> body) {

        User trainerUser = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(trainerUser)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        ManualMember mm = manualMemberRepository.findById(manualMemberId)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));

        WorkoutLog log = new WorkoutLog();
        log.setManualMember(mm);
        log.setMember(null);
        log.setTrainer(trainer);
        java.time.LocalDate logDate = java.time.LocalDate.parse((String) body.get("date"));
        log.setLogDate(logDate);

        // 해당 날짜 CONFIRMED 스케줄의 session_type으로 workout_type 결정
        // 스케줄이 없으면 회원 메모로 판단
        String workoutType = scheduleRepository
                .findByTrainerAndDateAndStatus(trainer, logDate, "CONFIRMED")
                .stream()
                .filter(s -> s.getManualMember() != null && s.getManualMember().getId().equals(mm.getId()))
                .findFirst()
                .map(s -> s.getSessionType() != null ? s.getSessionType() : "PT")
                .orElse("OT".equalsIgnoreCase(mm.getMemo() != null ? mm.getMemo() : "") ? "OT" : "PT");
        log.setWorkoutType(workoutType);
        if (body.containsKey("conditionScore") && body.get("conditionScore") != null)
            log.setConditionScore(((Number) body.get("conditionScore")).intValue());
        if (body.containsKey("painPoints"))
            log.setPainPoints((String) body.get("painPoints"));
        if (body.containsKey("feedback"))
            log.setFeedback((String) body.get("feedback"));

        // 운동 세트 파싱
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
                        if (s.get("weight") != null) ws.setWeight(new java.math.BigDecimal(s.get("weight").toString()));
                        if (s.get("reps") != null) ws.setReps(((Number) s.get("reps")).intValue());
                        if (s.get("rpe") != null) ws.setRpe(((Number) s.get("rpe")).intValue());
                        ws.setMemo(exMemo);
                        sets.add(ws);
                    }
                }
            }
        }
        log.setSets(sets);
        workoutLogRepository.save(log);
        saveMediaFiles(body, log);

        // 해당 날짜 CONFIRMED 스케줄 → COMPLETED 처리 + PT -1
        scheduleRepository.findByTrainerAndDateAndStatus(trainer, log.getLogDate(), "CONFIRMED")
                .stream()
                .filter(s -> s.getManualMember() != null && s.getManualMember().getId().equals(mm.getId()))
                .findFirst()
                .ifPresent(s -> {
                    s.setStatusStr("COMPLETED");
                    scheduleRepository.save(s);
                    if (mm.getPtRemaining() != null && mm.getPtRemaining() > 0) {
                        int newRemaining = mm.getPtRemaining() - 1;
                        mm.setPtRemaining(newRemaining);
                        if (newRemaining == 0) mm.setPtEndedAt(java.time.LocalDate.now());
                        manualMemberRepository.save(mm);
                    }
                });

        // 미션 저장
        List<String> missions = body.containsKey("missions")
                ? (List<String>) body.get("missions") : null;
        missionService.createMissionsForManual(log.getWorkoutId(), missions, trainer, mm);

        return ResponseEntity.ok(Map.of(
                "message", "운동 로그가 저장됐어요.",
                "workoutId", log.getWorkoutId(),
                // 전화번호 있으면 프론트에서 알림 버튼 표시
                "hasPhone", mm.getPhone() != null && !mm.getPhone().isBlank()
        ));
    }

    // ── 트레이너: 미연동 회원에게 카카오 알림톡 / LMS 수동 발송 ─────────────
    // POST /api/fitlog/manual/{manualMemberId}/notify
    @Transactional
    @PostMapping("/manual/{manualMemberId}/notify")
    public ResponseEntity<Map<String, Object>> notifyManualMember(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId,
            @RequestBody Map<String, Object> body) {

        User trainerUser = getUserFromToken(authorization);

        ManualMember mm = manualMemberRepository.findById(manualMemberId)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));

        if (mm.getPhone() == null || mm.getPhone().isBlank()) {
            return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "전화번호가 없어 알림을 보낼 수 없어요.")
            );
        }

        // 전체 운동 데이터 파싱: [{name, memo, sets:[{setNumber,weight,reps}]}]
        List<Map<String, Object>> exercises = Collections.emptyList();
        if (body.containsKey("exercises") && body.get("exercises") instanceof List<?> rawList) {
            exercises = rawList.stream()
                    .filter(e -> e instanceof Map)
                    .map(e -> (Map<String, Object>) e)
                    .collect(java.util.stream.Collectors.toList());
        }
        // 하위 호환: exerciseNames만 있을 때
        if (exercises.isEmpty() && body.containsKey("exerciseNames")) {
            List<String> names = ((List<?>) body.get("exerciseNames")).stream()
                    .map(Object::toString).collect(java.util.stream.Collectors.toList());
            exercises = names.stream()
                    .map(n -> (Map<String, Object>) new HashMap<String, Object>(Map.of("name", n)))
                    .collect(java.util.stream.Collectors.toList());
        }

        // 컨디션 / 피드백 / 미션
        Integer conditionScore = null;
        if (body.containsKey("conditionScore") && body.get("conditionScore") != null) {
            conditionScore = ((Number) body.get("conditionScore")).intValue();
        }
        String feedback = body.containsKey("feedback") && body.get("feedback") != null
                ? (String) body.get("feedback") : null;
        List<String> missions = Collections.emptyList();
        if (body.containsKey("missions") && body.get("missions") instanceof List<?> ml) {
            missions = ml.stream().filter(m -> m != null).map(Object::toString)
                    .collect(java.util.stream.Collectors.toList());
        }

        // 트레이너 코드 조회
        String trainerCode = trainerRepository.findByUser(trainerUser)
                .map(t -> t.getTrainerCode())
                .orElse(null);

        // PT 회차 계산 (총 횟수 - 잔여 횟수)
        Integer sessionNumber = null;
        if (mm.getPtTotal() != null && mm.getPtRemaining() != null) {
            int used = mm.getPtTotal() - mm.getPtRemaining();
            if (used > 0) sessionNumber = used;
        }

        boolean isOt = "OT".equalsIgnoreCase(mm.getMemo() != null ? mm.getMemo() : "");
        if (isOt) {
            solapiService.sendOtWorkoutComplete(
                    mm.getName(),
                    mm.getPhone(),
                    trainerUser.getName(),
                    exercises
            );
        } else {
            solapiService.sendWorkoutLogNotice(
                    mm.getName(),
                    mm.getPhone(),
                    exercises,
                    trainerUser.getName(),
                    conditionScore,
                    feedback,
                    missions,
                    trainerCode,
                    sessionNumber
            );
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "알림을 발송했어요."));
    }

    // ── 트레이너: 미연동 회원 운동 로그 조회 ────────────────────────────────
    @GetMapping("/manual/{manualMemberId}")
    public ResponseEntity<List<Map<String, Object>>> getManualMemberLogs(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long manualMemberId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {

        getUserFromToken(authorization);
        ManualMember mm = manualMemberRepository.findById(manualMemberId)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));
        java.time.LocalDate fromDate = from != null ? java.time.LocalDate.parse(from) : java.time.LocalDate.now().minusWeeks(4);
        java.time.LocalDate toDate   = to   != null ? java.time.LocalDate.parse(to)   : java.time.LocalDate.now();

        return ResponseEntity.ok(toResponse(workoutLogRepository.findByManualMemberAndDateBetween(mm, fromDate, toDate)));
    }

    // ── 회원: 개인 운동 저장 ─────────────────────────────────────────────
    @Transactional
    @PostMapping("/personal")
    public ResponseEntity<Map<String, Object>> savePersonalLog(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {

        // 1번 조회로 줄임
        Member member = getMemberFromToken(authorization);
        WorkoutLog log = buildLog(body, member, null, "PERSONAL");
        workoutLogRepository.save(log);
        saveMediaFiles(body, log);

        Trainer trainer = member.getTrainer();
        if (trainer != null && trainer.getUser() != null && trainer.getNotifPersonalWorkout()) {
            String memberName = member.getUser() != null ? member.getUser().getName() : "회원";
            String notiContent = memberName + " 회원이 " + log.getLogDate() + " 개인 운동 로그를 등록했어요.";
            notificationService.sendNotification(
                    trainer.getUser(),
                    "WORKOUT_LOG",
                    notiContent,
                    "WORKOUT_LOG",
                    member.getId(),
                    log.getLogDate() != null ? log.getLogDate().toString() : null
            );
        }

        return ResponseEntity.ok(Map.of("message", "개인 운동 로그가 저장됐어요.", "workoutId", log.getWorkoutId()));
    }

    // ── 트레이너: 개인 운동에 피드백 달기 ──────────────────────────────────
    @Transactional
    @PutMapping("/{workoutId}/feedback")
    public ResponseEntity<Map<String, Object>> updateFeedback(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long workoutId,
            @RequestBody Map<String, String> body) {

        User trainerUser = getUserFromToken(authorization);
        Trainer trainer = trainerRepository.findByUser(trainerUser)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        WorkoutLog log = workoutLogRepository.findById(workoutId)
                .orElseThrow(() -> new RuntimeException("운동 기록을 찾을 수 없습니다."));

        String feedback = body.get("feedback");
        log.setFeedback(feedback);
        if (log.getTrainer() == null) log.setTrainer(trainer);
        workoutLogRepository.save(log);

        // 회원에게 알림
        if (feedback != null && !feedback.isBlank() && log.getMember() != null && log.getMember().getNotifFeedback()) {
            notificationService.sendNotification(
                log.getMember().getUser(),
                "FEEDBACK",
                trainer.getUser().getName() + " 트레이너가 운동 피드백을 남겼어요.",
                "WORKOUT_LOG",
                log.getWorkoutId(),
                log.getLogDate() != null ? log.getLogDate().toString() : null
            );
        }

        return ResponseEntity.ok(Map.of("message", "피드백이 저장됐어요."));
    }

    // ── 트레이너: 회원 운동로그 조회 ─────────────────────────────────────
    @GetMapping("/member/{id}")
    public ResponseEntity<List<Map<String, Object>>> getMemberWorkoutLogs(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {


        getUserFromToken(authorization);
        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        LocalDate fromDate = from != null ? LocalDate.parse(from) : LocalDate.now().minusWeeks(4);
        LocalDate toDate   = to   != null ? LocalDate.parse(to)   : LocalDate.now();


        return ResponseEntity.ok(toResponse(workoutLogRepository.findByMemberAndDateBetween(member, fromDate, toDate)));
    }

    // ── 회원: 내 운동로그 조회 ────────────────────────────────────────────
    @Transactional(readOnly = true)
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
        workoutLogRepository.saveAndFlush(log); // 기존 세트 orphan 삭제를 즉시 flush

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

                    // 운동별 미디어 맵: exerciseName → mediaList (여러 개 지원)
                    List<com.fitlog.fitlog.workout.entity.WorkoutMedia> allMedia =
                            workoutMediaRepository.findByWorkoutLogWorkoutId(log.getWorkoutId());
                    Map<String, List<Map<String, Object>>> mediaByExercise = new LinkedHashMap<>();
                    List<Map<String, Object>> logLevelMedia = new ArrayList<>();
                    for (com.fitlog.fitlog.workout.entity.WorkoutMedia m : allMedia) {
                        Map<String, Object> mm = new HashMap<>();
                        mm.put("id", m.getId()); mm.put("url", m.getUrl());
                        mm.put("publicId", m.getPublicId()); mm.put("mediaType", m.getMediaType());
                        if (m.getExerciseName() != null) {
                            mediaByExercise.computeIfAbsent(m.getExerciseName(), k -> new ArrayList<>()).add(mm);
                        } else {
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

                                // 운동별 미디어 (여러 개)
                                List<Map<String, Object>> exMediaList = mediaByExercise.getOrDefault(ex.getKey(), new ArrayList<>());
                                exMap.put("mediaList", exMediaList);
                                // 하위 호환: 첫 번째 미디어를 media 단일 필드로도 제공
                                exMap.put("media", exMediaList.isEmpty() ? null : exMediaList.get(0));

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
                    try {
                        map.put("trainerName", log.getTrainer() != null && log.getTrainer().getUser() != null
                                ? log.getTrainer().getUser().getName() : null);
                    } catch (Exception e) {
                        map.put("trainerName", null);
                    }
                    map.put("exercises", exercises);
                    map.put("mediaList", logLevelMedia);

                    return map;
                })
                .collect(Collectors.toList());
    }

    // ── 미디어 저장 헬퍼 (운동별 최대 3개) ─────────────────────────────────
    @SuppressWarnings("unchecked")
    private void saveMediaFiles(Map<String, Object> body, WorkoutLog log) {
        List<Map<String, Object>> exercises = (List<Map<String, Object>>) body.get("exercises");
        if (exercises == null) return;
        for (Map<String, Object> ex : exercises) {
            String exerciseName = (String) ex.get("name");
            // 배열 mediaUrls 우선 처리
            if (ex.containsKey("mediaUrls") && ex.get("mediaUrls") != null) {
                List<Map<String, Object>> mediaUrls = (List<Map<String, Object>>) ex.get("mediaUrls");
                for (Map<String, Object> m : mediaUrls) {
                    String url = (String) m.get("url");
                    if (url == null || url.isEmpty()) continue;
                    WorkoutMedia media = new WorkoutMedia();
                    media.setWorkoutLog(log);
                    media.setUrl(url);
                    media.setPublicId((String) m.getOrDefault("publicId", ""));
                    media.setMediaType(((String) m.getOrDefault("mediaType", "IMAGE")).toUpperCase());
                    media.setExerciseName(exerciseName);
                    workoutMediaRepository.save(media);
                }
            } else if (ex.containsKey("mediaUrl") && ex.get("mediaUrl") != null) {
                // 레거시 단일 mediaUrl 호환
                Map<String, Object> m = (Map<String, Object>) ex.get("mediaUrl");
                String url = (String) m.get("url");
                if (url == null || url.isEmpty()) continue;
                WorkoutMedia media = new WorkoutMedia();
                media.setWorkoutLog(log);
                media.setUrl(url);
                media.setPublicId((String) m.getOrDefault("publicId", ""));
                media.setMediaType(((String) m.getOrDefault("mediaType", "IMAGE")).toUpperCase());
                media.setExerciseName(exerciseName);
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

    // WorkoutLogController.java 안에 추가
    // 위치: getMyWorkoutLogs 메서드 아래, buildLog 메서드 위 추천

    // 트레이너용
    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId  = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }

}
