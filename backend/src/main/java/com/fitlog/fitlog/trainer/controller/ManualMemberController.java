package com.fitlog.fitlog.trainer.controller;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.MemberMemoRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;

@RestController
@RequestMapping("/api/trainer/manual-members")
public class ManualMemberController {

    private final ManualMemberRepository manualMemberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final PtContractRepository ptContractRepository;
    private final WorkoutLogRepository workoutLogRepository;
    private final MemberMemoRepository memberMemoRepository;

    public ManualMemberController(ManualMemberRepository manualMemberRepository,
                                   TrainerRepository trainerRepository,
                                   JwtService jwtService,
                                   PtContractRepository ptContractRepository,
                                   WorkoutLogRepository workoutLogRepository,
                                   MemberMemoRepository memberMemoRepository) {
        this.manualMemberRepository = manualMemberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.ptContractRepository = ptContractRepository;
        this.workoutLogRepository = workoutLogRepository;
        this.memberMemoRepository = memberMemoRepository;
    }

    // 미연동 회원 목록 조회 (OT 회원 제외 — OT는 체험 회원으로 별도 관리)
    @GetMapping
    public List<Map<String, Object>> getAll(@RequestHeader("Authorization") String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        List<ManualMember> members = manualMemberRepository.findNonOtByTrainer(trainer);
        List<Map<String, Object>> result = new ArrayList<>();
        for (ManualMember m : members) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", m.getId());
            map.put("name", m.getName());
            map.put("phone", m.getPhone());
            map.put("memo", m.getMemo());
            map.put("ptTotal", m.getPtTotal());
            map.put("ptRemaining", m.getPtRemaining());
            map.put("amount", m.getAmount());
            map.put("paymentDate", m.getPaymentDate());
            map.put("ptEndedAt", m.getPtEndedAt());
            map.put("otCount", m.getOtCount());
            memberMemoRepository.findTop1ByManualMemberOrderByCreatedAtDesc(m)
                    .ifPresent(memo -> map.put("latestMemo", memo.getContent()));
            result.add(map);
        }
        return result;
    }

    // 미연동 회원 단건 조회
    @GetMapping("/{id}")
    public ResponseEntity<ManualMember> getOne(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id) {
        ManualMember m = manualMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("미연동 회원을 찾을 수 없습니다."));
        return ResponseEntity.ok(m);
    }

    // 미연동 회원 추가 (신규 등록 시 결제정보 있으면 PtContract도 생성)
    @PostMapping
    public ResponseEntity<ManualMember> create(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        // 무료 플랜 5명 제한 (OT 회원은 제외, PT 회원 기준)
        boolean isOtNew = "OT".equals(body.get("memo"));
        if (!isOtNew && !trainer.isProEffective()) {
            long nonOtCount = manualMemberRepository.countNonOtByTrainer(trainer)
                    + trainer.getMembers().size();
            if (nonOtCount >= 5) {
                return ResponseEntity.status(403).body(null);
            }
        }

        // OT 회원 매칭: 동일 트레이너의 OT 회원 중 전화번호(우선) 또는 이름이 일치하면 PT로 전환
        String incomingPhone = body.get("phone") != null ? ((String) body.get("phone")).trim() : null;
        String incomingName  = body.get("name")  != null ? ((String) body.get("name")).trim()  : null;
        boolean isNewOtMember = "OT".equals(body.get("memo")); // isOtNew와 동일 — 아래 로직에서 사용

        // OT 중복 방지: 동일 전화번호/이름의 OT 회원이 이미 존재하면 그대로 반환 (2회차 OT 지원)
        if (isNewOtMember) {
            java.util.Optional<ManualMember> existingOt = java.util.Optional.empty();
            if (incomingPhone != null && !incomingPhone.isBlank()) {
                existingOt = manualMemberRepository.findByTrainerAndMemoAndPhone(trainer, "OT", incomingPhone);
                if (existingOt.isEmpty()) {
                    String digitsOnly = incomingPhone.replaceAll("[^0-9]", "");
                    if (!digitsOnly.equals(incomingPhone)) {
                        existingOt = manualMemberRepository.findByTrainerAndMemoAndPhone(trainer, "OT", digitsOnly);
                    }
                }
            }
            if (existingOt.isEmpty() && incomingName != null && !incomingName.isBlank()) {
                existingOt = manualMemberRepository.findByTrainerAndMemoAndName(trainer, "OT", incomingName);
            }
            if (existingOt.isPresent()) {
                return ResponseEntity.ok(existingOt.get());
            }
        }

        if (!isNewOtMember && (incomingPhone != null || incomingName != null)) {
            java.util.Optional<ManualMember> otMatch = java.util.Optional.empty();
            if (incomingPhone != null && !incomingPhone.isBlank()) {
                // 1차: 포맷 그대로 매칭 (010-0000-0000)
                otMatch = manualMemberRepository.findByTrainerAndMemoAndPhone(trainer, "OT", incomingPhone);
                // 2차: 숫자만으로 폴백 (기존에 digits-only로 저장된 OT 회원 대응)
                if (otMatch.isEmpty()) {
                    String digitsOnly = incomingPhone.replaceAll("[^0-9]", "");
                    if (!digitsOnly.equals(incomingPhone)) {
                        otMatch = manualMemberRepository.findByTrainerAndMemoAndPhone(trainer, "OT", digitsOnly);
                    }
                }
            }
            if (otMatch.isEmpty() && incomingName != null && !incomingName.isBlank()) {
                otMatch = manualMemberRepository.findByTrainerAndMemoAndName(trainer, "OT", incomingName);
            }

            if (otMatch.isPresent()) {
                // 기존 OT 회원을 PT 회원으로 전환
                ManualMember ot = otMatch.get();
                int otSessions = (int) workoutLogRepository.countByManualMember(ot);
                ot.setOtCount(otSessions > 0 ? otSessions : null);
                int ptTotal = 0;
                if (body.get("ptTotal") != null) {
                    ptTotal = ((Number) body.get("ptTotal")).intValue();
                }
                ot.setPtTotal(ptTotal);
                ot.setPtRemaining(body.get("ptRemaining") != null
                        ? ((Number) body.get("ptRemaining")).intValue() : ptTotal);
                // OT → PT 전환: memo에서 "OT" 제거
                String newMemo = body.get("memo") != null ? (String) body.get("memo") : null;
                ot.setMemo("OT".equals(newMemo) ? null : newMemo);
                if (body.get("amount") != null) ot.setAmount(((Number) body.get("amount")).longValue());
                java.time.LocalDate pd = java.time.LocalDate.now();
                if (body.get("paymentDate") != null) {
                    try { pd = java.time.LocalDate.parse((String) body.get("paymentDate")); } catch (Exception ignored) {}
                }
                ot.setPaymentDate(pd);
                ManualMember converted = manualMemberRepository.save(ot);
                if (ot.getAmount() != null && ptTotal > 0) {
                    PtContract contract = new PtContract();
                    contract.setTrainer(trainer);
                    contract.setManualMember(converted);
                    contract.setMemberName(converted.getName());
                    contract.setTotalSessions(ptTotal);
                    contract.setRemainSessions(converted.getPtRemaining());
                    contract.setAmount(converted.getAmount());
                    contract.setPaymentDate(pd);
                    contract.setStartDate(pd.toString());
                    ptContractRepository.save(contract);
                }
                return ResponseEntity.ok(converted);
            }
        }

        ManualMember m = new ManualMember();
        m.setTrainer(trainer);
        m.setName((String) body.get("name"));
        if (body.get("phone") != null) m.setPhone(formatPhone((String) body.get("phone")));
        if (body.get("memo") != null) m.setMemo((String) body.get("memo"));

        boolean isOtMember = "OT".equals(body.get("memo"));
        int ptTotal = 0;
        if (body.get("ptTotal") != null) {
            ptTotal = ((Number) body.get("ptTotal")).intValue();
            m.setPtTotal(ptTotal);
            if (body.get("ptRemaining") != null) {
                m.setPtRemaining(((Number) body.get("ptRemaining")).intValue());
            } else {
                m.setPtRemaining(ptTotal);
            }
        } else if (!isOtMember) {
            // OT가 아닌 일반 미연동 회원은 ptTotal/ptRemaining 기본값 0
            m.setPtTotal(0);
            m.setPtRemaining(0);
        }
        // OT 회원은 ptTotal/ptRemaining = null (PT 횟수 개념 없음)

        Long amount = null;
        if (body.get("amount") != null) {
            amount = ((Number) body.get("amount")).longValue();
            m.setAmount(amount);
        }

        java.time.LocalDate paymentDate = null;
        if (body.get("paymentDate") != null) {
            try {
                paymentDate = java.time.LocalDate.parse((String) body.get("paymentDate"));
                m.setPaymentDate(paymentDate);
            } catch (Exception ignored) {}
        }

        ManualMember saved = manualMemberRepository.save(m);

        // 결제 정보가 있으면 PtContract 생성 (월별 매출 추적용)
        if (amount != null && ptTotal > 0) {
            PtContract contract = new PtContract();
            contract.setTrainer(trainer);
            contract.setManualMember(saved);
            contract.setMemberName(saved.getName());
            contract.setTotalSessions(ptTotal);
            contract.setRemainSessions(body.get("ptRemaining") != null
                    ? ((Number) body.get("ptRemaining")).intValue() : ptTotal);
            contract.setAmount(amount);
            java.time.LocalDate effectiveDate = paymentDate != null ? paymentDate : java.time.LocalDate.now();
            contract.setPaymentDate(effectiveDate);
            contract.setStartDate(effectiveDate.toString()); // start_date = payment_date
            if (body.containsKey("memo")) {
                String memo = (String) body.get("memo");
                contract.setMemo(memo != null && !memo.isBlank() ? memo : null);
            }
            ptContractRepository.save(contract);
        }

        return ResponseEntity.ok(saved);
    }

    // 결제 수정 (수업수 / 금액 / 메모) — PtContract 직접 수정은 contracts 엔드포인트 사용
    @PutMapping("/{id}")
    public ResponseEntity<ManualMember> update(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        ManualMember m = manualMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        if (body.get("sessions") != null) {
            int newSessions = ((Number) body.get("sessions")).intValue();
            if (body.get("ptRemaining") != null) {
                m.setPtTotal(newSessions);
                m.setPtRemaining(((Number) body.get("ptRemaining")).intValue());
            } else {
                int diff = newSessions - (m.getPtTotal() != null ? m.getPtTotal() : 0);
                m.setPtTotal(newSessions);
                m.setPtRemaining(Math.max(0, (m.getPtRemaining() != null ? m.getPtRemaining() : 0) + diff));
            }
        }
        if (body.get("amount") != null) {
            m.setAmount(((Number) body.get("amount")).longValue());
        }
        if (body.containsKey("memo")) {
            String memo = (String) body.get("memo");
            m.setMemo(memo != null && !memo.isBlank() ? memo : null);
        }
        return ResponseEntity.ok(manualMemberRepository.save(m));
    }

    // PT 추가 결제 — PtContract 생성 + ManualMember 세션 증가
    @PutMapping("/{id}/pt")
    public ResponseEntity<ManualMember> addPt(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        ManualMember m = manualMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        int sessions = ((Number) body.get("sessions")).intValue();
        m.setPtTotal((m.getPtTotal() != null ? m.getPtTotal() : 0) + sessions);
        m.setPtRemaining((m.getPtRemaining() != null ? m.getPtRemaining() : 0) + sessions);
        m.setPtEndedAt(null); // 재결제 시 비활성화 타이머 초기화
        // OT 회원이 PT 결제 시 memo를 결제 메모 또는 null로 변경
        if ("OT".equalsIgnoreCase(m.getMemo())) {
            String paymentMemo = body.containsKey("memo") ? (String) body.get("memo") : null;
            m.setMemo(paymentMemo != null && !paymentMemo.isBlank() ? paymentMemo : null);
        }
        manualMemberRepository.save(m);

        // PtContract 생성 (월별 매출 추적)
        PtContract contract = new PtContract();
        contract.setTrainer(m.getTrainer());
        contract.setManualMember(m);
        contract.setMemberName(m.getName());
        contract.setTotalSessions(sessions);
        contract.setRemainSessions(sessions);
        if (body.get("amount") != null) {
            long amount = ((Number) body.get("amount")).longValue();
            contract.setAmount(amount);
            m.setAmount(amount); // 최근 결제 금액 표시용
        }
        if (body.containsKey("memo")) {
            String memo = (String) body.get("memo");
            contract.setMemo(memo != null && !memo.isBlank() ? memo : null);
        }
        java.time.LocalDate pd = java.time.LocalDate.now();
        if (body.get("paymentDate") != null) {
            try {
                pd = java.time.LocalDate.parse((String) body.get("paymentDate"));
                m.setPaymentDate(pd);
            } catch (Exception ignored) {}
        }
        contract.setPaymentDate(pd);
        contract.setStartDate(pd.toString()); // start_date = payment_date
        ptContractRepository.save(contract);
        manualMemberRepository.save(m);

        return ResponseEntity.ok(m);
    }

    @PostMapping("/{id}/reactivate")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, Object>> reactivate(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id) {
        ManualMember m = manualMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        m.setPtEndedAt(null);
        manualMemberRepository.save(m);
        return ResponseEntity.ok(java.util.Map.of("message", "재활성화됐어요."));
    }

    @DeleteMapping("/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Void> delete(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id) {
        manualMemberRepository.findById(id).ifPresent(m -> {
            ptContractRepository.findByManualMember(m).forEach(c -> {
                c.setMemberName(m.getName()); // 이름 보존
                c.setManualMember(null);
                ptContractRepository.save(c);
            });
            workoutLogRepository.deleteByManualMember(m);
        });
        manualMemberRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String formatPhone(String phone) {
        if (phone == null) return null;
        String d = phone.replaceAll("[^0-9]", "");
        if (d.length() == 11)
            return d.substring(0, 3) + "-" + d.substring(3, 7) + "-" + d.substring(7);
        if (d.length() == 10) {
            if (d.startsWith("02"))
                return d.substring(0, 2) + "-" + d.substring(2, 6) + "-" + d.substring(6);
            return d.substring(0, 3) + "-" + d.substring(3, 6) + "-" + d.substring(6);
        }
        return phone;
    }
}
