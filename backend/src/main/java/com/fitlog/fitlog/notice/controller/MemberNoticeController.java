package com.fitlog.fitlog.notice.controller;

import com.fitlog.fitlog.auth.service.JwtService;
import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.member.repository.MemberRepository;
import com.fitlog.fitlog.notice.entity.TrainerNotice;
import com.fitlog.fitlog.notice.repository.TrainerNoticeRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/member/notices")
public class MemberNoticeController {

    private final TrainerNoticeRepository noticeRepository;
    private final MemberRepository memberRepository;
    private final JwtService jwtService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public MemberNoticeController(TrainerNoticeRepository noticeRepository,
                                  MemberRepository memberRepository,
                                  JwtService jwtService) {
        this.noticeRepository = noticeRepository;
        this.memberRepository = memberRepository;
        this.jwtService = jwtService;
    }

    // GET /api/member/notices — 전체 목록 (최신순)
    @GetMapping
    public List<Map<String, Object>> getAll(@RequestHeader("Authorization") String authorization) {
        Member member = getMember(authorization);
        return noticeRepository.findByMemberIdOrderByCreatedAtDesc(member.getId())
                .stream().map(this::toMap).toList();
    }

    // GET /api/member/notices/latest — 최신 1개 (홈화면용)
    @GetMapping("/latest")
    public ResponseEntity<Map<String, Object>> getLatest(@RequestHeader("Authorization") String authorization) {
        Member member = getMember(authorization);
        List<TrainerNotice> list = noticeRepository.findTopByMemberIdOrderByCreatedAtDesc(
                member.getId(), PageRequest.of(0, 1));
        if (list.isEmpty()) return ResponseEntity.noContent().build();
        return ResponseEntity.ok(toMap(list.get(0)));
    }

    private Map<String, Object> toMap(TrainerNotice n) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", n.getId());
        m.put("content", n.getContent());
        m.put("createdAt", n.getCreatedAt() != null ? n.getCreatedAt().format(FMT) : null);
        return m;
    }

    private Member getMember(String authorization) {
        String token = authorization.replace("Bearer ", "");
        Long userId = jwtService.getUserIdFromToken(token);
        return memberRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("회원 정보가 없습니다."));
    }
}
