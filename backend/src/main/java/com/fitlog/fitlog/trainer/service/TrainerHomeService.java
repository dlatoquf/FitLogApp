package com.fitlog.fitlog.trainer.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.dto.TrainerHomeResponse;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.ManualMemberRepository;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@Service
public class TrainerHomeService {

    private final TrainerRepository trainerRepository;
    private final ScheduleRepository scheduleRepository;
    private final JwtService jwtService;
    private final MemberRepository memberRepository;
    private final PtContractRepository ptContractRepository;
    private final ManualMemberRepository manualMemberRepository;

    public TrainerHomeService(TrainerRepository trainerRepository,
                              ScheduleRepository scheduleRepository,
                              JwtService jwtService,
                              MemberRepository memberRepository,
                              PtContractRepository ptContractRepository,
                              ManualMemberRepository manualMemberRepository) {
        this.trainerRepository = trainerRepository;
        this.scheduleRepository = scheduleRepository;
        this.jwtService = jwtService;
        this.memberRepository = memberRepository;
        this.ptContractRepository = ptContractRepository;
        this.manualMemberRepository = manualMemberRepository;
    }

    // 월별 계약 필터링 — payment_date 우선, 없으면 created_at 기준
    private List<PtContract> filterByMonth(List<PtContract> contracts, YearMonth ym) {
        LocalDate monthStart = ym.atDay(1);
        LocalDate monthEnd = ym.atEndOfMonth();
        return contracts.stream()
                .filter(c -> {
                    LocalDate effDate = c.getPaymentDate() != null
                            ? c.getPaymentDate()
                            : (c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate() : null);
                    if (effDate == null) return false;
                    return !effDate.isBefore(monthStart) && !effDate.isAfter(monthEnd);
                })
                .collect(Collectors.toList());
    }

    // 계약의 회원명 반환 (연동 or 미연동)
    private String contractMemberName(PtContract c) {
        if (c.getMember() != null) return c.getMember().getUser().getName();
        if (c.getManualMember() != null) return c.getManualMember().getName();
        return "알 수 없음";
    }

    // 특정 월 매출 조회
    @Transactional(readOnly = true)
    public Map<String, Object> getMonthRevenue(String authorization, String monthStr) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보를 찾을 수 없습니다."));

        ZoneId kst = ZoneId.of("Asia/Seoul");
        YearMonth ym = monthStr != null ? YearMonth.parse(monthStr) : YearMonth.now(kst);
        List<PtContract> allContracts = ptContractRepository.findAllByTrainerWithAll(trainer);
        List<PtContract> monthContracts = filterByMonth(allContracts, ym);

        long revenue = monthContracts.stream().mapToLong(c -> c.getAmount() != null ? c.getAmount() : 0L).sum();
        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("M/d");

        List<Map<String, Object>> details = new java.util.ArrayList<>();
        monthContracts.forEach(c -> {
            LocalDate effDate = c.getPaymentDate() != null
                    ? c.getPaymentDate()
                    : (c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate() : LocalDate.now());
            Map<String, Object> entry = new java.util.HashMap<>();
            entry.put("memberName", contractMemberName(c));
            entry.put("sessions", c.getTotalSessions());
            entry.put("amount", c.getAmount() != null ? c.getAmount() : 0L);
            entry.put("memo", c.getMemo());
            entry.put("date", effDate.format(dateFmt));
            entry.put("contractId", c.getId());
            entry.put("manualMemberId", c.getManualMember() != null ? c.getManualMember().getId() : null);
            details.add(entry);
        });

        details.sort((a, b) -> ((String) b.get("date")).compareTo((String) a.get("date")));

