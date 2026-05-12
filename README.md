# 🏋️ FitLog — 트레이너·회원 통합 헬스케어 플랫폼

> 트레이너와 회원이 함께 사용하는 운동·식단·일정 통합 관리 서비스

---

## 📌 프로젝트 소개

퍼스널 트레이닝 현장에서 필요한 회원 관리, 일정 예약, 운동·식단·바디 기록, 결제까지
하나의 플랫폼에서 관리할 수 있도록 1인 풀스택으로 개발 중인 헬스케어 서비스입니다.

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Spring Boot, Java, MyBatis, REST API |
| Frontend | React Native |
| Database | MariaDB, MySQL |
| Infra | Linux |
| Tools | Git, Google Drive (문서 관리) |

---

## ✅ 주요 기능

- **회원/트레이너 관리** : 회원가입, 로그인, 권한별 기능 분리
- **일정·예약** : 트레이너-회원 간 PT 일정 등록 및 예약 관리
- **운동 기록** : 운동 종목·세트·무게·횟수 기록 및 이력 조회
- **식단 기록** : 식사별 음식 및 칼로리 기록 관리
- **바디 기록** : 체중·체지방·골격근량 등 신체 변화 기록
- **결제** : PG사 연동 결제 기능 (개발자 모드 테스트 완료)

---

## 📁 프로젝트 구조

```
FitLogApp/
├── backend/       # Spring Boot 백엔드
└── frontend/      # React Native 프론트엔드
```

---

## ⚙️ 실행 방법

### Backend
```bash
cd backend
./gradlew bootRun
```
> `application.properties`는 보안상 제외되어 있습니다.
> `application.properties.example`을 참고해 설정 후 실행하세요.

### Frontend
```bash
cd frontend
npm install
npx expo start
```
