package com.fitlog.fitlog.notification.scheduler;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.trainer.entity.Trainer;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

@Component
public class NotificationScheduler {

    private final NotificationService notificationService;
    private final ScheduleRepository scheduleRepository;

    public NotificationScheduler(NotificationService notificationService,
                                 ScheduleRepository scheduleRepository) {
        this.notificationService = notificationService;
        this.scheduleRepository = scheduleRepository;
    }

    // 이미 알림 보낸 scheduleId 캐시 (서버 재시작 전까지 유지)
    private final Set<Long> reminderSentIds = new HashSet<>();

    // ─────────────────────────────────────────────────────────
    // 1. PT 30분 전 알림
    //    매 정각 실행 → 오늘 날짜 + 정확히 30분 후 시작하는 CONFIRMED 수업
    //    중복 방지: 이미 보낸 scheduleId는 reminderSentIds에 캐시
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 * * * * *")
    public void sendPreSessionNotification() {
        LocalDate today = LocalDate.now();
        // 현재 분 기준으로 정확히 30분 후 시각 (초 무시)
        LocalTime target = LocalTime.now().plusMinutes(30).withSecond(0).withNano(0);
        // ±30초 허용 (예: 16:29:30 ~ 16:30:30 사이 실행됐을 때 17:00 수업 감지)
        LocalTime rangeFrom = target.minusSeconds(30);
        LocalTime rangeTo   = target.plusSeconds(30);

        List<Schedule> upcoming = scheduleRepository
                .findConfirmedSchedulesStartingBetween(today, rangeFrom, rangeTo);

        for (Schedule schedule : upcoming) {
            Member member = schedule.getMember();
            if (member == null) continue;

            // 이미 알림 보낸 수업이면 스킵
            if (reminderSentIds.contains(schedule.getId())) continue;

            notificationService.sendNotification(
                    member.getUser(),
                    "SCHEDULE_REMINDER",
                    "30분 후 PT 수업이 시작돼요! 준비하세요 💪",
                    "SCHEDULE",
                    schedule.getId()
            );

            reminderSentIds.add(schedule.getId());
        }
    }

    // ─────────────────────────────────────────────────────────
    // 2-A. 토요일 오전 10시 – 다음 주 미신청 회원 알림
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 10 * * SAT")
    public void sendSaturdayOpenSlotReminder() {
        sendOpenSlotReminderToUnbookedMembers();
    }

    // ─────────────────────────────────────────────────────────
    // 2-B. 일요일 오전 10시 – 토요일에 오픈한 슬롯이 있으면 한 번 더
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 10 * * SUN")
    public void sendSundayOpenSlotReminder() {
        LocalDate yesterday    = LocalDate.now().minusDays(1);
        LocalDateTime satStart = yesterday.atStartOfDay();
        LocalDateTime satEnd   = yesterday.atTime(23, 59, 59);

        boolean hasSaturdayOpenSlot = scheduleRepository
                .existsByOpenedAtBetween(satStart, satEnd);

        if (!hasSaturdayOpenSlot) return;

        sendOpenSlotReminderToUnbookedMembers();
    }

    // ─────────────────────────────────────────────────────────
    // 공통: 다음 주 오픈 슬롯 있는 트레이너의 회원 중
    //       아직 신청/확정 없는 회원에게 알림
    // ─────────────────────────────────────────────────────────
    private void sendOpenSlotReminderToUnbookedMembers() {
        LocalDate nextMonday = LocalDate.now().with(DayOfWeek.MONDAY).plusWeeks(1);
        LocalDate nextSunday = nextMonday.plusDays(6);

        List<Trainer> trainersWithOpenSlots = scheduleRepository
                .findTrainersWithOpenSlotsInRange(nextMonday, nextSunday);

        if (trainersWithOpenSlots.isEmpty()) return;

        for (Trainer trainer : trainersWithOpenSlots) {
            if (trainer.getMembers() == null || trainer.getMembers().isEmpty()) continue;

            Set<Long> bookedMemberIds = scheduleRepository
                    .findBookedMemberIdsByTrainerAndDateBetween(trainer, nextMonday, nextSunday);

            for (Member member : trainer.getMembers()) {
                if (bookedMemberIds.contains(member.getId())) continue;

                notificationService.sendNotification(
                        member.getUser(),
                        "SCHEDULE_OPEN",
                        "다음 주 수업 일정이 열려 있어요! 아직 신청 전이라면 지금 예약해보세요 📅",
                        "SCHEDULE_OPEN",
                        null
                );
            }
        }
    }
}