        Map<String, Object> result = new java.util.HashMap<>();
        result.put("month", ym.toString());
        result.put("monthRevenue", revenue);
        result.put("monthRevenueDetails", details);
        return result;
    }

    @Transactional(readOnly = true)
    public TrainerHomeResponse getHome(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보를 찾을 수 없습니다."));

        ZoneId kst = ZoneId.of("Asia/Seoul");
        LocalDate today = LocalDate.now(kst);
        YearMonth thisMonth = YearMonth.from(today);
        LocalDate monthStart = thisMonth.atDay(1);
        LocalDate monthEnd = thisMonth.atEndOfMonth();

        // 연동 회원 + 미연동 회원 합산 (OT 회원 제외 — OT는 체험 회원으로 별도 관리)
        int totalMembers = (int) (memberRepository.countByTrainer(trainer)
                + manualMemberRepository.countNonOtByTrainer(trainer));

        // 오늘 PT 목록 (연동 + 미연동 + OT 모두 포함)
        List<Schedule> todaySchedules = scheduleRepository.findTodayPtWithMember(trainer, today);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm");
        List<TrainerHomeResponse.TodayPt> todayPtList = todaySchedules.stream()
                .filter(s -> s.getMember() != null || s.getManualMember() != null)
                .map(s -> {
                    boolean isManual = s.getMember() == null && s.getManualMember() != null;
                    Long id = isManual ? s.getManualMember().getId() : s.getMember().getId();
                    String name = isManual ? s.getManualMember().getName() : s.getMember().getUser().getName();
                    int remaining = isManual
                            ? (s.getManualMember().getPtRemaining() != null ? s.getManualMember().getPtRemaining() : 0)
                            : (s.getMember().getPtRemaining() != null ? s.getMember().getPtRemaining() : 0);
                    String sessionType = s.getSessionType() != null ? s.getSessionType() : "PT";
                    return new TrainerHomeResponse.TodayPt(
                            s.getId(), id, name,
                            s.getStartTime() != null ? s.getStartTime().format(fmt) : "",
                            remaining,
                            "COMPLETED".equals(s.getStatusStr()),
                            isManual,
                            sessionType,
                            "NO_SHOW".equals(s.getStatusStr())
                    );
                })
                .collect(Collectors.toList());

        // 이번 달 수업 수
        int monthSessions = scheduleRepository.countMonthSessions(trainer, monthStart, monthEnd);

        // 이번 달 노쇼 수 (명시적 NO_SHOW 처리된 수업)
        int noShowCount = scheduleRepository.countNoShows(trainer, monthStart, monthEnd);

        // 이번 달 매출 — pt_contracts 통합 조회 (연동 + 미연동 모두)
        List<PtContract> allContracts = ptContractRepository.findAllByTrainerWithAll(trainer);
        List<PtContract> monthContracts = filterByMonth(allContracts, thisMonth);

        long monthRevenue = monthContracts.stream()
                .mapToLong(c -> c.getAmount() != null ? c.getAmount() : 0L)
                .sum();

        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("M/d");
        List<TrainerHomeResponse.MonthRevenueDetail> monthRevenueDetails = new java.util.ArrayList<>();
        monthContracts.forEach(c -> {
            LocalDate effDate = c.getPaymentDate() != null
                    ? c.getPaymentDate()
                    : (c.getCreatedAt() != null ? c.getCreatedAt().toLocalDate() : today);
            monthRevenueDetails.add(new TrainerHomeResponse.MonthRevenueDetail(
                    contractMemberName(c),
                    c.getTotalSessions(),
                    c.getAmount() != null ? c.getAmount() : 0L,
                    c.getMemo(),
                    effDate.format(dateFmt),
                    c.getId(),
                    c.getManualMember() != null ? c.getManualMember().getId() : null
            ));
        });

        // 유료 구독 또는 무료 체험 기간이면 PRO로 처리
        String effectivePlan = trainer.isProEffective() ? "PRO" : "FREE";

        // 무료 체험 중일 때만 trialEndDate 내려줌 (구독 전환 후엔 null)
        String trialEndDate = null;
        if (!"PRO".equals(trainer.getPlan()) && trainer.getTrialEndDate() != null
                && !java.time.LocalDate.now().isAfter(trainer.getTrialEndDate())) {
            trialEndDate = trainer.getTrialEndDate().toString();
        }

        return new TrainerHomeResponse(
                trainer.getId(),
                trainer.getUser().getName(),
                totalMembers,
                todaySchedules.size(),
                0,
                todayPtList,
                effectivePlan,
                trainer.getTrainerCode(),
                trainer.getGoalSessions(),
                trainer.getGoalRevenue(),
                monthSessions,
                monthRevenue,
                monthRevenueDetails,
                noShowCount,
                trialEndDate
        );
    }
}
