-- ============================================================
-- FitLog Migration — 2026-05-25
-- ============================================================

-- 1. pt_contracts: 결제 기준일 컬럼 추가 (과거 건 등록 지원)
--    payment_date가 NULL이면 created_at 날짜 기준으로 매출 집계
ALTER TABLE pt_contracts
    ADD COLUMN payment_date DATE NULL COMMENT '결제 기준일 (NULL이면 등록일 기준)';

-- 2. diet_day_feedbacks 테이블 (아직 없다면 생성)
CREATE TABLE IF NOT EXISTS diet_day_feedbacks (
    id           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '하루 피드백 PK',
    member_id    BIGINT       NOT NULL               COMMENT '회원 FK (members.id)',
    trainer_id   BIGINT       NOT NULL               COMMENT '트레이너 FK (trainers.id)',
    trainer_name VARCHAR(100) NOT NULL               COMMENT '트레이너 이름 (탈퇴 후에도 표시용)',
    date         DATE         NOT NULL               COMMENT '피드백 대상 날짜',
    content      TEXT         NOT NULL               COMMENT '피드백 내용',
    created_at   DATETIME     NOT NULL DEFAULT NOW() COMMENT '작성 일시',
    PRIMARY KEY (id),
    UNIQUE KEY uq_diet_day_feedback (member_id, date),
    CONSTRAINT fk_diet_day_fb_member  FOREIGN KEY (member_id)  REFERENCES members  (id) ON DELETE CASCADE,
    CONSTRAINT fk_diet_day_fb_trainer FOREIGN KEY (trainer_id) REFERENCES trainers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. manual_members: 결제 금액 / 결제 기준일 컬럼 추가
ALTER TABLE manual_members
    ADD COLUMN amount BIGINT NULL COMMENT '결제 금액 (신규 회원 등록 시)';
ALTER TABLE manual_members
    ADD COLUMN payment_date DATE NULL COMMENT '결제 기준일 (NULL이면 등록일 기준)';

-- 5. Workout_Logs: 미연동 회원(앱 미설치 회원) 운동 로그 지원
--
--    [변경 전] member_id NOT NULL → 앱 연동 회원만 운동 로그 저장 가능
--    [변경 후] member_id NULL 허용 → 미연동 회원도 저장 가능
--
--    저장 방식:
--      · 연동 회원  → member_id = O,  manual_member_id = NULL
--      · 미연동 회원 → member_id = NULL, manual_member_id = O
--
--    연동 시 자동 이전:
--      회원이 앱 설치 후 트레이너 코드 입력(connect-trainer) 시,
--      manual_member_id → member_id 로 일괄 업데이트되어
--      과거 운동 기록이 회원 앱에서 전부 조회 가능해짐
--
--    ON DELETE SET NULL:
--      manual_members 행 삭제(연동 완료 후 자동 삭제) 시
--      해당 로그의 manual_member_id를 NULL로 처리
--      (이미 member_id로 이전된 상태이므로 데이터 손실 없음)

ALTER TABLE Workout_Logs
    MODIFY COLUMN member_id BIGINT NULL
        COMMENT '연동 회원 FK — 미연동 회원 로그는 NULL, 연동 후 채워짐';

ALTER TABLE Workout_Logs
    ADD COLUMN manual_member_id BIGINT NULL
        COMMENT '미연동 회원 FK (manual_members.id) — 연동 완료 후 NULL로 초기화됨',
    ADD CONSTRAINT fk_workout_manual_member
        FOREIGN KEY (manual_member_id)
            REFERENCES manual_members(id)
            ON DELETE SET NULL;  -- manual_members 삭제(연동 완료) 시 자동 NULL 처리

-- 3. diet_photo_feedbacks 테이블 (과거 코드 호환용, 데이터 없어도 됨)
CREATE TABLE IF NOT EXISTS diet_photo_feedbacks (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    diet_photo_id BIGINT       NOT NULL,
    trainer_id    BIGINT       NOT NULL,
    trainer_name  VARCHAR(100),
    content       TEXT         NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    CONSTRAINT fk_photo_fb_photo   FOREIGN KEY (diet_photo_id) REFERENCES diet_photos (id) ON DELETE CASCADE,
    CONSTRAINT fk_photo_fb_trainer FOREIGN KEY (trainer_id)    REFERENCES trainers   (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
