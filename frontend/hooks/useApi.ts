/**
 * FitLog API 공통 훅
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/api";

/**
 * JWT를 포함한 fetch 헬퍼
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const jwt = await AsyncStorage.getItem("jwt");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}

/**
 * 응답 JSON 안전 파싱
 * - body가 비어있으면 {} 반환
 * - JSON이 아니면 text 반환
 */
async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/**
 * GET 요청 헬퍼
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `오류: ${res.status}`);
  }

  return parseResponse<T>(res);
}

/**
 * POST 요청 헬퍼
 */
export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `오류: ${res.status}`);
  }

  return parseResponse<T>(res);
}

/**
 * PUT 요청 헬퍼
 */
export async function apiPut<T = any>(
  path: string,
  body?: unknown
): Promise<T> {
  const res = await apiFetch(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `오류: ${res.status}`);
  }

  return parseResponse<T>(res);
}

/**
 * DELETE 요청 헬퍼
 */
export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await apiFetch(path, {
    method: "DELETE",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `오류: ${res.status}`);
  }

  return parseResponse<T>(res);
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * 주간 날짜 배열 반환 (월~일)
 */
export function getWeekDates(offset = 0): Date[] {
  const today = new Date();
  const day = today.getDay();

  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}