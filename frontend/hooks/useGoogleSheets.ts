import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/api";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";
const SPREADSHEET_ID_KEY = "google_sheets_spreadsheet_id";

// 토큰 갱신은 Web 클라이언트로 처리 (expo-auth-session/providers/google가 web client로 교환하므로)
const WEB_CLIENT_ID = "419852916314-pendk3p11p1eam9acjulj9gclraheejv.apps.googleusercontent.com";
const WEB_CLIENT_SECRET = "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";

// ── DB 연동 헬퍼 ──────────────────────────────────────────────────────────────

async function getJwt(): Promise<string | null> {
  return AsyncStorage.getItem("jwt");
}

/** 연동 시: 토큰 + spreadsheetId를 DB에 저장 */
export async function saveSheetConfigToDB(token: string, spreadsheetId: string): Promise<void> {
  try {
    const jwt = await getJwt();
    await fetch(`${API_URL}/api/trainer/sheets-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ token, spreadsheetId }),
    });
  } catch (e) {
    console.log("[Sheets] DB 저장 실패:", e);
  }
}

/** 해제 시: DB에서 삭제 */
export async function deleteSheetConfigFromDB(): Promise<void> {
  try {
    const jwt = await getJwt();
    await fetch(`${API_URL}/api/trainer/sheets-config`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
    });
  } catch (e) {
    console.log("[Sheets] DB 삭제 실패:", e);
  }
}

/** 앱 시작 시: DB에서 토큰 복원 → AsyncStorage에 세팅 */
export async function restoreSheetConfigFromDB(): Promise<boolean> {
  try {
    const jwt = await getJwt();
    if (!jwt) return false;

    const res = await fetch(`${API_URL}/api/trainer/sheets-config`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return false;

    const data = await res.json();
    if (!data.connected || !data.token) return false;

    // 토큰만 복원 — 갱신은 실제 API 호출 시 getToken()이 자동 처리
    await AsyncStorage.setItem("google_sheets_token", data.token);
    // 만료 시간이 없으면 즉시 만료로 세팅해서 다음 getToken() 호출 시 갱신하도록
    const existingExpiry = await AsyncStorage.getItem("google_sheets_token_expiry");
    if (!existingExpiry) {
      await AsyncStorage.setItem("google_sheets_token_expiry", String(Date.now() - 1));
    }
    if (data.spreadsheetId) {
      await AsyncStorage.setItem(SPREADSHEET_ID_KEY, data.spreadsheetId);
    }

    console.log("[Sheets] DB에서 토큰 복원 완료");
    return true;
  } catch (e) {
    console.log("[Sheets] DB 복원 실패:", e);
    return false;
  }
}

// ── 토큰 갱신 ────────────────────────────────────────────────────────────────

async function refreshGoogleTokenWith(currentToken: string): Promise<string | null> {
  // refresh_token이 있으면 갱신, 없으면 null
  const refreshToken = await AsyncStorage.getItem("google_sheets_refresh_token");
  if (!refreshToken) return null;
  return refreshGoogleToken();
}

async function refreshGoogleToken(): Promise<string | null> {
  try {
    const refreshToken = await AsyncStorage.getItem("google_sheets_refresh_token");
    if (!refreshToken) return null;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `client_id=${WEB_CLIENT_ID}&client_secret=${WEB_CLIENT_SECRET}&refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`,
    });
    if (!res.ok) {
      // 유효하지 않은 리프레시 토큰 → 삭제해서 다음 시도 방지
      await AsyncStorage.removeItem("google_sheets_refresh_token");
      console.log("[Sheets] 리프레시 토큰 무효 → 삭제");
      return null;
    }

    const data = await res.json();
    if (!data.access_token) return null;

    const newToken = data.access_token;
    await AsyncStorage.setItem("google_sheets_token", newToken);
    await AsyncStorage.setItem("google_sheets_token_expiry", String(Date.now() + 3500 * 1000));

    // 갱신된 토큰 DB에도 업데이트
    const spreadsheetId = await AsyncStorage.getItem(SPREADSHEET_ID_KEY) ?? "";
    await saveSheetConfigToDB(newToken, spreadsheetId);

    console.log("[Sheets] 토큰 자동 갱신 성공");
    return newToken;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem("google_sheets_token");
  const expiry = await AsyncStorage.getItem("google_sheets_token_expiry");

  // 만료 10분 전부터 미리 갱신
  if (expiry && Date.now() > Number(expiry) - 10 * 60 * 1000) {
    console.log("[Sheets] 토큰 만료 임박, 자동 갱신 시도...");
    const newToken = await refreshGoogleToken();
    if (newToken) return newToken;
  }
  return token;
}

async function authHeaders() {
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// 스프레드시트 ID 가져오거나 새로 생성
async function getOrCreateSpreadsheet(trainerName = "트레이너"): Promise<string> {
  const cached = await AsyncStorage.getItem(SPREADSHEET_ID_KEY);
  if (cached) return cached;

  const headers = await authHeaders();
  const res = await fetch(SHEETS_API, {
    method: "POST",
    headers,
    body: JSON.stringify({
      properties: { title: `FitLog_${trainerName}트레이너` },
      sheets: [
        { properties: { title: "Sheet1" } },
      ],
    }),
  });
  const data = await res.json();
  if (!data.spreadsheetId) throw new Error("스프레드시트 생성 실패");
  const id = data.spreadsheetId;

  // ← ID를 AsyncStorage에 저장해야 다음에 재사용 가능
  await AsyncStorage.setItem(SPREADSHEET_ID_KEY, id);

  return id;
}

// 연동 직후 스프레드시트 초기화 + Sheet1 제거 + DB에 ID 저장
export async function initializeSpreadsheet(trainerName: string): Promise<string | null> {
  try {
    const id = await getOrCreateSpreadsheet(trainerName);
    const authHead = await authHeaders();

    // Sheet1 / _temp 정리 (혹시 남아있을 경우)
    const infoRes = await fetch(`${SHEETS_API}/${id}`, { headers: authHead });
    const info = await infoRes.json();
    const allSheets: any[] = info.sheets ?? [];
    const toDelete = allSheets.filter((s: any) =>
      ["Sheet1", "_temp"].includes(s.properties.title)
    );

    if (toDelete.length > 0 && toDelete.length < allSheets.length) {
      // 삭제할 시트 외에 다른 시트가 있으면 바로 삭제
      await fetch(`${SHEETS_API}/${id}:batchUpdate`, {
        method: "POST", headers: authHead,
        body: JSON.stringify({
          requests: toDelete.map((s: any) => ({ deleteSheet: { sheetId: s.properties.sheetId } })),
        }),
      });
    } else if (toDelete.length > 0 && toDelete.length === allSheets.length) {
      // 모든 시트가 삭제 대상이면 → 더미 시트 먼저 추가 후 삭제 (Google 제약)
      const addRes = await fetch(`${SHEETS_API}/${id}:batchUpdate`, {
        method: "POST", headers: authHead,
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "시트1" } } }] }),
      });
      const addData = await addRes.json();
      const newSheetId = addData.replies?.[0]?.addSheet?.properties?.sheetId;
      // Sheet1 + _temp 삭제
      await fetch(`${SHEETS_API}/${id}:batchUpdate`, {
        method: "POST", headers: authHead,
        body: JSON.stringify({
          requests: toDelete.map((s: any) => ({ deleteSheet: { sheetId: s.properties.sheetId } })),
        }),
      });
      // 더미 시트도 삭제 (다른 시트가 생기면)
      if (newSheetId !== undefined) {
        const info3 = await (await fetch(`${SHEETS_API}/${id}`, { headers: authHead })).json();
        if ((info3.sheets?.length ?? 0) > 1) {
          await fetch(`${SHEETS_API}/${id}:batchUpdate`, {
            method: "POST", headers: authHead,
            body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: newSheetId } }] }),
          });
        }
      }
    }

    // 토큰도 함께 DB 업데이트 (spreadsheetId 포함)
    const token = await AsyncStorage.getItem("google_sheets_token") ?? "";
    await saveSheetConfigToDB(token, id);
    return id;
  } catch (e) {
    console.log("스프레드시트 초기화 실패:", e);
    return null;
  }
}

// 시트(탭) 존재 여부 확인 후 없으면 생성
async function getOrCreateSheet(spreadsheetId: string, sheetTitle: string, headers: string[]) {
  const authHead = await authHeaders();

  const infoRes = await fetch(`${SHEETS_API}/${spreadsheetId}`, { headers: authHead });
  const info = await infoRes.json();
  const exists = info.sheets?.some((s: any) => s.properties.title === sheetTitle);

  if (!exists) {
    // 시트 생성
    await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: authHead,
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetTitle } } }],
      }),
    });
    // 헤더 행 추가
    await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle + "!A1")}:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: authHead,
        body: JSON.stringify({ values: [headers] }),
      }
    );

    // 새 시트 헤더 포맷 적용
    const newSheetId = await getSheetId(spreadsheetId, sheetTitle);
    if (newSheetId !== null) {
      await applyTableFormatting(spreadsheetId, newSheetId, headers.length, 1);
    }
  }
}

// 시트 ID 조회 (sheetTitle로 numeric sheetId 반환)
async function getSheetId(spreadsheetId: string, sheetTitle: string): Promise<number | null> {
  const authHead = await authHeaders();
  const res = await fetch(`${SHEETS_API}/${spreadsheetId}`, { headers: authHead });
  const info = await res.json();
  const sheet = info.sheets?.find((s: any) => s.properties.title === sheetTitle);
  return sheet?.properties?.sheetId ?? null;
}

// 헤더 볼드+배경색, 첫 행 고정, 전체 테두리 적용
async function applyTableFormatting(
  spreadsheetId: string,
  sheetId: number,
  numCols: number,
  numRows: number // 헤더 포함 전체 행 수
) {
  const authHead = await authHeaders();
  const requests: any[] = [
    // 첫 행 고정
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    // 헤더 볼드 + 배경색 (#2E7D32 짙은 초록, 텍스트 흰색)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.18, green: 0.49, blue: 0.20 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
            horizontalAlignment: "CENTER",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
      },
    },
    // 전체 데이터 영역 테두리
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
        top: { style: "SOLID", width: 1 },
        bottom: { style: "SOLID", width: 1 },
        left: { style: "SOLID", width: 1 },
        right: { style: "SOLID", width: 1 },
        innerHorizontal: { style: "SOLID", width: 1 },
        innerVertical: { style: "SOLID", width: 1 },
      },
    },
    // 데이터 행 글씨 크기 11
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: 0, endColumnIndex: numCols },
        cell: { userEnteredFormat: { textFormat: { fontSize: 11 } } },
        fields: "userEnteredFormat.textFormat.fontSize",
      },
    },
    // 메모/피드백 열 텍스트 줄바꿈 (numCols === 7일 때만)
    ...(numCols === 7 ? [{
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: numRows, startColumnIndex: 5, endColumnIndex: 7 },
        cell: { userEnteredFormat: { wrapStrategy: "WRAP" } },
        fields: "userEnteredFormat.wrapStrategy",
      },
    }] : []),
  ];

  const fmtRes = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: authHead,
    body: JSON.stringify({ requests }),
  });
  if (!fmtRes.ok) {
    const err = await fmtRes.json().catch(() => ({}));
    console.log("[Sheets] 포맷팅 실패:", JSON.stringify(err));
  }

  // 열 너비 고정 (운동일지: 날짜, 운동명, 세트, 무게, 횟수, 메모, 피드백)
  const colWidths = numCols === 5
    ? [110, 90, 130, 55, 100]
    : [110, 130, 50, 70, 60, 160, 160];

  const colRequests = colWidths.slice(0, numCols).map((px, i) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: i, endIndex: i + 1 },
      properties: { pixelSize: px },
      fields: "pixelSize",
    },
  }));

  await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: authHead,
    body: JSON.stringify({ requests: colRequests }),
  });
}

// 행 추가
async function appendRows(spreadsheetId: string, sheetTitle: string, rows: any[][]) {
  const authHead = await authHeaders();
  await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle + "!A1")}:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: authHead,
      body: JSON.stringify({ values: rows }),
    }
  );
}

// 운동일지 업로드 (회원 이름으로 시트 자동 생성)
export async function uploadWorkoutLog(params: {
  memberName: string;
  date: string;
  exercises: { name: string; sets: { setNumber: number; weight: number; reps: number }[] }[];
  memo?: string;
  feedback?: string;
}) {
  const token = await getToken();
  if (!token) return;

  try {
    const spreadsheetId = await getOrCreateSpreadsheet();
    const sheetTitle = params.memberName;
    const HEADERS = ["날짜", "운동명", "세트", "무게(kg)", "횟수", "메모", "피드백"];

    await getOrCreateSheet(spreadsheetId, sheetTitle, HEADERS);

    const rows: any[][] = [];
    params.exercises.forEach((ex) => {
      ex.sets.forEach((s, idx) => {
        rows.push([
          idx === 0 ? params.date : "",
          idx === 0 ? ex.name : "",
          s.setNumber,
          s.weight,
          s.reps,
          idx === 0 ? (params.memo ?? "") : "",
          idx === 0 ? (params.feedback ?? "") : "",
        ]);
      });
    });

    await appendRows(spreadsheetId, sheetTitle, rows);
  } catch (e) {
    console.log("Sheets 운동일지 업로드 실패:", e);
  }
}

// 매출 업로드 (2026 시트, 월 구분 헤더 자동 추가)
export async function uploadPayment(params: {
  memberName: string;
  packageName: string;
  sessions: number;
  amount: number;
  date: string; // YYYY-MM-DD
}) {
  const token = await getToken();
  if (!token) return;

  try {
    const spreadsheetId = await getOrCreateSpreadsheet();
    const year = params.date.slice(0, 4);
    const sheetTitle = `${year}_매출표`;
    const HEADERS = ["날짜", "회원명", "패키지", "횟수", "금액(원)"];

    await getOrCreateSheet(spreadsheetId, sheetTitle, HEADERS);

    const authHead = await authHeaders();

    // 현재 시트 내용 가져와서 월 헤더 필요한지 확인
    const rangeRes = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle + "!A:A")}`,
      { headers: authHead }
    );
    const rangeData = await rangeRes.json();
    const existingValues: string[] = (rangeData.values ?? []).flat();

    const month = params.date.slice(0, 7); // YYYY-MM
    const monthLabel = `${params.date.slice(0, 4)}년 ${parseInt(params.date.slice(5, 7))}월`;
    const monthExists = existingValues.some((v) => v === monthLabel);

    const rows: any[][] = [];
    if (!monthExists) {
      rows.push([monthLabel, "", "", "", ""]);
    }
    rows.push([params.date, params.memberName, params.packageName, params.sessions, params.amount]);

    await appendRows(spreadsheetId, sheetTitle, rows);
  } catch (e) {
    console.log("Sheets 매출 업로드 실패:", e);
  }
}

