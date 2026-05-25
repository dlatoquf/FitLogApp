package com.fitlog.fitlog.trainer.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trainer/manual-members")
public class ManualMemberController {

    private final ManualMemberRepository manualMemberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;

    public ManualMemberController(ManualMemberRepository manualMemberRepository,
                                   TrainerRepository trainerRepository,
                                   JwtService jwtService) {
        this.manualMemberRepository = manualMemberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
    }

    // 미연동 회원 목록 조회
    @GetMapping
    public List<ManualMember> getAll(@RequestHeader("Authorization") String authorization) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));
        return manualMemberRepository.findByTrainerOrderByPtRemainingAsc(trainer);
    }

    // 미연동 회원 추가
    @PostMapping
    public ResponseEntity<ManualMember> create(
            @RequestHeader("Authorization") String authorization,
            @RequestBody Map<String, Object> body) {
        Long userId = jwtService.getUserIdFromToken(authorization.replace("Bearer ", ""));
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        ManualMember m = new ManualMember();
        m.setTrainer(trainer);
        m.setName((String) body.get("name"));
        if (body.get("phone") != null) m.setPhone((String) body.get("phone"));
        if (body.get("memo") != null) m.setMemo((String) body.get("memo"));
        if (body.get("ptTotal") != null) {
            int pt = ((Number) body.get("ptTotal")).intValue();
            m.setPtTotal(pt);
            m.setPtRemaining(pt);
        }

        return ResponseEntity.ok(manualMemberRepository.save(m));
    }

    // PT 추가 (잔여 + 전체 증가)
    @PutMapping("/{id}/pt")
    public ResponseEntity<ManualMember> addPt(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id,
            @RequestBody Map<String, Object> body) {
        ManualMember m = manualMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));
        int sessions = ((Number) body.get("sessions")).intValue();
        m.setPtTotal(m.getPtTotal() + sessions);
        m.setPtRemaining(m.getPtRemaining() + sessions);
        return ResponseEntity.ok(manualMemberRepository.save(m));
    }

    // 미연동 회원 삭제
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long id) {
        manualMemberRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
