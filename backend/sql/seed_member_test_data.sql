-- ============================================================
-- 회원 관리 화면 확인용 테스트 데이터
-- 실행 전: @trainer_id 를 실제 트레이너 ID로 바꾸거나
--          아래 SET 구문이 자동으로 첫 번째 트레이너를 사용함
-- ============================================================

SET @trainer_id = (SELECT id FROM trainers ORDER BY id LIMIT 1);

-- ── 미연동 회원 (manual_members) ──────────────────────────────

-- 1. 활성 · 잔여 많음 (파란색 표시)
INSERT INTO manual_members (trainer_id, name, phone, pt_total, pt_remaining, amount, payment_date, created_at)
VALUES (@trainer_id, '김민준', '010-1111-0001', 30, 22, 900000, '2026-04-01', NOW());

-- 2. 활성 · 잔여 중간 (노란색, 10회 미만)
INSERT INTO manual_members (trainer_id, name, phone, pt_total, pt_remaining, amount, payment_date, created_at)
VALUES (@trainer_id, '이서연', '010-1111-0002', 20, 7, 600000, '2026-03-15', NOW());

-- 3. 활성 · 잔여 적음 (빨간색, 5회 미만)
INSERT INTO manual_members (trainer_id, name, phone, pt_total, pt_remaining, amount, payment_date, created_at)
VALUES (@trainer_id, '박지훈', '010-1111-0003', 20, 3, 600000, '2026-02-20', NOW());

-- 4. PT 미등록 (PT 미등록 뱃지)
INSERT INTO manual_members (trainer_id, name, phone, pt_total, pt_remaining, amount, payment_date, created_at)
VALUES (@trainer_id, '최수아', '010-1111-0004', NULL, NULL, NULL, NULL, NOW());

-- ── 연동 회원 (members + users) — 비활성화 상태 확인용 ────────

-- 5. PT 종료 · 유예 4일째 (D-3 표시)
INSERT INTO users (email, password, name, role, created_at)
VALUES ('test_ptended@fitlog.test', 'dummy_hash', '정하윤', 'MEMBER', NOW());

SET @user5 = LAST_INSERT_ID();
INSERT INTO members (user_id, trainer_id, pt_total, pt_remaining, pt_ended_at, status)
VALUES (@user5, @trainer_id, 20, 0, DATE_SUB(CURDATE(), INTERVAL 4 DAY), 'ACTIVE');

-- 6. PT 종료 · 유예 6일째 (D-1 표시)
INSERT INTO users (email, password, name, role, created_at)
VALUES ('test_ptended2@fitlog.test', 'dummy_hash', '강도윤', 'MEMBER', NOW());

SET @user6 = LAST_INSERT_ID();
INSERT INTO members (user_id, trainer_id, pt_total, pt_remaining, pt_ended_at, status)
VALUES (@user6, @trainer_id, 15, 0, DATE_SUB(CURDATE(), INTERVAL 6 DAY), 'ACTIVE');

-- 7. 연결 해제된 회원 (INACTIVE · 연결해제 뱃지)
INSERT INTO users (email, password, name, role, created_at)
VALUES ('test_inactive@fitlog.test', 'dummy_hash', '윤서준', 'MEMBER', NOW());

SET @user7 = LAST_INSERT_ID();
INSERT INTO members (user_id, trainer_id, pt_total, pt_remaining, disconnected_at, status)
VALUES (@user7, @trainer_id, 20, 8, DATE_SUB(CURDATE(), INTERVAL 3 DAY), 'INACTIVE');

-- ============================================================
-- 삽입 결과 확인
-- ============================================================
SELECT '=== 미연동 회원 ===' AS info;
SELECT id, name, pt_total, pt_remaining FROM manual_members WHERE trainer_id = @trainer_id ORDER BY id DESC LIMIT 10;

SELECT '=== 연동 회원 ===' AS info;
SELECT m.id, u.name, m.pt_total, m.pt_remaining, m.pt_ended_at, m.disconnected_at, m.status
FROM members m JOIN users u ON m.user_id = u.id
WHERE m.trainer_id = @trainer_id ORDER BY m.id DESC LIMIT 10;
