package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.dto.PtAddRequest;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.member.service.PtContractService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private final JwtService jwtService;
    private final TrainerRepository trainerRepository;
    private final PtContractRepository ptContractRepository;
    private final PtContractService ptContractService;

    public PaymentController(JwtService jwtService,
                             TrainerRepository trainerRepository,
                             PtContractRepository ptContractRepository,
                             PtContractService ptContractService) {
        this.jwtService = jwtService;
        this.trainerRepository = trainerRepository;
        this.ptContractRepository = ptContractRepository;
        this.ptContractService = ptContractService;
    }

    @GetMapping("/packages")
    public List<Map<String, Object>> getPackages() {
        return List.of(
            Map.of("id", 1, "name", "10회 패키지", "sessions", 10, "price", 500000),
            Map.of("id", 2, "name", "20회 패키지", "sessions", 20, "price", 900000, "recommended", true),
            Map.of("id", 3, "name", "30회 패키지", "sessions", 30, "price", 1200000)
        );
    }

    @Transactional(readOnly = true)
    @GetMapping("/history")
    public List<Map<String, Object>> getHistory(@RequestHeader("Authorization") String auth) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너를 찾을 수 없습니다."));

        List<PtContract> contracts = ptContractRepository.findAllByTrainerWithAll(trainer);

        List<Map<String, Object>> result = new ArrayList<>();
        for (PtContract c : contracts) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", c.getId());
            item.put("packageName", c.getTotalSessions() + "회 패키지");
            item.put("sessions", c.getTotalSessions());
            item.put("amount", c.getAmount() != null ? c.getAmount() : 0);

            String paidAt = c.getPaymentDate() != null
                    ? c.getPaymentDate().toString()
                    : c.getCreatedAt().toLocalDate().toString();
            item.put("paidAt", paidAt);
            item.put("status", c.getStatus() != null ? c.getStatus() : "PAID");

            if (c.getMember() != null && c.getMember().getUser() != null) {
                item.put("memberName", c.getMember().getUser().getName());
            } else if (c.getManualMember() != null) {
                item.put("memberName", c.getManualMember().getName());
            } else if (c.getMemberName() != null) {
                item.put("memberName", c.getMemberName());
            } else {
                item.put("memberName", "알 수 없음");
            }

            result.add(item);
        }
        return result;
    }

    @DeleteMapping("/contracts/{id}")
    @Transactional
    public ResponseEntity<Map<String, String>> deleteContract(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너를 찾을 수 없습니다."));
        PtContract contract = ptContractRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("계약 정보를 찾을 수 없습니다."));
        if (!contract.getTrainer().getId().equals(trainer.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        }
        ptContractRepository.delete(contract);
        return ResponseEntity.ok(Map.of("message", "삭제되었습니다."));
    }

    @PatchMapping("/contracts/{id}/penalty")
    @Transactional
    public ResponseEntity<Map<String, String>> applyPenalty(
            @RequestHeader("Authorization") String auth,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        Long userId = jwtService.getUserIdFromToken(auth.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너를 찾을 수 없습니다."));
        PtContract contract = ptContractRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("계약 정보를 찾을 수 없습니다."));
        if (!contract.getTrainer().getId().equals(trainer.getId())) {
            return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
        }
        long penaltyAmount = body.containsKey("amount") ? ((Number) body.get("amount")).longValue() : 0L;
        contract.setAmount(penaltyAmount);
        contract.setMemo("위약금");
        contract.setPaymentDate(java.time.LocalDate.now());
        contract.setTotalSessions(0);
        contract.setRemainSessions(0);
        ptContractRepository.save(contract);
        return ResponseEntity.ok(Map.of("message", "위약금이 적용되었습니다."));
    }

    @PostMapping("/purchase")
    public ResponseEntity<Map<String, String>> purchase(
            @RequestHeader("Authorization") String auth,
            @RequestBody Map<String, Object> body) {

        Long memberId = ((Number) body.get("memberId")).longValue();
        int packageId = ((Number) body.get("packageId")).intValue();

        int sessions;
        long price;
        switch (packageId) {
            case 1: sessions = 10; price = 500000; break;
            case 2: sessions = 20; price = 900000; break;
            case 3: sessions = 30; price = 1200000; break;
            default: throw new RuntimeException("존재하지 않는 패키지입니다.");
        }

        PtAddRequest request = new PtAddRequest();
        request.setSessions(sessions);
        request.setAmount(price);

        ptContractService.addPt(auth, memberId, request);
        return ResponseEntity.ok(Map.of("message", "결제가 등록됐어요."));
    }
}
