package com.fitlog.fitlog.member.service;

import com.fitlog.fitlog.auth.entity.User;
import com.fitlog.fitlog.auth.repository.UserRepository;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class DeletedMemberCleanupScheduler {

    private final UserRepository userRepository;
    private final MemberRepository memberRepository;
    private final MemberDeleteService memberDeleteService;

    public DeletedMemberCleanupScheduler(UserRepository userRepository,
                                         MemberRepository memberRepository,
                                         MemberDeleteService memberDeleteService) {
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
        this.memberDeleteService = memberDeleteService;
    }

    // 매일 새벽 3시에 실행 — 소프트 딜리트 후 7일 초과된 회원 완전 삭제
    @Scheduled(cron = "0 0 3 * * *")
    public void cleanupExpiredDeletedMembers() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(7);
        List<User> expiredUsers = userRepository.findUsersToHardDelete(cutoff);

        for (User user : expiredUsers) {
            memberRepository.findByUserId(user.getId()).ifPresent(member -> {
                try {
                    memberDeleteService.hardDeleteMember(member);
                    System.out.println("완전 삭제 완료: userId=" + user.getId());
                } catch (Exception e) {
                    System.err.println("완전 삭제 실패: userId=" + user.getId() + " - " + e.getMessage());
                }
            });
        }
    }
}
