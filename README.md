# 🏋️ FitLog — 트레이너·회원 통합 헬스케어 플랫폼

> 트레이너와 회원이 함께 사용하는 운동·식단·일정 통합 관리 서비스

---

## 📌 프로젝트 소개

퍼스널 트레이닝 현장에서 필요한 회원 관리, 일정 예약, 운동·식단·바디 기록, 결제까지
하나의 플랫폼에서 관리할 수 있도록 1인 풀스택으로 개발 중인 헬스케어 서비스입니다.

iOS · Android 크로스플랫폼 앱으로 제공되며, 트레이너와 회원이 각각 다른 화면과 권한으로 서비스를 이용합니다.

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Spring Boot, Java, JPA, REST API |
| Frontend | React Native (Expo), TypeScript |
| Database | MariaDB |
| Infra | AWS EC2, AWS RDS, AWS S3, Nginx |
| 인증 | JWT, Spring Security |
| 알림 | Firebase Cloud Messaging (FCM) |
| 결제 | 카카오페이 PG 연동 |
| 소셜 로그인 | 카카오 로그인 |
| 배포 | iOS App Store (TestFlight), Google Play Store (내부 테스트) |
| Tools | Git, GitHub |

---

## 📱 지원 플랫폼

| 플랫폼 | 버전 |
|--------|------|
| iOS | 15.1 이상 |
| Android | API 26 (Android 8.0) 이상 |

- iPhone · iPad 모두 지원
- Android 태블릿 가로모드 지원

---

## ✅ 주요 기능

### 트레이너
- **회원 관리** : 연동 회원 · 미연동 회원(수동 등록) 통합 관리
- **일정 관리** : 월간 · 주간 캘린더, PT 슬롯 자동 생성 및 수동 일정 추가
- **운동 기록** : 회원별 PT 운동 로그 등록, 챌린지(미션) 등록
- **식단 피드백** : 회원 식단 사진 조회 및 피드백 작성
- **바디 기록** : 회원 체중·체지방·골격근량 등 신체 변화 기록 및 그래프
- **PT 관리** : PT 횟수 등록·차감·잔여 관리
- **알림** : 신규 회원 연결, 수업 신청, 생일 알림 등 FCM 푸시 + 인앱 알림
- **공지사항** : 전체 회원 대상 공지 발송

### 회원
- **홈** : 오늘 수업 확인, 주간 운동 현황, PT 잔여 횟수
- **운동 기록** : 개인 운동 로그 작성 및 트레이너 피드백 확인
- **식단 기록** : 식사별 사진 업로드 및 트레이너 피드백 확인
- **바디 기록** : 신체 변화 기록 및 성장 그래프
- **일정** : 수업 예약 신청 및 확정 일정 확인
- **알림** : 수업 확정·취소, 운동 로그 등록, 30분 전 수업 알림 등

---

## 🏗 아키텍처

```
[iOS / Android 앱]
        │
        ▼
[REST API — Spring Boot]
        │
   ┌────┴────┐
   │         │
[AWS RDS]  [AWS S3]
(MariaDB)  (이미지 저장)
```

- 백엔드는 AWS EC2에서 운영, Nginx 리버스 프록시 구성
- 이미지(식단 사진, 바디 사진 등)는 AWS S3에 저장
- DB는 AWS RDS (MariaDB) 사용

---

## 📁 프로젝트 구조

```
FitLogApp/
├── backend/                  # Spring Boot 백엔드
│   └── src/main/java/
│       └── com/fitlog/
│           ├── auth/         # 인증 (JWT, 카카오 로그인)
│           ├── member/       # 회원
│           ├── trainer/      # 트레이너
│           ├── schedule/     # 일정
│           ├── workout/      # 운동 기록
│           ├── diet/         # 식단
│           ├── notification/ # 알림 (FCM)
│           └── mission/      # 챌린지
└── frontend/                 # React Native (Expo)
    ├── app/
    │   ├── (tabs)/
    │   │   ├── trainer/      # 트레이너 화면
    │   │   └── member/       # 회원 화면
    │   └── onboarding/       # 온보딩
    ├── components/           # 공통 컴포넌트
    ├── constants/            # 상수 (API URL, 색상 등)
    └── assets/               # 이미지, 폰트
```

---

## ⚙️ 실행 방법

### Backend

```bash
cd backend
./gradlew bootRun
```

> `application.properties`는 보안상 제외되어 있습니다.
> `application.properties.example`을 참고해 환경변수 설정 후 실행하세요.

필요한 환경변수:
- DB 연결 정보 (AWS RDS)
- JWT Secret Key
- AWS S3 Access Key / Secret Key
- Firebase FCM 서비스 계정 키
- 카카오 API Key

### Frontend

```bash
cd frontend
npm install

# 개발 서버 실행
npx expo start

# iOS 빌드 (시뮬레이터)
npx expo run:ios

# iOS 빌드 (실기기)
npx expo run:ios --device

# Android 빌드
npx expo run:android
```

> `google-services.json` (Android FCM) 및 `GoogleService-Info.plist` (iOS FCM)는
> 보안상 제외되어 있습니다. Firebase 콘솔에서 발급 후 각 경로에 추가하세요.

---

## 🚀 배포

| 플랫폼 | 방식 |
|--------|------|
| iOS | Apple Developer Program → TestFlight → App Store |
| Android | Google Play Console → 내부 테스트 → 프로덕션 |
| Backend | AWS EC2 + Nginx |

---

## 📝 개발 현황

- [x] 트레이너 · 회원 인증 및 권한 분리
- [x] PT 일정 관리 (월간 · 주간 캘린더)
- [x] 운동 · 식단 · 바디 기록
- [x] FCM 푸시 알림 · 인앱 알림
- [x] 카카오 로그인 · 카카오페이 결제
- [x] AWS 인프라 구성 (EC2, RDS, S3)
- [x] iOS · Android 테스트 배포
- [ ] App Store 정식 출시
