package com.fitlog.fitlog.notification.scheduler;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notification.service.NotificationService;
import com.fitlog.fitlog.schedule.entity.Schedule;
import com.fitlog.fitlog.schedule.repository.ScheduleRepository;
import com.fitlog.fitlog.schedule.service.ScheduleService;
import com.fitlog.fitlog.trainer.entity.Trainer;
import com.fitlog.fitlog.trainer.repository.TrainerRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

@Component
public class NotificationScheduler {

    private final NotificationService notificationService;
    private final ScheduleRepository scheduleRepository;
    private final ScheduleService scheduleService;
    private final TrainerRepository trainerRepository;
    private final MemberRepository memberRepository;

    public NotificationScheduler(NotificationService notificationService,
                                 ScheduleRepository scheduleRepository,
                                 ScheduleService scheduleService,
                                 TrainerRepository trainerRepository,
                                 MemberRepository memberRepository) {
        this.notificationService = notificationService;
        this.scheduleRepository = scheduleRepository;
        this.scheduleService = scheduleService;
        this.trainerRepository = trainerRepository;
        this.memberRepository = memberRepository;
    }

    // 이미 알림 보낸 scheduleId 캐시 (서버 재시작 전까지 유지)
    private final Set<Long> reminderSentIds = new HashSet<>();

    // ─────────────────────────────────────────────────────────
    // 1. PT 30분 전 알림
    //    매 정각 실행 → 오늘 날짜 + 정확히 30분 후 시작하는 CONFIRMED 수업
    //    중복 방지: 이미 보낸 scheduleId는 reminderSentIds에 캐시
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 * * * * *", zone = "Asia/Seoul")
    public void sendPreSessionNotification() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
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

            if (member.getNotifSchedule()) {
                notificationService.sendNotification(
                        member.getUser(),
                        "SCHEDULE_REMINDER",
                        "30분 후 PT 수업이 시작돼요. 준비하세요.",
                        "SCHEDULE",
                        schedule.getId()
                );
            }

