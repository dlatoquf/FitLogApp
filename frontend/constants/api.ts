/**
 * FitLog API 설정
 *
 * [DEV / TEST]  로컬 맥에서 ./start-dev.sh 실행 후 아래 IP 사용
 * [PROD]        운영 배포 시 duckdns URL로 교체 후 Xcode Archive
 */

// ── DEV / TEST (로컬 개발 시 아래 주석 해제) ─────────────────────
//export const API_URL = "http://192.168.0.25:8080"; // 집 와이파이
//export const ANALYTICS_URL = "http://52.78.154.44:8001";

// ── PROD (운영 배포 시 활성화) ────────────────────────────────────
export const API_URL = "https://fitlog-api.duckdns.org";
export const ANALYTICS_URL = "http://52.78.154.44:8001";

// ── 기타 환경 ─────────────────────────────────────────────────────
// export const API_URL = "http://192.168.45.99:8080"; // 카페
// export const API_URL = "http://10.0.2.2:8080";      // Android 에뮬레이터

// ── 스토어 URL ─────────────────────────────────────────────────────
export const APP_STORE_URL = "https://apps.apple.com/app/fitlog/id6769366090";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.anonymous.FitLogApp";

// ── Cloudinary ─────────────────────────────────────────────────────
export const CLOUDINARY_CLOUD_NAME = "djb0wt8ov";
export const CLOUDINARY_UPLOAD_PRESET = "fitlog_upload";
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;

// ── 엔드포인트 ─────────────────────────────────────────────────────
export const ENDPOINTS = {
  auth: {
    kakao: "/api/auth/kakao",
  },
  profile: {
    trainer: "/api/profile/trainer",
    member: "/api/profile/member",
    me: "/api/me",
  },
  trainer: {
    members: "/api/trainer/members",
    memberDetail: (id: number) => `/api/trainer/members/${id}`,
    updatePt: (memberId: number) => `/api/trainer/members/${memberId}/pt`,
    home: "/api/trainer/home",
  },
  member: {
    me: "/api/member/me",
  },
  schedule: {
    calendar: "/api/schedule/calendar",
    slots: "/api/schedule/slots",
    generate: "/api/schedule/generate",
    requests: (slotId: number) => `/api/schedule/requests/${slotId}`,
    confirm: (scheduleId: number) => `/api/schedule/confirm/${scheduleId}`,
    request: (slotId: number) => `/api/schedule/request/${slotId}`,
  },
  diet: {
    photos: "/api/diet/photos",
    memberPhotos: (memberId: number) => `/api/diet/photos/member/${memberId}`,
    feedback: (photoId: number) => `/api/diet/photos/${photoId}/feedback`,
  },
  fitlog: {
    create: "/api/fitlog",
    list: "/api/fitlog",
    detail: (id: number) => `/api/fitlog/${id}`,
    byMember: (memberId: number) => `/api/fitlog/member/${memberId}`,
  },
  bodylog: {
    me: "/api/bodylog/me",
    create: "/api/bodylog",
    member: (memberId: number) => `/api/bodylog/member/${memberId}`,
    manual: (manualMemberId: number) => `/api/bodylog/manual/${manualMemberId}`,
    deleteManual: (logId: number) => `/api/bodylog/manual/${logId}`,
  },
  payment: {
    packages: "/api/payment/packages",
    purchase: "/api/payment/purchase",
    history: "/api/payment/history",
    deleteContract: (id: number) => `/api/payment/contracts/${id}`,
    penalty: (id: number) => `/api/payment/contracts/${id}/penalty`,
  },
};
