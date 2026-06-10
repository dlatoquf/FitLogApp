# FitLog — 트레이너·회원 통합 헬스케어 플랫폼

> 트레이너와 회원이 함께 사용하는 운동·식단·일정 통합 관리 서비스

---

## 프로젝트 소개

퍼스널 트레이닝 현장에서 필요한 회원 관리, 일정 예약, 운동·식단·바디 기록, 결제까지
하나의 플랫폼에서 관리할 수 있도록 1인 풀스택으로 개발한 헬스케어 서비스입니다.

iOS · Android 크로스플랫폼 앱으로 제공되며, 트레이너와 회원이 각각 다른 화면과 권한으로 서비스를 이용합니다.

| 항목 | 내용 |
|------|------|
| 개발 기간 | 2026.04.27 ~ 2026.05.31 |
| 개발 인원 | 1인 풀스택 (백엔드·프론트엔드 전담) |
| 플랫폼 | iOS · Android 크로스플랫폼 |

---

## 기술 스택

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

## 지원 플랫폼

| 플랫폼 | 버전 |
|--------|------|
| iOS | 15.1 이상 |
| Android | API 26 (Android 8.0) 이상 |

- iPhone · iPad 모두 지원
- Android 태블릿 가로모드 지원

---

## 주요 기능

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

## 아키텍처

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

## 트러블슈팅

### 1. N+1 문제 해결

**문제**
회원 목록 조회 시 트레이너 1명당 연동된 회원 N명의 정보를 각각 개별 쿼리로 조회하면서 N+1 문제 발생. 회원 수가 늘어날수록 쿼리 수가 선형으로 증가해 응답 속도가 저하됨.

**원인**
JPA 연관관계에서 LAZY 로딩 설정으로 인해 연관 엔티티를 루프 안에서 접근할 때마다 추가 쿼리가 발생.

**해결**
- JOIN FETCH를 활용해 연관 데이터를 한 번의 쿼리로 조회하도록 개선
- 자주 조회되는 컬럼에 인덱스 추가
- 개선 후 다건 조회 시 쿼리 수를 N+1 → 1로 감소

---

### 2. OOM(Out Of Memory) 장애 대응

**문제**
운영 중 서버가 갑자기 응답 불가 상태가 되는 장애 발생. 재시작 후에도 일정 시간이 지나면 동일 증상 반복.

**원인**
로그 분석을 통해 이미지 업로드 처리 시 파일을 메모리에 전부 올린 뒤 S3로 전송하는 구조가 원인임을 확인. 다수의 요청이 몰릴 경우 Heap 메모리 초과로 OOM 발생.

**해결**
- MultipartFile을 메모리에 전부 적재하지 않고 스트리밍 방식으로 S3에 업로드하도록 로직 변경
- JVM Heap 사이즈 조정 및 EC2 인스턴스 메모리 설정 최적화
- 장애 재발 없이 안정적 운영 유지

---

## 기술 선택 이유

| 기술 | 선택 이유 |
|------|-----------|
| Spring Boot + JPA | 실무 경험 기반, REST API 설계 및 객체 중심 데이터 처리에 적합 |
| React Native (Expo) | iOS · Android 동시 지원이 필요했고, 단일 코드베이스로 유지보수 효율화 |
| AWS EC2 + RDS + S3 | 이미지 저장(S3), DB 분리(RDS), 서버 운영(EC2)을 역할별로 분리해 안정성 확보 |
| JWT + Spring Security | Stateless 인증으로 모바일 환경에 적합, 트레이너·회원 권한 분리 구현 |
| FCM | 무료로 iOS · Android 푸시 알림 동시 지원 가능 |

---

## 프로젝트 구조

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

## 실행 방법

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

## 배포

| 플랫폼 | 방식 |
|--------|------|
| iOS | Apple Developer Program → TestFlight → App Store |
| Android | Google Play Console → 내부 테스트 → 프로덕션 |
| Backend | AWS EC2 + Nginx |

---

## 개발 현황

- [x] 트레이너 · 회원 인증 및 권한 분리
- [x] PT 일정 관리 (월간 · 주간 캘린더)
- [x] 운동 · 식단 · 바디 기록
- [x] FCM 푸시 알림 · 인앱 알림
- [x] 카카오 로그인 · 카카오페이 결제
- [x] AWS 인프라 구성 (EC2, RDS, S3)
- [x] iOS · Android 테스트 배포
- [ ] App Store 정식 출시
- [ ] Android 정식 출시