            reminderSentIds.add(schedule.getId());
        }
    }

    // ─────────────────────────────────────────────────────────
    // 3. 매주 월요일 오전 9시(KST) – 트레이너 다음 주 슬롯 자동 생성
    //    (슬롯 생성만, 회원 알림 없음 — 트레이너 전용 운영)
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 9 * * MON", zone = "Asia/Seoul")
    public void autoOpenNextWeekSchedules() {
        List<Trainer> allTrainers = trainerRepository.findAll();
        for (Trainer trainer : allTrainers) {
            try {
                scheduleService.autoOpenNextWeekIfNotOpen(trainer);
            } catch (Exception e) {
                System.err.println("[자동오픈] 트레이너 " + trainer.getId() + " 실패: " + e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 4. 매일 오전 9시(KST) – 생일 알림
    //    오늘 생일: 트레이너에게 "🎂 오늘은 OO님 생일이에요!"
    //    7일 후 생일: 트레이너에게 "🎁 7일 후 OO님 생일이에요!"
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void sendBirthdayNotifications() {
        ZoneId kst = ZoneId.of("Asia/Seoul");
        LocalDate today = LocalDate.now(kst);
        LocalDate weekLater = today.plusDays(7);

        // "MM-DD" 형식으로 비교 (연도 무시)
        String todayMD    = String.format("%02d-%02d", today.getMonthValue(), today.getDayOfMonth());
        String weekLaterMD = String.format("%02d-%02d", weekLater.getMonthValue(), weekLater.getDayOfMonth());

        List<Member> members = memberRepository.findAllWithBirthDate();

        for (Member member : members) {
            try {
                String bd = member.getBirthDate();
                if (bd == null || bd.length() < 10) continue;
                String memberMD = bd.substring(5); // "MM-DD"

                Trainer trainer = member.getTrainer();
                if (trainer == null) continue;

                // 생일 알림 설정 꺼진 트레이너 스킵
                if (!trainer.getNotifBirthday()) continue;

                String name = member.getUser().getName();

                if (memberMD.equals(todayMD)) {
                    notificationService.sendNotification(
                        trainer.getUser(),
                        "BIRTHDAY_TODAY",
                        "🎂 오늘은 " + name + "님 생일이에요.",
                        "MEMBER",
                        member.getId()
                    );
                } else if (memberMD.equals(weekLaterMD)) {
                    notificationService.sendNotification(
                        trainer.getUser(),
                        "BIRTHDAY_WEEK",
                        "🎁 7일 후 " + name + "님 생일이에요. 미리 준비해보세요.",
                        "MEMBER",
                        member.getId()
                    );
                }
            } catch (Exception e) {
                System.err.println("[생일알림] 회원 " + member.getId() + " 실패: " + e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 5. 매일 오전 9시(KST) – 무료 체험 D-1 알림
    //    trialEndDate = 내일인 FREE 플랜 트레이너에게 알림
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void sendTrialExpiryWarning() {
        LocalDate tomorrow = LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1);
        List<com.fitlog.fitlog.trainer.entity.Trainer> trainers =
            trainerRepository.findTrialExpiringTomorrow(tomorrow);

        for (com.fitlog.fitlog.trainer.entity.Trainer trainer : trainers) {
            try {
                if (trainer.getUser() == null) continue;
                notificationService.sendNotification(
                    trainer.getUser(),
                    "TRIAL_EXPIRY_WARNING",
                    "무료 체험이 내일 종료돼요. PRO로 구독하면 회원 무제한으로 계속 사용할 수 있어요.",
                    "GENERAL",
                    null
                );
            } catch (Exception e) {
                System.err.println("[체험만료경고] 트레이너 " + trainer.getId() + " 실패: " + e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 6. 12월 31일 오전 9시(KST) – 제휴 코드 교체 사전 안내
    //    "내일(1월 1일)부터 새 제휴 코드가 필요해요."
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 9 31 12 *", zone = "Asia/Seoul")
    public void sendGymRenewalWarning() {
        // 제휴 중인 트레이너 전체 (gymConfirmedAt != null)
        LocalDate jan1 = LocalDate.of(LocalDate.now(ZoneId.of("Asia/Seoul")).getYear(), 1, 1);
        List<Trainer> affiliatedTrainers = trainerRepository.findTrainersWithExpiredGymConfirmation(jan1.plusDays(1));
        // jan1.plusDays(1) → 올해 1월 2일 이전에 확인한 트레이너 = 아직 갱신 안 한 사람들 포함 전체
        // 사실상 gymConfirmedAt IS NOT NULL인 전체 조회
        List<Trainer> all = trainerRepository.findAll().stream()
            .filter(t -> t.getGymConfirmedAt() != null && t.getGym() != null)
            .toList();
        for (Trainer trainer : all) {
            try {
                if (trainer.getUser() == null) continue;
                notificationService.sendNotification(
                    trainer.getUser(),
                    "GYM_RENEWAL_WARNING",
                    "내일(1월 1일)부터 제휴 코드가 변경돼요. 헬스장에서 새 코드를 받아 앱에서 입력해주세요.",
                    "GENERAL",
                    null
                );
            } catch (Exception e) {
                System.err.println("[제휴갱신경고] 트레이너 " + trainer.getId() + " 실패: " + e.getMessage());
            }
        }
    }

    // ─────────────────────────────────────────────────────────
    // 6. 1월 1일 오전 0시(KST) – 이전 코드로 등록된 제휴 자동 해제
    //    (올해 1월 1일 이전에 확인한 트레이너 → 만료 처리)
    // ─────────────────────────────────────────────────────────
    @Scheduled(cron = "0 0 0 1 1 *", zone = "Asia/Seoul")
    @org.springframework.transaction.annotation.Transactional
    public void expireGymAffiliations() {
        LocalDate jan1 = LocalDate.of(LocalDate.now(ZoneId.of("Asia/Seoul")).getYear(), 1, 1);
        // gymConfirmedAt < 올해 1월 1일 → 작년 이전 코드로 등록된 트레이너
        List<Trainer> expiredTrainers = trainerRepository.findTrainersWithExpiredGymConfirmation(jan1);
        for (Trainer trainer : expiredTrainers) {
            try {
                trainer.setGym(null);
                trainer.setGymConfirmedAt(null);
                trainerRepository.save(trainer);
                if (trainer.getUser() != null) {
                    notificationService.sendNotification(
                        trainer.getUser(),
                        "GYM_RENEWAL_EXPIRED",
                        "제휴 코드가 새해 기준으로 초기화됐어요. 헬스장에서 새 코드를 받아 앱에서 입력해주세요.",
                        "GENERAL",
                        null
                    );
                }
            } catch (Exception e) {
                System.err.println("[제휴만료] 트레이너 " + trainer.getId() + " 실패: " + e.getMessage());
            }
        }
    }
}