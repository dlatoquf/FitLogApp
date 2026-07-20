package com.fitlog.fitlog.admin;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.bodylog.entity.BodyLog;
import com.fitlog.fitlog.bodylog.repository.BodyLogRepository;
import com.fitlog.fitlog.comment.entity.Comment;
import com.fitlog.fitlog.comment.repository.CommentRepository;
import com.fitlog.fitlog.diet.entity.DietPhoto;
import com.fitlog.fitlog.diet.repository.DietPhotoRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.entity.WorkoutLog;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final String ADMIN_PASSWORD = "364900";

    private final UserRepository userRepository;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;
    private final PtContractRepository ptContractRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final DietPhotoRepository dietPhotoRepository;
    private final BodyLogRepository bodyLogRepository;
    private final ScheduleRepository scheduleRepository;
    private final CommentRepository commentRepository;

    public AdminController(UserRepository userRepository,
                           TrainerRepository trainerRepository,
                           MemberRepository memberRepository,
                           PtContractRepository ptContractRepository,
                           WorkoutLogRepository workoutLogRepository,
                           DietPhotoRepository dietPhotoRepository,
                           BodyLogRepository bodyLogRepository,
                           ScheduleRepository scheduleRepository,
                           CommentRepository commentRepository) {
        this.userRepository = userRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.ptContractRepository = ptContractRepository;
        this.workoutLogRepository = workoutLogRepository;
        this.dietPhotoRepository = dietPhotoRepository;
        this.bodyLogRepository = bodyLogRepository;
        this.scheduleRepository = scheduleRepository;
        this.commentRepository = commentRepository;
    }

    private boolean auth(String pw) {
        return ADMIN_PASSWORD.equals(pw);
    }

    @Transactional(readOnly = true)
    @GetMapping("/users")
    public ResponseEntity<?> getUsers(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (User u : users) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", u.getId());
            item.put("name", u.getName());
            item.put("email", u.getEmail());
            item.put("role", u.getRole() != null ? u.getRole().name() : null);
            item.put("createdAt", u.getCreatedAt() != null ? u.getCreatedAt().toLocalDate().toString() : null);
            item.put("deleted", u.getDeletedAt() != null);
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/trainers")
    public ResponseEntity<?> getTrainers(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<Trainer> trainers = trainerRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Trainer t : trainers) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", t.getId());
            item.put("name", t.getUser() != null ? t.getUser().getName() : "-");
            item.put("email", t.getUser() != null ? t.getUser().getEmail() : "-");
            item.put("gymName", t.getGymName());
            item.put("trainerCode", t.getTrainerCode());
            item.put("memberCount", t.getMembers() != null ? t.getMembers().size() : 0);
            item.put("plan", t.getPlan());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/members")
    public ResponseEntity<?> getMembers(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<Member> members = memberRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Member m : members) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", m.getId());
            item.put("name", m.getUser() != null ? m.getUser().getName() : "-");
            item.put("email", m.getUser() != null ? m.getUser().getEmail() : "-");
            item.put("trainerName", m.getTrainer() != null && m.getTrainer().getUser() != null
                    ? m.getTrainer().getUser().getName() : "-");
            item.put("ptRemaining", m.getPtRemaining());
            item.put("ptTotal", m.getPtTotal());
            item.put("status", m.getStatus() != null ? m.getStatus().name() : "-");
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/payments")
    public ResponseEntity<?> getPayments(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<PtContract> contracts = ptContractRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (PtContract c : contracts) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", c.getId());
            item.put("trainerName", c.getTrainer() != null && c.getTrainer().getUser() != null
                    ? c.getTrainer().getUser().getName() : "-");
            if (c.getMember() != null && c.getMember().getUser() != null) {
                item.put("memberName", c.getMember().getUser().getName());
            } else if (c.getManualMember() != null) {
                item.put("memberName", c.getManualMember().getName());
            } else if (c.getMemberName() != null) {
                item.put("memberName", c.getMemberName());
            } else {
                item.put("memberName", "알 수 없음");
            }
            item.put("amount", c.getAmount() != null ? c.getAmount() : 0);
            item.put("sessions", c.getTotalSessions());
            item.put("memo", c.getMemo());
            item.put("paidAt", c.getPaymentDate() != null
                    ? c.getPaymentDate().toString()
                    : (c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate().toString() : "-"));
            item.put("status", c.getStatus());
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/workout-logs")
    public ResponseEntity<?> getWorkoutLogs(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<WorkoutLog> logs = workoutLogRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (WorkoutLog w : logs) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", w.getWorkoutId());
            item.put("memberName", w.getMember() != null && w.getMember().getUser() != null
                    ? w.getMember().getUser().getName()
                    : (w.getManualMember() != null ? w.getManualMember().getName() : "-"));
            item.put("trainerName", w.getTrainer() != null && w.getTrainer().getUser() != null
                    ? w.getTrainer().getUser().getName() : "-");
            item.put("logDate", w.getLogDate() != null ? w.getLogDate().toString() : "-");
            item.put("workoutType", w.getWorkoutType());
            item.put("conditionScore", w.getConditionScore());
            item.put("memo", w.getMemo());
            item.put("createdAt", w.getCreatedAt() != null ? w.getCreatedAt().toLocalDate().toString() : "-");
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/diet-photos")
    public ResponseEntity<?> getDietPhotos(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<DietPhoto> photos = dietPhotoRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (DietPhoto d : photos) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", d.getId());
            item.put("memberName", d.getMember() != null && d.getMember().getUser() != null
                    ? d.getMember().getUser().getName() : "-");
            item.put("date", d.getDate() != null ? d.getDate().toString() : "-");
            item.put("label", d.getLabel());
            item.put("photoUrl", d.getPhotoUrl());
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/body-logs")
    public ResponseEntity<?> getBodyLogs(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<BodyLog> logs = bodyLogRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (BodyLog b : logs) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", b.getId());
            item.put("memberName", b.getMember() != null && b.getMember().getUser() != null
                    ? b.getMember().getUser().getName() : "-");
            item.put("logDate", b.getLogDate() != null ? b.getLogDate().toString() : "-");
            item.put("weight", b.getWeight());
            item.put("bodyFat", b.getBodyFat());
            item.put("muscleMass", b.getMuscleMass());
            item.put("memo", b.getMemo());
            item.put("createdAt", b.getCreatedAt() != null ? b.getCreatedAt().toLocalDate().toString() : "-");
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/schedules")
    public ResponseEntity<?> getSchedules(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<Schedule> schedules = scheduleRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Schedule s : schedules) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", s.getId());
            item.put("trainerName", s.getTrainer() != null && s.getTrainer().getUser() != null
                    ? s.getTrainer().getUser().getName() : "-");
            String mName = s.getMember() != null && s.getMember().getUser() != null
                    ? s.getMember().getUser().getName()
                    : (s.getManualMember() != null ? s.getManualMember().getName()
                    : (s.getMemberName() != null ? s.getMemberName() : "-"));
            item.put("memberName", mName);
            item.put("date", s.getDate() != null ? s.getDate().toString() : "-");
            item.put("startTime", s.getStartTime() != null ? s.getStartTime().toString() : "-");
            item.put("endTime", s.getEndTime() != null ? s.getEndTime().toString() : "-");
            item.put("status", s.getStatus());
            item.put("sessionType", s.getSessionType());
            item.put("note", s.getNote());
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }

    @Transactional(readOnly = true)
    @GetMapping("/comments")
    public ResponseEntity<?> getComments(@RequestParam String pw) {
        if (!auth(pw)) return ResponseEntity.status(401).body(Map.of("error", "인증 실패"));
        List<Comment> comments = commentRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Comment c : comments) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", c.getId());
            item.put("authorName", c.getAuthor() != null ? c.getAuthor().getName() : "-");
            item.put("authorRole", c.getAuthorRole());
            item.put("targetType", c.getTargetType());
            item.put("targetId", c.getTargetId());
            item.put("targetDate", c.getTargetDate() != null ? c.getTargetDate().toString() : "-");
            item.put("content", c.getContent());
            item.put("createdAt", c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate().toString() : "-");
            item.put("deleted", c.getDeletedAt() != null);
            result.add(item);
        }
        result.sort(Comparator.comparingLong(m -> -((Long) m.get("id"))));
        return ResponseEntity.ok(result);
    }
}
