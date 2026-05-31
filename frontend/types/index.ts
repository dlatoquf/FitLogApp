/**
 * FitLog 앱 공통 타입 정의
 */

// ── 사용자 / 인증 ─────────────────────────────────────────────────────────────
export type UserRole = "TRAINER" | "MEMBER";

export interface AuthResponse {
  jwt: string;
  isNewUser: boolean;
  role: UserRole | null;
}

export interface TrainerProfile {
  id: number;
  name: string;
  gymName: string;
  workDays: string;   // "월,화,수,목,금"
  startTime: string;  // "09:00"
  endTime: string;    // "22:00"
  trainerCode: string;
  gymAffiliated?: boolean;       // 제휴 헬스장 연결 여부
  affiliatedGymName?: string;    // 제휴 헬스장명
  gymConfirmedAt?: string;       // 마지막 제휴 확인일 (YYYY-MM-DD)
}

export interface MemberProfile {
  id: number;
  name: string;
  phone: string;
  height?: number;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  ptRemaining?: number;
  ptTotal?: number;
  ptStartDate?: string;
  ptExpDate?: string;
  goal?: string;
  nextSchedule?: string;
  trainerId?: number;
  trainerName?: string;
}

// ── 회원 (트레이너 관점) ──────────────────────────────────────────────────────
export interface Member {
  id: number;
  user: { id: number; name: string };
  ptRemaining: number;
  ptTotal: number;
  ptStartDate?: string;
  ptExpDate?: string;
  goal?: string;
  memo?: string;
  status?: "ACTIVE" | "INACTIVE";
}

// ── 일정 ─────────────────────────────────────────────────────────────────────
export type SlotStatus = "OPEN" | "REQUESTED" | "CONFIRMED" | "MINE";

export interface Slot {
  id: number;
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:mm:ss"
  endTime: string;
  status: SlotStatus;
  memberName?: string;
  requests?: SlotRequest[];
}

export interface SlotRequest {
  id: number;
  member: {
    id: number;
    user: { id: number; name: string };
  };
}

// ── 식단 사진 ─────────────────────────────────────────────────────────────────
export interface DietPhotoFeedback {
  id: number;
  trainerName: string;
  content: string;
  createdAt: string;
}

export interface DietPhoto {
  id: number;
  date: string;
  photoUrl: string;
  cloudinaryPublicId?: string;
  label?: string;
  createdAt: string;
  feedbacks: DietPhotoFeedback[];
}

// ── 운동 / FitLog ─────────────────────────────────────────────────────────────
export interface ExerciseSet {
  setNumber: number;
  weight: number;
  reps: number;
}

export interface Exercise {
  id?: number;
  name: string;
  sets: ExerciseSet[];
}

export interface FitLog {
  id?: number;
  memberId: number;
  memberName?: string;
  date: string;
  exercises: Exercise[];
  memo?: string;
  createdAt?: string;
}

// ── 바디로그 ──────────────────────────────────────────────────────────────────
export interface BodyLog {
  id?: number;
  date: string;
  weight: number;
  bodyFat?: number;
  muscleMass?: number;
  note?: string;
}

// ── 결제 ─────────────────────────────────────────────────────────────────────
export interface PtPackage {
  id: number;
  name: string;
  sessions: number;
  price: number;
  recommended?: boolean;
}

export interface PaymentHistory {
  id: number;
  packageName: string;
  sessions: number;
  amount: number;
  paidAt: string;
  status: "PAID" | "CANCELLED" | "PENDING";
}

// ── 알림 ─────────────────────────────────────────────────────────────────────
export interface Notification {
  id: number;
  type: "FEEDBACK" | "SCHEDULE" | "PT_EXPIRY" | "GENERAL";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}