// 기존 데이터 전체 동기화
export async function syncAllData(trainerName = "트레이너"): Promise<{ success: boolean; message: string }> {
  const token = await getToken();
  console.log("[Sheets] syncAllData 시작, token:", token ? token.slice(0, 20) + "..." : "없음");
  if (!token) return { success: false, message: "연동이 필요해요." };

  const jwt = await AsyncStorage.getItem("jwt");
  const headers = { Authorization: `Bearer ${jwt}` };

  try {
    const spreadsheetId = await getOrCreateSpreadsheet(trainerName);
    // 생성/조회한 spreadsheetId를 즉시 DB에도 저장
    await saveSheetConfigToDB(token, spreadsheetId);

    // 잘못된 시트 정리 ("회원", "Sheet1", "매출" 구버전)
    const authHead0 = await authHeaders();
    const infoRes0 = await fetch(`${SHEETS_API}/${spreadsheetId}`, { headers: authHead0 });
    const info0 = await infoRes0.json();
    const badSheets = (info0.sheets ?? []).filter((s: any) =>
      ["회원", "Sheet1", "매출", "_temp"].includes(s.properties.title)
    );
    if (badSheets.length > 0) {
      await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: authHead0,
        body: JSON.stringify({
          requests: badSheets.map((s: any) => ({ deleteSheet: { sheetId: s.properties.sheetId } })),
        }),
      });
    }

    // 1. 매출 전체 동기화 (연도별 시트: YYYY_매출표)
    const paymentRes = await fetch(`${API_URL}/api/payment/history`, { headers });
    console.log("[Sheets] payment API 응답 상태:", paymentRes.status);
    if (paymentRes.ok) {
      const payments: any[] = await paymentRes.json();
      console.log("[Sheets] 결제 건수:", payments.length, JSON.stringify(payments.slice(0,2)));

      if (payments.length > 0) {
        const authHead = await authHeaders();
        const PAYMENT_HEADERS = ["날짜", "회원명", "패키지", "횟수", "금액(원)"];
        const COL_W = 5; // 월별 표 컬럼 수
        const COL_GAP = 1; // 월 사이 빈 컬럼 수
        const salesColWidths = [110, 90, 130, 55, 100];

        // colIndex → 시트 열 문자 변환 (0=A, 25=Z, 26=AA...)
        const toColLetter = (idx: number): string => {
          let s = ""; idx += 1;
          while (idx > 0) { const m = (idx - 1) % 26; s = String.fromCharCode(65 + m) + s; idx = Math.floor((idx - 1) / 26); }
          return s;
        };

        // 최신순 정렬
        const sorted = [...payments].sort((a, b) => {
          const d = (b.paidAt ?? "").localeCompare(a.paidAt ?? "");
          return d !== 0 ? d : (b.id ?? 0) - (a.id ?? 0);
        });

        // 연도별 그룹핑
        const byYear: Record<string, any[]> = {};
        for (const p of sorted) {
          const year = (p.paidAt ?? "").slice(0, 4);
          if (!byYear[year]) byYear[year] = [];
          byYear[year].push(p);
        }

        for (const [year, yearPayments] of Object.entries(byYear)) {
          const sheetTitle = `${year}_매출표`;

          // 시트 없으면 생성
          const infoRes = await fetch(`${SHEETS_API}/${spreadsheetId}`, { headers: authHead });
          const info = await infoRes.json();
          const exists = info.sheets?.some((s: any) => s.properties.title === sheetTitle);
          if (!exists) {
            await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
              method: "POST", headers: authHead,
              body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetTitle } } }] }),
            });
          }
          // 전체 초기화 (넓게)
          await fetch(
            `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetTitle + "!A1:ZZ1000")}:clear`,
            { method: "POST", headers: authHead }
          );

          // 맨 앞으로 이동
          const salesSheetId = await getSheetId(spreadsheetId, sheetTitle);
          if (salesSheetId !== null) {
            await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
              method: "POST", headers: authHead,
              body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: salesSheetId, index: 0 }, fields: "index" } }] }),
            });
          }

          // 월별 그룹핑 (이미 최신순이므로 순서 유지)
          const byMonth: Record<string, any[]> = {};
          for (const p of yearPayments) {
            const month = (p.paidAt ?? "").slice(0, 7);
            if (!byMonth[month]) byMonth[month] = [];
            byMonth[month].push(p);
          }

          const months = Object.entries(byMonth); // [[월키, [결제...]], ...]
          const fmtRequests: any[] = [];

          // 가로 배치: 각 월이 (COL_W + COL_GAP) 컬럼씩 차지
          const valueData: { range: string; values: any[][] }[] = [];

          months.forEach(([month, monthPayments], mIdx) => {
            const startCol = mIdx * (COL_W + COL_GAP);
            const endCol = startCol + COL_W;
            const mo = parseInt(month.slice(5, 7));
            const monthLabel = `${year}년 ${mo}월`;
            const startColLetter = toColLetter(startCol);
            const endColLetter = toColLetter(endCol - 1);

            // Row 1: 월 라벨
            valueData.push({
              range: `${sheetTitle}!${startColLetter}1:${endColLetter}1`,
              values: [[monthLabel, "", "", "", ""]],
            });
            // Row 2: 헤더
            valueData.push({
              range: `${sheetTitle}!${startColLetter}2:${endColLetter}2`,
              values: [PAYMENT_HEADERS],
            });
            // Row 3~: 데이터
            const dataRows = monthPayments.map(p => [p.paidAt ?? "", p.memberName ?? "", p.packageName ?? "", p.sessions ?? 0, p.amount ?? 0]);
            // 합계 행
            const totalAmount = monthPayments.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
            const totalRow = ["합계", "", "", "", totalAmount];
            valueData.push({
              range: `${sheetTitle}!${startColLetter}3:${endColLetter}${2 + dataRows.length}`,
              values: dataRows,
            });
            valueData.push({
              range: `${sheetTitle}!${startColLetter}${3 + dataRows.length}:${endColLetter}${3 + dataRows.length}`,
              values: [totalRow],
            });

            if (salesSheetId !== null) {
              // 월 라벨 (노랑)
              fmtRequests.push({
                repeatCell: {
                  range: { sheetId: salesSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: startCol, endColumnIndex: endCol },
                  cell: { userEnteredFormat: { backgroundColor: { red: 1.0, green: 0.84, blue: 0.0 }, textFormat: { bold: true, fontSize: 11 } } },
                  fields: "userEnteredFormat(backgroundColor,textFormat)",
                },
              });
              // 헤더 (초록)
              fmtRequests.push({
                repeatCell: {
                  range: { sheetId: salesSheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: startCol, endColumnIndex: endCol },
                  cell: { userEnteredFormat: { backgroundColor: { red: 0.18, green: 0.49, blue: 0.20 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 }, horizontalAlignment: "CENTER" } },
                  fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                },
              });
              // 데이터 테두리 + 글씨 11 (합계 행 포함)
              if (dataRows.length > 0) {
                fmtRequests.push({
                  updateBorders: {
                    range: { sheetId: salesSheetId, startRowIndex: 1, endRowIndex: 3 + dataRows.length, startColumnIndex: startCol, endColumnIndex: endCol },
                    top: { style: "SOLID", width: 1 }, bottom: { style: "SOLID", width: 1 },
                    left: { style: "SOLID", width: 1 }, right: { style: "SOLID", width: 1 },
                    innerHorizontal: { style: "SOLID", width: 1 }, innerVertical: { style: "SOLID", width: 1 },
                  },
                });
                fmtRequests.push({
                  repeatCell: {
                    range: { sheetId: salesSheetId, startRowIndex: 2, endRowIndex: 2 + dataRows.length, startColumnIndex: startCol, endColumnIndex: endCol },
                    cell: { userEnteredFormat: { textFormat: { fontSize: 11 } } },
                    fields: "userEnteredFormat.textFormat.fontSize",
                  },
                });
                // 합계 행 스타일 (데이터 행과 동일, 굵기 없음)
                fmtRequests.push({
                  repeatCell: {
                    range: { sheetId: salesSheetId, startRowIndex: 2 + dataRows.length, endRowIndex: 3 + dataRows.length, startColumnIndex: startCol, endColumnIndex: endCol },
                    cell: { userEnteredFormat: { textFormat: { bold: false, fontSize: 11 } } },
                    fields: "userEnteredFormat.textFormat",
                  },
                });
              }
              // 열 너비 설정
              salesColWidths.forEach((px, i) => {
                fmtRequests.push({
                  updateDimensionProperties: {
                    range: { sheetId: salesSheetId, dimension: "COLUMNS", startIndex: startCol + i, endIndex: startCol + i + 1 },
                    properties: { pixelSize: px }, fields: "pixelSize",
                  },
                });
              });
            }
          });

          // 데이터 한 번에 업로드 (batchUpdate values) - 토큰 새로 가져오기
          const freshHead = await authHeaders();
          console.log("[Sheets] valueData 개수:", valueData.length, "첫 range:", valueData[0]?.range);
          const writeRes = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
            method: "POST", headers: freshHead,
            body: JSON.stringify({ valueInputOption: "RAW", data: valueData }),
          });
          if (!writeRes.ok) {
            const writeErr = await writeRes.json().catch(() => ({}));
            console.log("[Sheets] values:batchUpdate 실패:", writeRes.status, JSON.stringify(writeErr));
            if (writeRes.status === 401) {
              return { success: false, message: "Google 로그인이 만료됐어요. 구글 시트 연동을 해제 후 다시 연동해주세요." };
            }
          } else {
            console.log("[Sheets] values:batchUpdate 성공:", writeRes.status);
          }

          // 포맷 적용 - 토큰 새로 가져오기
          if (salesSheetId !== null && fmtRequests.length > 0) {
            const freshHead2 = await authHeaders();
            const fmtRes2 = await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
              method: "POST", headers: freshHead2,
              body: JSON.stringify({ requests: fmtRequests }),
            });
            if (!fmtRes2.ok) {
              const fmtErr = await fmtRes2.json().catch(() => ({}));
              console.log("[Sheets] 포맷 batchUpdate 실패:", fmtRes2.status, JSON.stringify(fmtErr));
            } else {
              console.log("[Sheets] 포맷 batchUpdate 성공");
            }
          }
        }
      }
    }

    // 2. 전체 운동일지 동기화 (연동 해제된 회원 포함)
    const HEADERS = ["날짜", "운동명", "세트", "무게(kg)", "횟수", "메모", "피드백"];
    const allLogsRes = await fetch(`${API_URL}/api/fitlog/trainer/all`, { headers });
    if (allLogsRes.ok) {
      const allLogs: any[] = await allLogsRes.json();

      // 회원별로 그룹핑
      const byMember: Record<string, any[]> = {};
      for (const log of allLogs) {
        const name = log.memberName;
        if (!name) continue; // memberName 없으면 스킵
        if (!byMember[name]) byMember[name] = [];
        byMember[name].push(log);
      }

      for (const [memberName, logs] of Object.entries(byMember)) {
        await getOrCreateSheet(spreadsheetId, memberName, HEADERS);
        const authHead = await authHeaders();
        await fetch(
          `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(memberName + "!A:G")}:clear`,
          { method: "POST", headers: authHead }
        );
        await appendRows(spreadsheetId, memberName, [HEADERS]);

        const rows: any[][] = [];
        for (const log of logs) {
          let firstEx = true;
          for (const ex of log.exercises ?? []) {
            (ex.sets ?? []).forEach((s: any, idx: number) => {
              rows.push([
                idx === 0 && firstEx ? log.date : "",
                idx === 0 ? ex.name : "",
                idx + 1,                                          // 세트번호 (1부터)
                s.weight ?? 0,
                s.reps ?? 0,
                idx === 0 ? (ex.memo ?? "") : "",                 // 메모는 운동별
                idx === 0 && firstEx ? (log.feedback ?? "") : "", // 피드백은 일지별
              ]);
              if (idx === 0) firstEx = false;
            });
          }
          rows.push(["", "", "", "", "", "", ""]);
        }
        if (rows.length > 0) await appendRows(spreadsheetId, memberName, rows);

        // 회원 시트 포맷팅 + 메모/피드백 최장 내용 기준 너비
        const memberSheetId = await getSheetId(spreadsheetId, memberName);
        if (memberSheetId !== null) {
          await applyTableFormatting(spreadsheetId, memberSheetId, 7, rows.length + 1);
          const maxMemoLen = Math.max(2, ...rows.map(r => String(r[5] ?? "").length));
          const maxFeedLen = Math.max(2, ...rows.map(r => String(r[6] ?? "").length));
          const memoW = Math.min(400, Math.max(80, maxMemoLen * 10));
          const feedW = Math.min(400, Math.max(80, maxFeedLen * 10));
          const authHead2 = await authHeaders();
          await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
            method: "POST", headers: authHead2,
            body: JSON.stringify({ requests: [
              { updateDimensionProperties: { range: { sheetId: memberSheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: memoW }, fields: "pixelSize" } },
              { updateDimensionProperties: { range: { sheetId: memberSheetId, dimension: "COLUMNS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: feedW }, fields: "pixelSize" } },
            ]}),
          });
        }
      }
    }

    // 미연동 회원 운동일지
    const today = new Date().toISOString().slice(0, 10);
    const manualRes = await fetch(`${API_URL}/api/trainer/manual-members`, { headers });
    if (manualRes.ok) {
      const manualMembers: any[] = await manualRes.json();
      for (const mm of manualMembers) {
        const name = mm.name ?? "미연동회원";
        const logsRes = await fetch(`${API_URL}/api/fitlog/manual/${mm.id}?from=2020-01-01&to=${today}`, { headers });
        if (!logsRes.ok) continue;
        const logs: any[] = await logsRes.json();
        if (logs.length === 0) continue;

        await getOrCreateSheet(spreadsheetId, name, HEADERS);
        const authHead = await authHeaders();
        await fetch(
          `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(name + "!A:G")}:clear`,
          { method: "POST", headers: authHead }
        );
        await appendRows(spreadsheetId, name, [HEADERS]);

        const rows: any[][] = [];
        for (const log of logs) {
          let firstEx = true;
          for (const ex of log.exercises ?? []) {
            (ex.sets ?? []).forEach((s: any, idx: number) => {
              rows.push([
                idx === 0 && firstEx ? log.date : "",
                idx === 0 ? ex.name : "",
                idx + 1,                                          // 세트번호 (1부터)
                s.weight ?? 0,
                s.reps ?? 0,
                idx === 0 ? (ex.memo ?? "") : "",                 // 메모는 운동별
                idx === 0 && firstEx ? (log.feedback ?? "") : "", // 피드백은 일지별
              ]);
              if (idx === 0) firstEx = false;
            });
          }
          rows.push(["", "", "", "", "", "", ""]);
        }
        if (rows.length > 0) await appendRows(spreadsheetId, name, rows);

        // 미연동 회원 시트 포맷팅 + 메모/피드백 최장 내용 기준 너비
        const manualSheetId = await getSheetId(spreadsheetId, name);
        if (manualSheetId !== null) {
          await applyTableFormatting(spreadsheetId, manualSheetId, 7, rows.length + 1);
          const maxMemoLen = Math.max(2, ...rows.map(r => String(r[5] ?? "").length));
          const maxFeedLen = Math.max(2, ...rows.map(r => String(r[6] ?? "").length));
          const memoW = Math.min(400, Math.max(80, maxMemoLen * 10));
          const feedW = Math.min(400, Math.max(80, maxFeedLen * 10));
          const authHead2 = await authHeaders();
          await fetch(`${SHEETS_API}/${spreadsheetId}:batchUpdate`, {
            method: "POST", headers: authHead2,
            body: JSON.stringify({ requests: [
              { updateDimensionProperties: { range: { sheetId: manualSheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: memoW }, fields: "pixelSize" } },
              { updateDimensionProperties: { range: { sheetId: manualSheetId, dimension: "COLUMNS", startIndex: 6, endIndex: 7 }, properties: { pixelSize: feedW }, fields: "pixelSize" } },
            ]}),
          });
        }
      }
    }

    return { success: true, message: "동기화 완료!" };
  } catch (e: any) {
    console.log("동기화 실패:", e);
    return { success: false, message: "동기화 중 오류가 발생했어요." };
  }
}
