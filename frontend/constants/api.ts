/**
 * FitLog API 설정
 * 개발 환경에 맞게 API_URL을 수정하세요.
 */

// Cloudinary 설정
export const CLOUDINARY_CLOUD_NAME = "djb0wt8ov";
export const CLOUDINARY_UPLOAD_PRESET = "fitlog_upload";
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
/*자취방 */
export const API_URL = "http://192.168.0.106:8080";
export const ANALYTICS_URL = "http://192.168.0.106:8001";
/*카페 */
/*export const API_URL = "http://192.168.45.99:8080";*/
/*오ㅃㅏ집 */
/*export const API_URL = "http://192.168.219.155:8080";*/
/*본가*/
/*export const API_URL = "http://192.168.219.129:8080";*/
/*export const ANALYTICS_URL = "http://192.168.219.129:8001";*/
/*운영 서버*/
/*export const API_URL = "https://fitlog-api.duckdns.org";*/
/*개발 - 맥 로컬 (Android 에뮬레이터)*/
/*export const API_URL = "http://10.0.2.2:8080";*/

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
  // 식단
  diet: {
    me: "/api/diet/me",
    member: (memberId: number) => `/api/diet/member/${memberId}`,
    search: "/api/diet/search",
    log: "/api/diet/log",
    logDelete: (id: number) => `/api/diet/log/${id}`,
    feedback: "/api/diet/feedback",
    feedbackByMember: (memberId: number) =>
      `/api/diet/feedback/member/${memberId}`,
    myFeedbacks: "/api/diet/feedback",
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
  },
  // 결제
  payment: {
    packages: "/api/payment/packages",
    purchase: "/api/payment/purchase",
    history: "/api/payment/history",
  },
};
