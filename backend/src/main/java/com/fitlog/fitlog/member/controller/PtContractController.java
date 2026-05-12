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
}