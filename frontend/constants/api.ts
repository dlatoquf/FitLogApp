/**
 * FitLog API 설정
 *
 * ─── 환경별 API_URL 설정 ───────────────────────────────────────────
 *  [DEV / TEST]  로컬 맥에서 백엔드 실행 시 현재 와이파이 IP로 변경
 *  [PROD]        운영 서버 배포 시 duckdns URL 사용 (기본값)
 * ──────────────────────────────────────────────────────────────────
 */

// ── 운영 (PROD) ───────────────────────────────────────────────────
export const API_URL = "https://fitlog-api.duckdns.org";
export const ANALYTICS_URL = "http://52.78.154.44:8001";

// ── 개발 / 테스트 (DEV / TEST) — 사용 시 위 항목 주석 처리 ────────
// 집
// export const API_URL = "http://192.168.0.182:8080";
// 카페
// export const API_URL = "http://192.168.45.99:8080";
// Android 에뮬레이터
// export const API_URL = "http://10.0.2.2:8080";
// export const ANALYTICS_URL = "http://localhost:8001";

// ── 스토어 URL ─────────────────────────────────────────────────────
export const APP_STORE_URL = "https://apps.apple.com/app/fitlog/id6769366090";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.anonymous.FitLogApp";

// ── Cloudinary ─────────────────────────────────────────────────────
export const CLOUDINARY_CLOUD_NAME = "djb0wt8ov";
export const CLOUDINARY_UPLOAD_PRESET = "fitlog_upload";
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

// ── 엔드포인트 ─────────────────────────────────────────────────────
export const ENDPOINTS = {
  // 인증
  auth: {
    kakao: "/api/auth/kakao",
  },
  // 프로필
  profile: {
    trainer: "/api/profile/trainer",
    member: "/api/profile/member",
    me: "/api/me",
  },
  // 트레이너
  trainer: {
    members: "/api/trainer/members",
    memberDetail: (id: number) => `/api/trainer/members/${id}`,
    updatePt: (memberId: number) => `/api/trainer/members/${memberId}/pt`,
    home: "/api/trainer/home",
  },
  // 회원
  member: {
    me: "/api/member/me",
  },
  // 일정
  schedule: {
    calendar: "/api/schedule/calendar",
    slots: "/api/schedule/slots",
    generate: "/api/schedule/generate",
    requests: (slotId: number) => `/api/schedule/requests/${slotId}`,
    confirm: (scheduleId: number) => `/api/schedule/confirm/${scheduleId}`,
    request: (slotId: number) => `/api/schedule/request/${slotId}`,
  },
  // 식단 사진 (Cloudinary 기반)
  diet: {
    photos: "/api/diet/photos",
    memberPhotos: (memberId: number) => `/api/diet/photos/member/${memberId}`,
    feedback: (photoId: number) => `/api/diet/photos/${photoId}/feedback`,
  },
  // FitLog
  fitlog: {
    create: "/api/fitlog",
    list: "/api/fitlog",
    detail: (id: number) => `/api/fitlog/${id}`,
    byMember: (memberId: number) => `/api/fitlog/member/${memberId}`,
  },
  // 바디로그
  bodylog: {
    me: "/api/bodylog/me",
    create: "/api/bodylog",
    member: (memberId: number) => `/api/bodylog/member/${memberId}`,
    manual: (manualMemberId: number) => `/api/bodylog/manual/${manualMemberId}`,
    deleteManual: (logId: number) => `/api/bodylog/manual/${logId}`,
  },
  // 결제
  payment: {
    packages: "/api/payment/packages",
    purchase: "/api/payment/purchase",
    history: "/api/payment/history",
    deleteContract: (id: number) => `/api/payment/contracts/${id}`,
    penalty: (id: number) => `/api/payment/contracts/${id}/penalty`,
  },
};
