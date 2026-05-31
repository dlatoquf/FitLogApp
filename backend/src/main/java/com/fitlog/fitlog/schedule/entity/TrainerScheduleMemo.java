package com.fitlog.fitlog.schedule.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fitlog.fitlog.trainer.entity.Trainer;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 트레이너 월별 메모
 * 달력 화면에서 해당 달에 대한 메모를 저장함
 */
@Entity
@Table(
    name = "trainer_schedule_memos",
    uniqueConstraints = @UniqueConstraint(columnNames = {"trainer_id", "year_month"})
)
public class TrainerScheduleMemo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trainer_id", nullable = false)
    private Trainer trainer;

    @Column(name = "`year_month`", nullable = false, length = 7)
    private String yearMonth; // "YYYY-MM"

    @Column(columnDefinition = "TEXT")
    private String memo;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Trainer getTrainer() { return trainer; }
    public void setTrainer(Trainer trainer) { this.trainer = trainer; }
    public String getYearMonth() { return yearMonth; }
    public void setYearMonth(String yearMonth) { this.yearMonth = yearMonth; }
    public String getMemo() { return memo; }
    public void setMemo(String memo) { this.memo = memo; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
