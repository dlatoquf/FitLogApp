package com.fitlog.fitlog.notice.entity;

import com.fitlog.fitlog.member.entity.Member;
import com.fitlog.fitlog.trainer.entity.ManualMember;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "trainer_notices")
public class TrainerNotice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    // 연동 회원
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    // 미연동 회원
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manual_member_id")
    private ManualMember manualMember;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Column(name = "is_broadcast", nullable = false)
    private boolean broadcast = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public Member getMember() { return member; }
    public ManualMember getManualMember() { return manualMember; }
    public String getContent() { return content; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public void setMember(Member member) { this.member = member; }
    public void setManualMember(ManualMember manualMember) { this.manualMember = manualMember; }
    public void setContent(String content) { this.content = content; }
    public boolean isBroadcast() { return broadcast; }
    public void setBroadcast(boolean broadcast) { this.broadcast = broadcast; }
}
