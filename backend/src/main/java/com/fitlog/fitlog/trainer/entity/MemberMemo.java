package com.fitlog.fitlog.trainer.entity;

import com.fitlog.fitlog.member.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "member_memos")
public class MemberMemo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    // 연동 회원 (nullable)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    // 미연동 회원 (nullable)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manual_member_id")
    private ManualMember manualMember;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public Member getMember() { return member; }
    public void setMember(Member member) { this.member = member; }
    public ManualMember getManualMember() { return manualMember; }
    public void setManualMember(ManualMember manualMember) { this.manualMember = manualMember; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
