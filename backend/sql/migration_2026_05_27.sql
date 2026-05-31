-- 2026-05-27 회원 연결해제 추적 + PT 만료 추적 컬럼 추가
-- 터미널에서 MySQL 접속 후 실행
--
-- disconnected_at     : 연결 해제일. 이전 트레이너가 기록을 열람할 수 있는 기준일.
-- previous_trainer_id : 회원이 새 트레이너로 이동했을 때 저장되는 이전 트레이너 ID.
--                       이 값이 있어야 이전 트레이너 회원 목록에 "이동" 뱃지로 계속 노출됨.
-- pt_ended_at         : PT 잔여 횟수가 0회가 된 날짜.
--                       이 날로부터 7일 후 스케줄러가 자동으로 INACTIVE 전환.
--                       재등록(ptRemaining > 0) 시 NULL로 초기화됨.

ALTER TABLE members
    ADD COLUMN disconnected_at      DATE   NULL COMMENT '연결 해제일 (이전 트레이너 기록 열람 기준)',
    ADD COLUMN previous_trainer_id  BIGINT NULL COMMENT '이전 트레이너 ID (타 트레이너 이동 추적용)',
    ADD COLUMN pt_ended_at          DATE   NULL COMMENT 'PT 잔여 0회가 된 날짜 (7일 후 INACTIVE 자동 전환 기준)';
