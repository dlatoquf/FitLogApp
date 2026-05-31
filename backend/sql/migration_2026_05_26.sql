-- ============================================================
-- FitLog DB Migration — 2026-05-26
-- 1. 트레이너 월별 일정 메모 테이블 추가
-- ============================================================

-- 1. trainer_schedule_memos
--    트레이너가 달별로 작성하는 메모 (캘린더 화면 표시)
--    trainer_id + year_month 조합으로 UNIQUE (한 달에 메모 1개)
CREATE TABLE IF NOT EXISTS trainer_schedule_memos (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    trainer_id  BIGINT       NOT NULL,
    year_month  VARCHAR(7)   NOT NULL COMMENT 'YYYY-MM 형식',
    memo        TEXT,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_trainer_month (trainer_id, year_month),
    CONSTRAINT fk_schedule_memo_trainer
        FOREIGN KEY (trainer_id) REFERENCES trainers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='트레이너 월별 일정 메모';
