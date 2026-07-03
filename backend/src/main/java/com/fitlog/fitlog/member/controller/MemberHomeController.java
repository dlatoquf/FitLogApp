package com.fitlog.fitlog.member.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.bodylog.entity.BodyLog;
import com.fitlog.fitlog.bodylog.entity.ManualBodyLog;
import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.bodylog.repository.ManualBodyLogRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.service.MemberDataCleanupService;
import com.fitlog.fitlog.member.service.MemberDeleteService;
import com.fitlog.fitlog.member.service.MemberHomeService;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.MemberMemo;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/member")
public class MemberHomeController {

    private final MemberHomeService memberHomeService;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final MemberDeleteService memberDeleteService;
    private final ManualMemberRepository manualMemberRepository;
    private final MemberMemoRepository memberMemoRepository;
    private final NotificationService notificationService;
    private final WorkoutLogRepository workoutLogRepository;
    private final PtContractRepository ptContractRepository;
    private final ScheduleRepository scheduleRepository;
    private final ManualBodyLogRepository manualBodyLogRepository;
    private final BodyLogRepository bodyLogRepository;
    private final MemberDataCleanupService memberDataCleanupService;

    public MemberHomeController(MemberHomeService memberHomeService,
                                MemberRepository memberRepository,
                                TrainerRepository trainerRepository,
                                JwtService jwtService,
                                UserRepository userRepository,
                                MemberDeleteService memberDeleteService,
                                ManualMemberRepository manualMemberRepository,
                                MemberMemoRepository memberMemoRepository,
                                NotificationService notificationService,
                                WorkoutLogRepository workoutLogRepository,
                                PtContractRepository ptContractRepository,
                                ScheduleRepository scheduleRepository,
                                ManualBodyLogRepository manualBodyLogRepository,
                                BodyLogRepository bodyLogRepository,
                                MemberDataCleanupService memberDataCleanupService) {
        this.memberHomeService = memberHomeService;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.memberDeleteService = memberDeleteService;
        this.manualMemberRepository = manualMemberRepository;
        this.memberMemoRepository = memberMemoRepository;
        this.notificationService = notificationService;
        this.workoutLogRepository = workoutLogRepository;
        this.ptContractRepository = ptContractRepository;
        this.scheduleRepository = scheduleRepository;
        this.manualBodyLogRepository = manualBodyLogRepository;
        this.bodyLogRepository = bodyLogRepository;
        this.memberDataCleanupService = memberDataCleanupService;
    }

    @GetMapping("/home")
    public ResponseEntity<Map<String, Object>> getHome(
            @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(memberHomeService.getHome(authorization));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(
            @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(memberHomeService.getMe(authorization));
    }

    // DELETE /api/member/me - 회원 계정 삭제
    @DeleteMapping("/me")
    public ResponseEntity<Map<String, Object>> deleteMe(
            @RequestHeader("Authorization") String authorization) {
        try {
            // 탈퇴 전 트레이너 정보 저장 후 알림
            Member member = memberHomeService.getMemberByToken(authorization);
            if (member.getTrainer() != null && member.getTrainer().getUser() != null) {
                String memberName = member.getUser() != null ? member.getUser().getName() : "회원";
                notificationService.sendNotification(
                        member.getTrainer().getUser(),
                        "MEMBER_DELETED",
                        memberName + "님이 FitLog를 탈퇴했어요.",
                        "MEMBER",
                        member.getId()
                );
            }
            memberDeleteService.deleteMemberAccount(authorization);
            return ResponseEntity.ok(Map.of("success", true, "message", "계정이 삭제됐어요."));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500)
                    .body(Map.of("success", false, "message", e.getMessage() != null ? e.getMessage() : "알 수 없는 오류"));
        }
    }

