package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.dto.PtAddRequest;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fitlog.fitlog.notification.service.NotificationService;
import java.util.List;

@Service
public class PtContractService {

    private final PtContractRepository ptContractRepository;
    private final MemberRepository memberRepository;
    private final TrainerRepository trainerRepository;
    private final JwtService jwtService;
    private final NotificationService notificationService;

    public PtContractService(PtContractRepository ptContractRepository,
                             MemberRepository memberRepository,
                             TrainerRepository trainerRepository,
                             JwtService jwtService,
                             NotificationService notificationService) {
        this.ptContractRepository = ptContractRepository;
        this.memberRepository = memberRepository;
        this.trainerRepository = trainerRepository;
        this.jwtService = jwtService;
        this.notificationService=notificationService;
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
        contract.setStartDate(request.getStartDate());
        contract.setEndDate(request.getEndDate());
        contract.setMemo(request.getMemo());
        ptContractRepository.save(contract);

        notificationService.sendNotification(
                member.getUser(),
                "PT_ADD",
                "트레이너가 PT " + request.getSessions() + "회를 추가했어요. 현재 잔여 " + member.getPtRemaining() + "회",
                "PT",
                member.getId()
        );

        // members 테이블 누적 업데이트
        int prevTotal = member.getPtTotal() != null ? member.getPtTotal() : 0;
        int prevRemaining = member.getPtRemaining() != null ? member.getPtRemaining() : 0;

        member.setPtTotal(prevTotal + request.getSessions());
        member.setPtRemaining(prevRemaining + request.getSessions());

        // 시작일: 기존에 없으면 세팅, 있으면 유지
        if (member.getPtStartDate() == null || member.getPtStartDate().isEmpty()) {
            member.setPtStartDate(request.getStartDate());
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
}