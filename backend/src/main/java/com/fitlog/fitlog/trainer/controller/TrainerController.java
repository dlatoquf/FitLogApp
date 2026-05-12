package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.member.dto.MemberResponse;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.service.ScheduleService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class TrainerController {

    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final ScheduleRepository scheduleRepository;
    private final ScheduleService scheduleService;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public TrainerController(TrainerRepository trainerRepository,
                             MemberRepository memberRepository,
                             ScheduleRepository scheduleRepository,
                             ScheduleService scheduleService,
                             JwtService jwtService,
                             UserRepository userRepository) {
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.scheduleRepository = scheduleRepository;
        this.scheduleService = scheduleService;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
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

        return memberRepository.findActiveMembersByTrainerIdWithUser(trainerId)
                .stream()
                .map(MemberResponse::new)
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
        if (body.containsKey("ptRemaining"))
            member.setPtRemaining(body.get("ptRemaining") != null ? ((Number) body.get("ptRemaining")).intValue() : null);
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

    private Trainer getTrainer(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
    }
}