    // PUT /api/member/me - 회원 프로필 수정
    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateMe(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {

        Member member = memberHomeService.getMemberByToken(authorization);

        if (body.get("name") != null) {
            member.getUser().setName(body.get("name").toString());
            userRepository.save(member.getUser());
        }

        if (body.get("phone") != null) {
            member.setPhone(formatPhone(body.get("phone").toString()));
        }

        if (body.get("height") != null) {
            member.setHeight(((Number) body.get("height")).doubleValue());
        }

        memberRepository.save(member);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "회원 프로필 수정 완료"
        ));
    }

    @GetMapping("/schedule/this-week")
    public ResponseEntity<List<Map<String, Object>>> getThisWeek(
            @RequestHeader("Authorization") String authorization) {
        return ResponseEntity.ok(memberHomeService.getMyThisWeek(authorization));
    }

    // GET /api/member/check-trainer?code=XXXX - 트레이너 코드 유효성 확인 (연결 X)
    @Transactional(readOnly = true)
    @GetMapping("/check-trainer")
    public ResponseEntity<Map<String, Object>> checkTrainer(
            @RequestParam("code") String code) {

        if (code == null || code.isBlank())
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "코드를 입력해주세요."));

        Trainer trainer = trainerRepository.findByTrainerCode(code.trim().toUpperCase()).orElse(null);

        if (trainer == null)
            return ResponseEntity.badRequest().body(Map.of("valid", false, "message", "유효하지 않은 트레이너 코드예요."));

        long memberCount = memberRepository.countByTrainer(trainer);
        boolean isFree = "FREE".equals(trainer.getPlan());

        if (isFree && memberCount >= 3) {
            return ResponseEntity.ok(Map.of(
                    "valid", false,
                    "full", true,
                    "message", "해당 트레이너는 현재 무료 플랜으로 회원을 더 받을 수 없어요.\n트레이너에게 PRO 플랜 업그레이드를 요청해주세요.",
                    "trainerName", trainer.getUser().getName()
            ));
        }

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "trainerName", trainer.getUser().getName(),
                "gymName", trainer.getGymName() != null ? trainer.getGymName() : ""
        ));
    }

    // POST /api/member/connect-trainer
    @Transactional
    @PostMapping("/connect-trainer")
    public ResponseEntity<Map<String, Object>> connectTrainer(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, String> body) {

        String trainerCode = body.get("trainerCode");
        if (trainerCode == null || trainerCode.isBlank())
            return ResponseEntity.badRequest().body(Map.of("message", "트레이너 코드를 입력해주세요."));

        // findByUserId 한번에 조회
        Member member = memberHomeService.getMemberByToken(authorization);

        Trainer trainer = trainerRepository.findByTrainerCode(trainerCode.trim().toUpperCase())
                .orElse(null);

        if (trainer == null)
            return ResponseEntity.badRequest().body(Map.of("message", "유효하지 않은 트레이너 코드예요."));

        // 무료 플랜 5명 제한 (PRO 또는 체험 중이면 무제한)
        if (!trainer.isProEffective()) {
            long memberCount = memberRepository.countByTrainer(trainer);
            if (memberCount >= 5) {
                return ResponseEntity.badRequest().body(
                        Map.of("message", "해당 트레이너는 무료 플랜으로 최대 5명까지 연결 가능합니다.")
                );
            }
        }

        // 기존에 다른 트레이너 소속이었다면 previousTrainerId에 저장 (기록 열람 기준용)
        if (member.getTrainer() != null && !member.getTrainer().getId().equals(trainer.getId())) {
            member.setPreviousTrainerId(member.getTrainer().getId());
            // 명시적 연결해제 없이 바로 이동한 경우 disconnectedAt이 null일 수 있으므로 오늘 날짜로 세팅
            if (member.getDisconnectedAt() == null) {
                member.setDisconnectedAt(java.time.LocalDate.now());
            }
        }
        member.setTrainer(trainer);
        member.setStatus(com.fitlog.fitlog.member.entity.Member.Status.ACTIVE);
        // 같은 트레이너에 재연결이면 disconnectedAt·previousTrainerId 초기화
        if (member.getPreviousTrainerId() == null || member.getPreviousTrainerId().equals(trainer.getId())) {
            member.setDisconnectedAt(null);
            member.setPreviousTrainerId(null);
        }
        memberRepository.save(member);

        // ── 미연동 회원 자동 병합: 전화번호 우선, 없으면 이름으로 매칭 ──
        String memberName = member.getUser().getName();
        String memberPhone = member.getPhone() != null
                ? member.getPhone().replaceAll("[^0-9]", "") : "";

        List<ManualMember> allManuals = manualMemberRepository.findByTrainer(trainer);

        // 1순위: 전화번호 일치 (번호가 있는 경우)
        ManualMember mm = null;
        if (!memberPhone.isBlank()) {
            List<ManualMember> phoneMatches = allManuals.stream()
                    .filter(m -> m.getPhone() != null
                            && m.getPhone().replaceAll("[^0-9]", "").equals(memberPhone))
                    .toList();
            if (phoneMatches.size() == 1) mm = phoneMatches.get(0);
        }

        // 2순위: 이름 일치 (전화번호 매칭 실패 시)
        if (mm == null) {
            List<ManualMember> nameMatches = allManuals.stream()
                    .filter(m -> m.getName().trim().equalsIgnoreCase(memberName.trim()))
                    .toList();
            if (nameMatches.size() == 1) mm = nameMatches.get(0);
        }

        boolean merged = false;
        if (mm != null) {

            // 1. PT 데이터 + 전화번호 이전 (미연동에만 있고 연동엔 없을 때)
            boolean memberUpdated = false;
            if (mm.getPtTotal() != null && mm.getPtTotal() > 0
                    && (member.getPtTotal() == null || member.getPtTotal() == 0)) {
                member.setPtTotal(mm.getPtTotal());
                member.setPtRemaining(mm.getPtRemaining());
                memberUpdated = true;
            }
            if (mm.getPhone() != null && !mm.getPhone().isBlank()
                    && (member.getPhone() == null || member.getPhone().isBlank())) {
                member.setPhone(mm.getPhone());
                memberUpdated = true;
            }
            if (memberUpdated) memberRepository.save(member);

            // 2. 메모 이전: manual_member_id → member_id 로 교체 후 저장
            //    이렇게 해야 manualMember 삭제 시 CASCADE로 메모가 날아가지 않음
            List<MemberMemo> memos = memberMemoRepository.findByManualMemberOrderByCreatedAtDesc(mm);
            for (MemberMemo memo : memos) {
                memo.setMember(member);       // 연동 회원으로 교체
                memo.setManualMember(null);   // 미연동 참조 제거
                memberMemoRepository.save(memo);
            }

            // 3. 운동 로그 이전: manualMember → member 로 일괄 업데이트
            workoutLogRepository.transferManualMemberLogs(mm, member);

            // 3-1. pt_contracts 이전: manual_member_id → member_id 로 교체
            List<PtContract> contracts = ptContractRepository.findByManualMember(mm);
            for (PtContract contract : contracts) {
                contract.setMember(member);
                contract.setManualMember(null);
                ptContractRepository.save(contract);
            }

            // 3-2. schedules 이전: manual_member_id → member_id 로 일괄 업데이트
            scheduleRepository.transferManualMemberSchedules(mm, member);

            // 3-3. 바디로그 이전: ManualBodyLog → BodyLog 로 변환 후 저장
            List<ManualBodyLog> manualBodyLogs = manualBodyLogRepository.findByManualMemberOrderByLogDateAsc(mm);
            for (ManualBodyLog mbl : manualBodyLogs) {
                BodyLog bl = new BodyLog();
                bl.setMember(member);
                bl.setLogDate(mbl.getLogDate());
                bl.setWeight(mbl.getWeight());
                bl.setBodyFat(mbl.getBodyFat());
                bl.setBodyFatMass(mbl.getBodyFatMass());
                bl.setMuscleMass(mbl.getMuscleMass());
                bl.setMemo(mbl.getMemo());
                bl.setCreatedAt(mbl.getCreatedAt() != null ? mbl.getCreatedAt() : java.time.LocalDateTime.now());
                bodyLogRepository.save(bl);
            }
            manualBodyLogRepository.deleteAll(manualBodyLogs);

            // 4. 미연동 회원 삭제 (이 시점엔 메모/로그/계약/일정/바디로그 참조가 없으므로 RESTRICT/SET NULL 위반 없음)
            manualMemberRepository.delete(mm);
            merged = true;
        }

        // 트레이너에게 신규 회원 연결 알림
        try {
            if (trainer.getNotifNewMember()) {
                notificationService.sendNotification(
                    trainer.getUser(),
                    "NEW_MEMBER",
                    member.getUser().getName() + "님이 회원으로 등록됐어요.",
                    "MEMBER",
                    member.getId()
                );
            }
        } catch (Exception ignored) {}

        return ResponseEntity.ok(Map.of(
                "message",     "트레이너 연결 완료!",
                "trainerName", trainer.getUser().getName(),
                "gymName",     trainer.getGymName() != null ? trainer.getGymName() : "",
                "merged",      merged   // 프론트에서 "기존 정보가 이전됐어요" 안내용
        ));
    }

    // GET /api/member/verify-trainer-code?code=ABC123 — 연결 전 트레이너 코드 미리보기
    @GetMapping("/verify-trainer-code")
    public ResponseEntity<Map<String, Object>> verifyTrainerCode(
            @RequestParam String code) {
        Trainer trainer = trainerRepository.findByTrainerCode(code.trim().toUpperCase()).orElse(null);
        if (trainer == null)
            return ResponseEntity.badRequest().body(Map.of("message", "유효하지 않은 트레이너 코드예요."));

        long memberCount = memberRepository.countByTrainer(trainer);
        boolean isFree = "FREE".equals(trainer.getPlan());
        if (isFree && memberCount >= 3)
            return ResponseEntity.badRequest().body(Map.of("message", "이 트레이너는 현재 무료 플랜 회원이 가득 찼어요."));

        return ResponseEntity.ok(Map.of(
                "trainerName", trainer.getUser().getName(),
                "gymName",     trainer.getGymName() != null ? trainer.getGymName() : ""
        ));
    }

    // POST /api/member/disconnect-trainer — 트레이너 연결 해제 (INACTIVE 전환, trainer 참조 유지)
    @Transactional
    @PostMapping("/disconnect-trainer")
    public ResponseEntity<Map<String, Object>> disconnectTrainer(
            @RequestHeader("Authorization") String authorization) {
        Member member = memberHomeService.getMemberByToken(authorization);
        if (member.getTrainer() == null || member.getStatus() == com.fitlog.fitlog.member.entity.Member.Status.INACTIVE)
            return ResponseEntity.badRequest().body(Map.of("message", "연결된 트레이너가 없어요."));
        Trainer trainer = member.getTrainer();
        String memberName = member.getUser() != null ? member.getUser().getName() : "회원";
        // 데이터는 90일 후 스케줄러가 정리 — 즉시 삭제하지 않음
        member.setStatus(com.fitlog.fitlog.member.entity.Member.Status.INACTIVE);
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
        member.setDisconnectedAt(today);
        memberRepository.save(member);
        // 오늘까지 스케줄: 이름 보존 후 참조 해제 / 내일 이후 스케줄: 삭제
        scheduleRepository.findRecordedSchedulesByMember(member).forEach(s -> {
            if (!s.getDate().isAfter(today) && s.getMemberName() == null) {
                s.setMemberName(member.getUser() != null ? member.getUser().getName() : null);
                scheduleRepository.save(s);
            }
        });
        scheduleRepository.detachMemberFromRecordedSchedulesUpToDate(member, today);
        scheduleRepository.deleteByMemberAndDateAfter(member, today);
        // 트레이너에게 연결 해제 알림
        if (trainer != null && trainer.getUser() != null) {
            notificationService.sendNotification(
                    trainer.getUser(),
                    "MEMBER_DISCONNECT",
                    memberName + "님이 트레이너 연결을 해제했어요.",
                    "MEMBER",
                    member.getId()
            );
        }
        return ResponseEntity.ok(Map.of("message", "트레이너 연결이 해제됐어요."));
    }

    // GET /api/member/pt/contracts — 회원 본인의 결제 내역 조회
    @GetMapping("/pt/contracts")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMyContracts(
            @RequestHeader("Authorization") String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Member member = memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보를 찾을 수 없습니다."));

        List<PtContract> contracts = ptContractRepository.findByMemberId(member.getId());

        java.time.format.DateTimeFormatter dateFmt = java.time.format.DateTimeFormatter.ofPattern("yyyy.M.d");
        List<Map<String, Object>> result = contracts.stream().map(c -> {
            java.time.LocalDate effDate = c.getPaymentDate() != null
                    ? c.getPaymentDate()
                    : (c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate() : java.time.LocalDate.now());
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("contractId", c.getId());
            m.put("sessions", c.getTotalSessions());
            m.put("amount", c.getAmount() != null ? c.getAmount() : 0L);
            m.put("memo", c.getMemo());
            m.put("date", effDate.format(dateFmt));
            return m;
        }).collect(java.util.stream.Collectors.toList());

        return ResponseEntity.ok(result);
    }

    @GetMapping("/notification-settings")
    public ResponseEntity<Map<String, Object>> getNotificationSettings(
            @RequestHeader("Authorization") String authorization) {
        Member member = memberHomeService.getMemberByToken(authorization);
        Map<String, Object> settings = new java.util.LinkedHashMap<>();
        settings.put("notifFeedback", member.getNotifFeedback());
        settings.put("notifSchedule", member.getNotifSchedule());
        settings.put("notifPtPayment", member.getNotifPtPayment());
        settings.put("notifWorkout", member.getNotifWorkout());
        settings.put("notifNotice", member.getNotifNotice());
        return ResponseEntity.ok(settings);
    }

    @PutMapping("/notification-settings")
    public ResponseEntity<Map<String, Object>> updateNotificationSettings(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Boolean> body) {
        Member member = memberHomeService.getMemberByToken(authorization);
        if (body.containsKey("notifFeedback")) member.setNotifFeedback(body.get("notifFeedback"));
        if (body.containsKey("notifSchedule")) member.setNotifSchedule(body.get("notifSchedule"));
        if (body.containsKey("notifPtPayment")) member.setNotifPtPayment(body.get("notifPtPayment"));
        if (body.containsKey("notifWorkout")) member.setNotifWorkout(body.get("notifWorkout"));
        if (body.containsKey("notifNotice")) member.setNotifNotice(body.get("notifNotice"));
        memberRepository.save(member);
        return ResponseEntity.ok(Map.of("message", "알림 설정이 저장됐어요."));
    }

    private String formatPhone(String phone) {
        if (phone == null) return null;
        String d = phone.replaceAll("[^0-9]", "");
        if (d.length() == 11)
            return d.substring(0, 3) + "-" + d.substring(3, 7) + "-" + d.substring(7);
        if (d.length() == 10)
            return (d.startsWith("02") ? d.substring(0, 2) + "-" + d.substring(2, 6) : d.substring(0, 3) + "-" + d.substring(3, 6)) + "-" + d.substring(d.startsWith("02") ? 6 : 6);
        return phone;
    }
}