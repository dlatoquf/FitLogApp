package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.member.dto.MemberResponse;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.diet.repository.DietDayFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietPhotoFeedbackRepository;
import com.fitlog.fitlog.diet.repository.DietPhotoRepository;
import com.fitlog.fitlog.member.repository.MemberGoalRepository;
import com.fitlog.fitlog.mission.repository.MissionRepository;
import com.fitlog.fitlog.notice.repository.TrainerNoticeRepository;
import com.fitlog.fitlog.notification.repository.NotificationRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.service.ScheduleService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.entity.MemberMemo;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.trainer.service.TrainerDeleteService;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class TrainerController {

    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final MemberMemoRepository memberMemoRepository;
    private final ScheduleRepository scheduleRepository;
    private final ScheduleService scheduleService;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final TrainerDeleteService trainerDeleteService;
    private final WorkoutLogRepository workoutLogRepository;
    private final NotificationRepository notificationRepository;
    private final DietDayFeedbackRepository dietDayFeedbackRepository;
    private final DietPhotoFeedbackRepository dietPhotoFeedbackRepository;
    private final DietPhotoRepository dietPhotoRepository;
    private final MissionRepository missionRepository;
    private final TrainerNoticeRepository trainerNoticeRepository;
    private final BodyLogRepository bodyLogRepository;
    private final MemberGoalRepository memberGoalRepository;

    public TrainerController(TrainerRepository trainerRepository,
                             MemberRepository memberRepository,
                             MemberMemoRepository memberMemoRepository,
                             ScheduleRepository scheduleRepository,
                             ScheduleService scheduleService,
                             JwtService jwtService,
                             UserRepository userRepository,
                             TrainerDeleteService trainerDeleteService,
                             WorkoutLogRepository workoutLogRepository,
                             NotificationRepository notificationRepository,
                             DietDayFeedbackRepository dietDayFeedbackRepository,
                             DietPhotoFeedbackRepository dietPhotoFeedbackRepository,
                             DietPhotoRepository dietPhotoRepository,
                             MissionRepository missionRepository,
                             TrainerNoticeRepository trainerNoticeRepository,
                             BodyLogRepository bodyLogRepository,
                             MemberGoalRepository memberGoalRepository) {
        this.trainerRepository = trainerRepository;
        this.memberMemoRepository = memberMemoRepository;
        this.memberRepository = memberRepository;
        this.scheduleRepository = scheduleRepository;
        this.scheduleService = scheduleService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.trainerDeleteService = trainerDeleteService;
        this.workoutLogRepository = workoutLogRepository;
        this.notificationRepository = notificationRepository;
        this.dietDayFeedbackRepository = dietDayFeedbackRepository;
        this.dietPhotoFeedbackRepository = dietPhotoFeedbackRepository;
        this.dietPhotoRepository = dietPhotoRepository;
        this.missionRepository = missionRepository;
        this.trainerNoticeRepository = trainerNoticeRepository;
        this.bodyLogRepository = bodyLogRepository;
        this.memberGoalRepository = memberGoalRepository;
    }

    /*// 트레이너 프로필 조회
    @GetMapping("/profile/trainer")
    public ResponseEntity<Map<String, Object>> getTrainerProfile(
            @RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        Map<String, Object> result = new HashMap<>();
        result.put("id", trainer.getId());
        result.put("name", trainer.getUser().getName());
        result.put("gymName", trainer.getGymName());
        result.put("workDays", trainer.getWorkDays());
        result.put("startTime", trainer.getStartTime());
        result.put("endTime", trainer.getEndTime());
        result.put("trainerCode", trainer.getTrainerCode());
        return ResponseEntity.ok(result);
    }*/

    /*// 트레이너 프로필 수정 + 다음 주 OPEN 슬롯 재생성
    @PutMapping("/profile/trainer")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, Object>> updateTrainerProfile(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        Trainer trainer = getTrainer(authorization);

        if (body.containsKey("gymName"))   trainer.setGymName(body.get("gymName").toString());
        if (body.containsKey("workDays"))  trainer.setWorkDays(body.get("workDays").toString());
        if (body.containsKey("startTime")) trainer.setStartTime(body.get("startTime").toString());
        if (body.containsKey("endTime"))   trainer.setEndTime(body.get("endTime").toString());
        trainerRepository.save(trainer);

        // 다음 주 OPEN 슬롯만 삭제 후 재생성 (확정/신청 슬롯은 유지)
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);
        List<Schedule> nextWeekOpen = scheduleRepository
                .findByTrainerAndDateBetween(trainer, nextMonday, nextSunday)
                .stream()
                .filter(s -> "OPEN".equals(s.getStatusStr()))
                .collect(Collectors.toList());
        if (!nextWeekOpen.isEmpty()) scheduleRepository.deleteAll(nextWeekOpen);
        scheduleService.generateNextWeekSlots(trainer);

        return ResponseEntity.ok(Map.of("message", "프로필이 수정됐어요."));
    }*/

    @GetMapping("/trainer/members")
    public List<MemberResponse> getMyMembers(@RequestHeader("Authorization") String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Long trainerId = trainerRepository.findTrainerIdByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        return memberRepository.findAllMembersByTrainerIdWithUser(trainerId)
                .stream()
                .map(m -> {
                    MemberResponse res = new MemberResponse(m);
                    memberMemoRepository.findTop1ByMemberOrderByCreatedAtDesc(m)
                            .ifPresent(memo -> res.setLatestMemo(memo.getContent()));
                    return res;
                })
                .collect(Collectors.toList());
    }

    // findByIdWithUser 로 변경 (LazyInitializationException 방지)
    @GetMapping("/trainer/members/{id}")
    public MemberResponse getMember(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id
    ) {

        String token = authorization.replace("Bearer ", "");

        Long userId = jwtService.getUserIdFromToken(token);

        Long trainerId = trainerRepository.findTrainerIdByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        Member member = memberRepository
                .findByIdAndTrainerIdWithUser(id, trainerId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        return new MemberResponse(member);
    }

    @GetMapping("/trainer/me")
    public MemberResponse.UserInfo getMyInfo(@RequestHeader("Authorization") String authorization) {

        String token = authorization.replace("Bearer ", "");

        Long userId = jwtService.getUserIdFromToken(token);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));

        return new MemberResponse.UserInfo(
                user.getId(),
                user.getName()
        );
    }

    @PutMapping("/trainer/members/{id}/pt")
    public ResponseEntity<Map<String, Object>> updatePt(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {

        getTrainer(authorization);

        Member member = memberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        if (body.containsKey("ptTotal"))
            member.setPtTotal(body.get("ptTotal") != null ? ((Number) body.get("ptTotal")).intValue() : null);
        if (body.containsKey("ptRemaining")) {
            Integer newRemaining = body.get("ptRemaining") != null
                    ? ((Number) body.get("ptRemaining")).intValue() : null;
            member.setPtRemaining(newRemaining);
            // 잔여가 0이 되면 ptEndedAt 기록, 0보다 크면 초기화 (재등록)
            if (newRemaining != null && newRemaining == 0 && member.getPtEndedAt() == null) {
                member.setPtEndedAt(java.time.LocalDate.now());
            } else if (newRemaining != null && newRemaining > 0) {
                member.setPtEndedAt(null);
            }
        }
        if (body.containsKey("ptStartDate"))
            member.setPtStartDate(body.get("ptStartDate") != null ? body.get("ptStartDate").toString() : null);
        if (body.containsKey("ptExpDate"))
            member.setPtExpDate(body.get("ptExpDate") != null ? body.get("ptExpDate").toString() : null);
        if (body.containsKey("memo"))
            member.setMemo(body.get("memo") != null ? body.get("memo").toString() : null);

        memberRepository.save(member);

        Map<String, Object> result = new HashMap<>();
        result.put("message", "PT 정보가 수정됐어요.");
        result.put("ptTotal", member.getPtTotal());
        result.put("ptRemaining", member.getPtRemaining());
        return ResponseEntity.ok(result);
    }

    // DELETE /api/trainer/me - 트레이너 계정 삭제
    @DeleteMapping("/trainer/me")
    public ResponseEntity<Map<String, Object>> deleteMe(
            @RequestHeader("Authorization") String authorization) {
        trainerDeleteService.deleteTrainerAccount(authorization);
        return ResponseEntity.ok(Map.of("success", true, "message", "계정이 삭제됐어요."));
    }

    // GET /api/trainer/deleted-members — 7일 이내 삭제된 회원 목록 조회
    @GetMapping("/trainer/deleted-members")
    public ResponseEntity<List<Map<String, Object>>> getDeletedMembers(
            @RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        java.time.LocalDateTime since = java.time.LocalDateTime.now().minusDays(7);
        List<Member> deletedMembers = memberRepository.findSoftDeletedMembersByTrainerId(trainer.getId(), since);

        List<Map<String, Object>> result = deletedMembers.stream().map(m -> {
            Map<String, Object> map = new HashMap<>();
            map.put("memberId", m.getId());
            map.put("name", m.getUser().getName());
            map.put("deletedAt", m.getUser().getDeletedAt().toString());
            // 복구 가능 기한 (삭제일 + 7일)
            map.put("restoreDeadline", m.getUser().getDeletedAt().plusDays(7).toString());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }

    // POST /api/trainer/members/{memberId}/restore — 삭제된 회원 복구
    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/trainer/members/{memberId}/restore")
    public ResponseEntity<Map<String, Object>> restoreMember(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId) {
        Trainer trainer = getTrainer(authorization);

        Member member = memberRepository.findByIdAndTrainerIdWithUser(memberId, trainer.getId())
                .orElseThrow(() -> new RuntimeException("해당 회원을 찾을 수 없습니다."));

        if (member.getUser().getDeletedAt() == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "삭제되지 않은 회원입니다."));
        }

        java.time.LocalDateTime deadline = member.getUser().getDeletedAt().plusDays(7);
        if (java.time.LocalDateTime.now().isAfter(deadline)) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "복구 가능 기간(7일)이 지났습니다."));
        }

        member.getUser().setDeletedAt(null);
        userRepository.save(member.getUser());

        return ResponseEntity.ok(Map.of("success", true, "message", member.getUser().getName() + " 회원이 복구됐어요."));
    }

    // PATCH /api/trainer/notif-settings — 알림 설정 저장 (현재는 생일 알림)
    @PatchMapping("/trainer/notif-settings")
    public ResponseEntity<Map<String, Object>> updateNotifSettings(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        Trainer trainer = getTrainer(authorization);
        if (body.containsKey("notifBirthday")) {
            trainer.setNotifBirthday(Boolean.TRUE.equals(body.get("notifBirthday")));
        }
        if (body.containsKey("notifMissionDone")) {
            trainer.setNotifMissionDone(Boolean.TRUE.equals(body.get("notifMissionDone")));
        }
        if (body.containsKey("notifPersonalWorkout")) {
            trainer.setNotifPersonalWorkout(Boolean.TRUE.equals(body.get("notifPersonalWorkout")));
        }
        if (body.containsKey("notifDiet")) {
            trainer.setNotifDiet(Boolean.TRUE.equals(body.get("notifDiet")));
        }
        if (body.containsKey("notifNewMember")) {
            trainer.setNotifNewMember(Boolean.TRUE.equals(body.get("notifNewMember")));
        }
        if (body.containsKey("notifIncompleteSession")) {
            trainer.setNotifIncompleteSession(Boolean.TRUE.equals(body.get("notifIncompleteSession")));
        }
        trainerRepository.save(trainer);
        return ResponseEntity.ok(Map.of(
                "notifBirthday", trainer.getNotifBirthday(),
                "notifMissionDone", trainer.getNotifMissionDone(),
                "notifPersonalWorkout", trainer.getNotifPersonalWorkout(),
                "notifDiet", trainer.getNotifDiet(),
                "notifNewMember", trainer.getNotifNewMember(),
                "notifIncompleteSession", trainer.getNotifIncompleteSession()
        ));
    }

    // GET /api/trainer/notif-settings — 알림 설정 조회
    @GetMapping("/trainer/notif-settings")
    public ResponseEntity<Map<String, Object>> getNotifSettings(
            @RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        return ResponseEntity.ok(Map.of(
                "notifBirthday", trainer.getNotifBirthday(),
                "notifMissionDone", trainer.getNotifMissionDone(),
                "notifPersonalWorkout", trainer.getNotifPersonalWorkout(),
                "notifDiet", trainer.getNotifDiet(),
                "notifNewMember", trainer.getNotifNewMember(),
                "notifIncompleteSession", trainer.getNotifIncompleteSession()
        ));
    }

    // GET /api/trainer/slot-settings — 슬롯 오프셋 조회
    @GetMapping("/trainer/slot-settings")
    public ResponseEntity<Map<String, Object>> getSlotSettings(
            @RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        Map<String, Object> result = new HashMap<>();
        result.put("slotOffset", trainer.getSlotOffset());
        result.put("weekStartHour", trainer.getWeekStartHour() != null ? trainer.getWeekStartHour() : 9);
        result.put("weekEndHour", trainer.getWeekEndHour() != null ? trainer.getWeekEndHour() : 23);
        return ResponseEntity.ok(result);
    }

    // PATCH /api/trainer/slot-settings — 슬롯 오프셋 저장 (0=정각, 30=30분)
    @PatchMapping("/trainer/slot-settings")
    public ResponseEntity<Map<String, Object>> saveSlotSettings(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        Trainer trainer = getTrainer(authorization);
        if (body.containsKey("slotOffset")) {
            Object val = body.get("slotOffset");
            trainer.setSlotOffset(val != null ? ((Number) val).intValue() : null);
        }
        if (body.containsKey("weekStartHour")) {
            Object val = body.get("weekStartHour");
            trainer.setWeekStartHour(val != null ? ((Number) val).intValue() : 9);
        }
        if (body.containsKey("weekEndHour")) {
            Object val = body.get("weekEndHour");
            trainer.setWeekEndHour(val != null ? ((Number) val).intValue() : 23);
        }
        trainerRepository.save(trainer);
        return ResponseEntity.ok(Map.of(
            "slotOffset", trainer.getSlotOffset(),
            "weekStartHour", trainer.getWeekStartHour() != null ? trainer.getWeekStartHour() : 9,
            "weekEndHour", trainer.getWeekEndHour() != null ? trainer.getWeekEndHour() : 23
        ));
    }

    // POST /api/trainer/members/{memberId}/disconnect — 연동 회원 연결 해제 (INACTIVE 전환, trainer 참조 유지)
    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/trainer/members/{memberId}/disconnect")
    public ResponseEntity<Map<String, Object>> disconnectMember(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId) {
        Trainer trainer = getTrainer(authorization);
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        if (!trainer.getId().equals(member.getTrainer() != null ? member.getTrainer().getId() : null)) {
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        }
        Long mId = member.getId();
        // PT 결제(PtContract)·회원 계정(User)·Member 행만 유지, 나머지 전부 삭제
        scheduleRepository.deleteByMember(member);
        missionRepository.deleteByMemberId(mId);
        memberMemoRepository.deleteByMember(member);
        workoutLogRepository.deleteByMember(member);
        dietPhotoFeedbackRepository.deleteByMemberId(mId);
        dietDayFeedbackRepository.deleteByMember(member);
        dietPhotoRepository.deleteByMember(member);
        bodyLogRepository.deleteByMember(member);
        memberGoalRepository.deleteByMember(member);
        trainerNoticeRepository.deleteByMemberId(mId);
        notificationRepository.deleteByMemberId(mId);
        member.setTrainer(null);
        member.setDisconnectedAt(java.time.LocalDate.now());
        memberRepository.save(member);
        return ResponseEntity.ok(Map.of("message", "회원 연결이 해제됐어요."));
    }

    // PATCH /api/trainer/sheets-config — Google Sheets 연동 정보 저장
    @PatchMapping("/trainer/sheets-config")
    public ResponseEntity<Map<String, Object>> saveSheetConfig(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body) {
        Trainer trainer = getTrainer(authorization);
        if (body.containsKey("spreadsheetId")) trainer.setGoogleSheetsSpreadsheetId(body.get("spreadsheetId"));
        if (body.containsKey("token")) trainer.setGoogleSheetsToken(body.get("token"));
        trainerRepository.save(trainer);
        return ResponseEntity.ok(Map.of("message", "저장됐어요."));
    }

    // DELETE /api/trainer/sheets-config — Google Sheets 연동 해제
    @DeleteMapping("/trainer/sheets-config")
    public ResponseEntity<Map<String, Object>> deleteSheetConfig(
            @RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        trainer.setGoogleSheetsSpreadsheetId(null);
        trainer.setGoogleSheetsToken(null);
        trainerRepository.save(trainer);
        return ResponseEntity.ok(Map.of("message", "해제됐어요."));
    }

    // GET /api/trainer/sheets-config — Google Sheets 연동 정보 조회
    @GetMapping("/trainer/sheets-config")
    public ResponseEntity<Map<String, Object>> getSheetConfig(
            @RequestHeader("Authorization") String authorization) {
        Trainer trainer = getTrainer(authorization);
        return ResponseEntity.ok(Map.of(
            "spreadsheetId", trainer.getGoogleSheetsSpreadsheetId() != null ? trainer.getGoogleSheetsSpreadsheetId() : "",
            "token", trainer.getGoogleSheetsToken() != null ? trainer.getGoogleSheetsToken() : "",
            "connected", trainer.getGoogleSheetsSpreadsheetId() != null
        ));
    }

    private Trainer getTrainer(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }
}
