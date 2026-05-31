-- 2026-05-28 (2차)
-- 연동 회원(members) 중 ptRemaining=0이지만 ptEndedAt 없는 기존 데이터 보정
-- → 오늘 날짜로 ptEndedAt 기록 (7일 유예 카운트다운 시작)

UPDATE members
SET pt_ended_at = CURDATE()
WHERE pt_remaining = 0
  AND pt_total > 0
  AND pt_ended_at IS NULL
  AND status = 'ACTIVE';
