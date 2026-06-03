package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.dto.PtAddRequest;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.workout.repository.WorkoutLogRepository;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class PtContractService {

    private final PtContractRepository ptContractRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;
    private final ManualMemberRepository manualMemberRepository;

    public PtContractService(PtContractRepository ptContractRepository,
                             MemberRepository memberRepository,
                             TrainerRepository trainerRepository,
                             JwtService jwtService,
                             NotificationService notificationService,
                             ManualMemberRepository manualMemberRepository) {
        this.ptContractRepository = ptContractRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.notificationService = notificationService;
        this.manualMemberRepository = manualMemberRepository;
    }

    // PT 추가 등록 (누적)
    @Transactional
    public void addPt(String authorization, Long memberId, PtAddRequest request) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보가 없습니다."));

        Member member = memberRepository.findByIdWithUser(memberId)
                .orElseThrow(() -> new RuntimeException("회원을 찾을 수 없습니다."));

        // pt_contracts 에 이력 추가
        PtContract contract = new PtContract();
        contract.setTrainer(trainer);
        contract.setMember(member);
        contract.setTotalSessions(request.getSessions());
        contract.setRemainSessions(request.getSessions());
        contract.setAmount(request.getAmount());
        contract.setEndDate(request.getEndDate());
        contract.setMemo(request.getMemo());

        // 결제 기준일 설정 (과거 건 등록 지원)
        java.time.LocalDate effectiveDate = java.time.LocalDate.now();
        if (request.getContractDate() != null && !request.getContractDate().isBlank()) {
            try {
                effectiveDate = java.time.LocalDate.parse(request.getContractDate());
            } catch (Exception ignored) { }
        }
        contract.setPaymentDate(effectiveDate);
        // start_date: 직접 입력값 우선, 없으면 payment_date 사용
        String startDate = (request.getStartDate() != null && !request.getStartDate().isBlank())
                ? request.getStartDate()
                : effectiveDate.toString();
        contract.setStartDate(startDate);

        ptContractRepository.save(contract);

        if (member.getNotifPtPayment()) {
            notificationService.sendNotification(
                    member.getUser(),
                    "PT_ADD",
                    "트레이너가 PT " + request.getSessions() + "회를 추가했어요. 현재 잔여 " + member.getPtRemaining() + "회.",
                    "PT",
                    member.getId()
            );
        }

        // members 테이블 누적 업데이트
        int prevTotal = member.getPtTotal() != null ? member.getPtTotal() : 0;
        int prevRemaining = member.getPtRemaining() != null ? member.getPtRemaining() : 0;

        member.setPtTotal(prevTotal + request.getSessions());
        member.setPtRemaining(prevRemaining + request.getSessions());

        // PT 추가 시 만료 카운트다운 초기화 (7일 비활성화 방지)
        member.setPtEndedAt(null);

        // 시작일: 기존에 없으면 세팅, 있으면 유지 (없으면 결제일로 자동 설정)
        if (member.getPtStartDate() == null || member.getPtStartDate().isEmpty()) {
            member.setPtStartDate(startDate);
        }

        // 만료일: 새로 입력한 값으로 업데이트
        if (request.getEndDate() != null && !request.getEndDate().isEmpty()) {
            member.setPtExpDate(request.getEndDate());
        }

        memberRepository.save(member);
    }

    // PT 계약 이력 조회
    public List<PtContract> getContracts(Long memberId) {
        return ptContractRepository.findByMemberId(memberId);
    }

    // 결제 메모 수정
    @Transactional
    public void updateMemo(Long contractId, String memo) {
        PtContract contract = ptContractRepository.findById(contractId)
                .orElseThrow(() -> new RuntimeException("계약 정보를 찾을 수 없습니다."));
        contract.setMemo(memo != null && !memo.isBlank() ? memo : null);
        ptContractRepository.save(contract);
    }

    // 결제 건 전체 수정 (수업수 / 금액 / 메모)
    @Transactional
    public void updateContract(Long contractId, Map<String, Object> body) {
        PtContract contract = ptContractRepository.findById(contractId)
                .orElseThrow(() -> new RuntimeException("계약 정보를 찾을 수 없습니다."));

        // 수업 수 변경 → ptRemaining / ptTotal 차이만큼 조정
        if (body.containsKey("sessions") && body.get("sessions") != null) {
            int newSessions = ((Number) body.get("sessions")).intValue();
            int oldSessions = contract.getTotalSessions();
            int diff = newSessions - oldSessions;

            contract.setTotalSessions(newSessions);
            contract.setRemainSessions(Math.max(0, contract.getRemainSessions() + diff));

            // 연동 회원 ptTotal / ptRemaining 동기화
            Member member = contract.getMember();
            if (member != null) {
                member.setPtTotal(Math.max(0, (member.getPtTotal() != null ? member.getPtTotal() : 0) + diff));
                member.setPtRemaining(Math.max(0, (member.getPtRemaining() != null ? member.getPtRemaining() : 0) + diff));
                memberRepository.save(member);
            }
            // 미연동 회원 ptTotal / ptRemaining 동기화
            ManualMember manualMember = contract.getManualMember();
            if (manualMember != null) {
                manualMember.setPtTotal(Math.max(0, (manualMember.getPtTotal() != null ? manualMember.getPtTotal() : 0) + diff));
                manualMember.setPtRemaining(Math.max(0, (manualMember.getPtRemaining() != null ? manualMember.getPtRemaining() : 0) + diff));
                manualMemberRepository.save(manualMember);
            }
        }

        // 금액 수정
        if (body.containsKey("amount") && body.get("amount") != null) {
            contract.setAmount(((Number) body.get("amount")).longValue());
        }

        // 메모 수정
        if (body.containsKey("memo")) {
            String memo = (String) body.get("memo");
            contract.setMemo(memo != null && !memo.isBlank() ? memo : null);
        }

        ptContractRepository.save(contract);
    }
}