package com.fitlog.fitlog.trainer.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.PtContract;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.member.repository.PtContractRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.dto.TrainerHomeResponse;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TrainerHomeService {

    private final TrainerRepository trainerRepository;
    private final ScheduleRepository scheduleRepository;
    private final JwtService jwtService;
    private final MemberRepository memberRepository;
    private final PtContractRepository ptContractRepository;

    public TrainerHomeService(TrainerRepository trainerRepository,
                              ScheduleRepository scheduleRepository,
                              JwtService jwtService,
                              MemberRepository memberRepository,
                              PtContractRepository ptContractRepository) {
        this.trainerRepository = trainerRepository;
        this.scheduleRepository = scheduleRepository;
        this.jwtService = jwtService;
        this.memberRepository = memberRepository;
        this.ptContractRepository = ptContractRepository;
    }

    public TrainerHomeResponse getHome(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보를 찾을 수 없습니다."));

        LocalDate today = LocalDate.now();
        YearMonth thisMonth = YearMonth.from(today);
        LocalDate monthStart = thisMonth.atDay(1);
        LocalDate monthEnd = thisMonth.atEndOfMonth();

        int totalMembers = memberRepository.countByTrainer(trainer);

        // 오늘 PT 목록
        List<Schedule> todaySchedules = scheduleRepository.findTodayPtWithMember(trainer, today);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("HH:mm");
        List<TrainerHomeResponse.TodayPt> todayPtList = todaySchedules.stream()
                .filter(s -> s.getMember() != null)
                .map(s -> new TrainerHomeResponse.TodayPt(
                        s.getMember().getId(),
                        s.getMember().getUser().getName(),
                        s.getStartTime() != null ? s.getStartTime().format(fmt) : "",
                        s.getMember().getPtRemaining() != null ? s.getMember().getPtRemaining() : 0,
                        "COMPLETED".equals(s.getStatusStr())
                ))
                .collect(Collectors.toList());

        // 이번 달 수업 수
        int monthSessions = scheduleRepository.countMonthSessions(trainer, monthStart, monthEnd);

        // 오늘 노쇼 수
        int noShowCount = scheduleRepository.countNoShows(trainer, today);

        // 이번 달 매출 내역
        List<PtContract> monthContracts = ptContractRepository.findByTrainerAndCreatedAtBetween(
                trainer,
                monthStart.atStartOfDay(),
                monthEnd.atTime(23, 59, 59)
        );

        long monthRevenue = monthContracts.stream()
                .mapToLong(c -> c.getAmount() != null ? c.getAmount() : 0L)
                .sum();

        List<TrainerHomeResponse.MonthRevenueDetail> monthRevenueDetails = monthContracts.stream()
                .map(c -> new TrainerHomeResponse.MonthRevenueDetail(
                        c.getMember() != null ? c.getMember().getUser().getName() : "알 수 없음",
                        c.getTotalSessions(),
                        c.getAmount() != null ? c.getAmount() : 0L,
                        c.getMemo()
                ))
                .collect(Collectors.toList());

        return new TrainerHomeResponse(
                trainer.getId(),
                trainer.getUser().getName(),
                totalMembers,
                todaySchedules.size(),
                0,
                todayPtList,
                trainer.getPlan() != null ? trainer.getPlan() : "FREE",
                trainer.getTrainerCode(),
                trainer.getGoalSessions(),
                trainer.getGoalRevenue(),
                monthSessions,
                monthRevenue,
                monthRevenueDetails,
                noShowCount
        );
    }
}
