package com.fitlog.fitlog.member.controller;

import com.fitlog.fitlog.member.dto.PtAddRequest;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.service.PtContractService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trainer/members")
public class PtContractController {

    private final PtContractService ptContractService;

    public PtContractController(PtContractService ptContractService) {
        this.ptContractService = ptContractService;
    }

    //  PT 추가 등록
    // POST /api/trainer/members/{memberId}/pt/add
    @PostMapping("/{memberId}/pt/add")
    public ResponseEntity<Map<String, String>> addPt(
            @RequestHeader("Authorization") String authorization,
            @PathVariable Long memberId,
            @RequestBody PtAddRequest request) {
        ptContractService.addPt(authorization, memberId, request);
        return ResponseEntity.ok(Map.of("message", "PT가 추가됐어요."));
    }

    // PT 계약 이력 조회
    // GET /api/trainer/members/{memberId}/pt/contracts
    @GetMapping("/{memberId}/pt/contracts")
    public List<PtContract> getContracts(@PathVariable Long memberId) {
        return ptContractService.getContracts(memberId);
    }

    // 결제 메모 수정
    // PATCH /api/trainer/contracts/{contractId}/memo
    @PatchMapping("/contracts/{contractId}/memo")
    public ResponseEntity<Map<String, String>> updateMemo(
            @PathVariable Long contractId,
            @RequestBody Map<String, String> body) {
        ptContractService.updateMemo(contractId, body.get("memo"));
        return ResponseEntity.ok(Map.of("message", "메모가 수정됐어요."));
    }

    // 결제 건 전체 수정 (수업수 / 금액 / 메모)
    // PUT /api/trainer/members/contracts/{contractId}
    @PutMapping("/contracts/{contractId}")
    public ResponseEntity<Map<String, String>> updateContract(
            @PathVariable Long contractId,
            @RequestBody Map<String, Object> body) {
        ptContractService.updateContract(contractId, body);
        return ResponseEntity.ok(Map.of("message", "결제 내역이 수정됐어요."));
    }
}