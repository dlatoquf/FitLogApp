-- 2026-05-28
-- 1) manual_members: PT 잔여 0회가 된 날짜 추가 (7일 유예 비활성화 기준)
-- 2) trainers: 1개월 무료 체험 종료일 추가
--
-- 터미널에서 MySQL 접속 후 실행:
--   mysql -u root -p fitlog < sql/migration_2026_05_28.sql

ALTER TABLE manual_members
    ADD COLUMN pt_ended_at DATE NULL COMMENT 'PT 잔여 0회가 된 날짜 (7일 후 비활성화 기준)';

ALTER TABLE trainers
    ADD COLUMN trial_end_date DATE NULL COMMENT '무료 체험 종료일 (이 날까지 PRO 기능 사용 가능)';

-- 기존 트레이너에게도 오늘부터 14일 무료 체험 부여
UPDATE trainers
SET trial_end_date = DATE_ADD(CURDATE(), INTERVAL 14 DAY)
WHERE trial_end_date IS NULL;
