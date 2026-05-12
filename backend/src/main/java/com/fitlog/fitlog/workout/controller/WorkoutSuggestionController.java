package com.fitlog.fitlog.workout.controller;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.entity.WorkoutSet;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/fitlog")
public class WorkoutSuggestionController {

    private final WorkoutLogRepository workoutLogRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final UserRepository userRepository;
    private final JwtService jwtService;

    public WorkoutSuggestionController(WorkoutLogRepository workoutLogRepository,
                                       MemberRepository memberRepository,
                                       TrainerRepository trainerRepository,
                                       UserRepository userRepository,
                                       JwtService jwtService) {
        this.workoutLogRepository = workoutLogRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
    }

    // GET /api/fitlog/suggestion?memberId=1&name=데드리프트
    // 특정 회원의 해당 운동명 최근 기록 반환 (띄어쓰기 무시)
    @GetMapping("/suggestion")
    public ResponseEntity<Map<String, Object>> getSuggestion(
            @RequestHeader("Authorization") String authorization,
            @RequestParam Long memberId,
            @RequestParam String name) {

        getUserFromToken(authorization);

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        // 띄어쓰기 제거한 검색어
        String normalized = name.replaceAll("\\s+", "").toLowerCase();

        if (normalized.isEmpty()) return ResponseEntity.ok(Map.of());

        // 최근 4주 로그에서 운동명 유사 검색
        List<WorkoutSet> allSets = workoutLogRepository
                .findByMemberAndDateBetween(member,
                        java.time.LocalDate.now().minusWeeks(8),
                        java.time.LocalDate.now())
                .stream()
                .flatMap(log -> log.getSets().stream())
                .collect(Collectors.toList());

        // 운동명 띄어쓰기 제거 후 비교, 최신 순 정렬
        List<WorkoutSet> matched = allSets.stream()
                .filter(s -> s.getExerciseName().replaceAll("\\s+", "").toLowerCase().contains(normalized))
                .collect(Collectors.toList());

        if (matched.isEmpty()) return ResponseEntity.ok(Map.of());

        // 가장 최근 운동명으로 그룹핑 → 첫 번째 운동명 기준 세트 반환
        // (같은 운동 여러 이름 있을 수 있으니 가장 많이 쓴 이름 사용)
        String mostUsedName = matched.stream()
                .collect(Collectors.groupingBy(
                        s -> s.getExerciseName().replaceAll("\\s+", "").toLowerCase(),
                        Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(e -> matched.stream()
                        .filter(s -> s.getExerciseName().replaceAll("\\s+", "").toLowerCase().equals(e.getKey()))
                        .findFirst().map(WorkoutSet::getExerciseName).orElse(name))
                .orElse(name);

        // 해당 운동명의 가장 최근 세트 목록
        List<WorkoutSet> recentSets = matched.stream()
                .filter(s -> s.getExerciseName().replaceAll("\\s+", "").toLowerCase()
                        .equals(mostUsedName.replaceAll("\\s+", "").toLowerCase()))
                .collect(Collectors.toList());

        // 세트번호 기준 그룹핑 (같은 날 여러 세트)
        // workout_log 기준으로 가장 최근 날짜의 세트들
        Optional<java.time.LocalDate> latestDate = recentSets.stream()
                .map(s -> s.getWorkoutLog().getLogDate())
                .max(Comparator.naturalOrder());

        if (latestDate.isEmpty()) return ResponseEntity.ok(Map.of());

        List<Map<String, Object>> latestSets = recentSets.stream()
                .filter(s -> s.getWorkoutLog().getLogDate().equals(latestDate.get()))
                .map(s -> {
                    Map<String, Object> setMap = new HashMap<>();
                    setMap.put("weight", s.getWeight());
                    setMap.put("reps", s.getReps());
                    setMap.put("rpe", s.getRpe());
                    return setMap;
                })
                .collect(Collectors.toList());

        Map<String, Object> result = new HashMap<>();
        result.put("exerciseName", mostUsedName);
        result.put("date", latestDate.get().toString());
        result.put("sets", latestSets);

        return ResponseEntity.ok(result);
    }

    private User getUserFromToken(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("유저를 찾을 수 없습니다."));
    }
}