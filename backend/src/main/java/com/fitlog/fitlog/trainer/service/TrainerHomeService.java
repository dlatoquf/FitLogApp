package com.fitlog.fitlog.trainer.service;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.dto.TrainerHomeResponse;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TrainerHomeService {

    private final TrainerRepository trainerRepository;
    private final ScheduleRepository scheduleRepository;
    private final JwtService jwtService;
    private final MemberRepository memberRepository;

    public TrainerHomeService(TrainerRepository trainerRepository,
                              ScheduleRepository scheduleRepository,
                              JwtService jwtService,
                              MemberRepository memberRepository) {
        this.trainerRepository = trainerRepository;
        this.scheduleRepository = scheduleRepository;
        this.jwtService = jwtService;
        this.memberRepository = memberRepository;
    }

    public TrainerHomeResponse getHome(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);

        Trainer trainer = trainerRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("트레이너 정보를 찾을 수 없습니다."));

        LocalDate today = LocalDate.now();

        int totalMembers = memberRepository.countByTrainer(trainer);

        List<Schedule> todaySchedules = scheduleRepository
                .findTodayPtWithMember(trainer, today);

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

        return new TrainerHomeResponse(
                trainer.getUser().getName(),
                totalMembers,
                todaySchedules.size(),
                0,
                todayPtList,
                trainer.getPlan() != null ? trainer.getPlan() : "FREE",
                trainer.getTrainerCode()
        );
    }
}