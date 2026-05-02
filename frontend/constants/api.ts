/**
 * FitLog API 설정
 * 개발 환경에 맞게 API_URL을 수정하세요.
 */
export const API_URL = "http://192.168.219.114:8080";

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
    feedbackByMember: (memberId: number) => `/api/diet/feedback/member/${memberId}`,
    myFeedbacks: "/api/diet/feedback/me",
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
