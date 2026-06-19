package com.fitlog.fitlog.admin;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
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

    public AdminController(UserRepository userRepository,
                           TrainerRepository trainerRepository,
                           MemberRepository memberRepository,
                           PtContractRepository ptContractRepository) {
        this.userRepository = userRepository;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
        this.ptContractRepository = ptContractRepository;
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
}
