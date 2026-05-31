-- ============================================================
-- 제휴 헬스장 기능
-- ============================================================

CREATE TABLE gyms (
    gym_id      BIGINT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL COMMENT '헬스장명',
    affiliate_code VARCHAR(20) NOT NULL UNIQUE COMMENT '제휴 코드 (대문자)',
    email       VARCHAR(255) COMMENT '담당자 이메일 (갱신 안내용)',
    contract_end DATE NOT NULL COMMENT '계약 종료일 (1년 단위)',
    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE / EXPIRED',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) COMMENT='제휴 헬스장';

ALTER TABLE trainers
    ADD COLUMN gym_id           BIGINT NULL COMMENT '제휴 헬스장 FK',
    ADD COLUMN gym_confirmed_at DATE   NULL COMMENT '제휴 코드 마지막 확인일 (1년 갱신 기준)',
    ADD CONSTRAINT fk_trainer_gym
        FOREIGN KEY (gym_id) REFERENCES gyms(gym_id) ON DELETE SET NULL;
