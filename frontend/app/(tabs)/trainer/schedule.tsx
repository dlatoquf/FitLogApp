import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  View,
} from "react-native";
import Purchases from "react-native-purchases";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";
import { toDateKey } from "../../../hooks/useApi";

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const DAYS_KR_MON = ["월", "화", "수", "목", "금", "토", "일"];
const DAYS_KR_SUN = ["일", "월", "화", "수", "목", "금", "토"];

// 전화번호 자동 하이픈 포맷 (010-1234-5678 / 02-123-4567 등)
function formatPhoneNumber(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10)
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

// 1시간 단위 시간 옵션 (offset에 따라 :00 or :30)
function makeTimeOptions(offset: 0 | 30, startHour = 5, endHour = 23): string[] {
  const times: string[] = [];
  const mm = offset === 30 ? "30" : "00";
  for (let h = startHour; h <= endHour; h++) {
    times.push(`${String(h).padStart(2, "0")}:${mm}`);
  }
  return times;
}

// 기본 (미설정) 시에도 보여줄 시간 (정각 기준)
const TIME_OPTIONS_DEFAULT = makeTimeOptions(0);

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

/** 해당 월의 1일이 무슨 요일인지 반환 (startDay: 0=일요일시작, 1=월요일시작) */
function getMonthFirstDayOfWeek(year: number, month: number, startDay: 0 | 1 = 1): number {
  const d = new Date(year, month - 1, 1);
  const jsDay = d.getDay(); // 0=일, 1=월 ... 6=토
  if (startDay === 1) return jsDay === 0 ? 6 : jsDay - 1; // 월=0
  return jsDay; // 일=0
}

/** 해당 월의 마지막 날짜 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 날짜 → YYYY-MM-DD */
function makeDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 오늘 기준 이번 주 시작일 (startDay: 0=일, 1=월) */
function getThisWeekStart(startDay: 0 | 1 = 1): Date {
  const today = new Date();
  const jsDay = today.getDay(); // 0=일
  const diff = startDay === 1
    ? (jsDay === 0 ? -6 : 1 - jsDay)
    : -jsDay;
  const start = new Date(today);
  start.setDate(today.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** 활성 날짜 범위: 이번 주 시작 ~ +13일 */
function getActiveRange(startDay: 0 | 1 = 1): { from: Date; to: Date } {
  const start = getThisWeekStart(startDay);
  const to = new Date(start);
  to.setDate(start.getDate() + 13);
  to.setHours(23, 59, 59, 999);
  return { from: start, to };
}

function RescheduleTimeFlatList({ timeOptions, selectedTimeStr, selectedIdx, ITEM_W, listRef, onSelect }: {
  timeOptions: string[];
  selectedTimeStr: string;
  selectedIdx: number;
  ITEM_W: number;
  listRef: React.RefObject<FlatList<string> | null>;
  onSelect: (t: string) => void;
}) {
  const scrollToSelected = (animated: boolean) => {
    if (listRef.current && selectedIdx >= 0) {
      listRef.current.scrollToIndex({ index: selectedIdx, animated, viewPosition: 0.5 });
    }
  };

  useEffect(() => {
    scrollToSelected(true);
  }, [selectedTimeStr]);

  return (
    <FlatList
      ref={listRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      data={timeOptions}
      keyExtractor={(t) => t}
      style={{ marginBottom: 12 }}
      contentContainerStyle={{ gap: 6 }}
      onLayout={() => scrollToSelected(false)}
      onScrollToIndexFailed={() => {}}
      getItemLayout={(_, index) => ({ length: ITEM_W, offset: (ITEM_W + 6) * index, index })}
      renderItem={({ item: t }) => {
        const isSelected = t === selectedTimeStr;
        return (
          <TouchableOpacity
            onPress={() => onSelect(t)}
            style={{ width: ITEM_W, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: isSelected ? Colors.green : Colors.bgSub, borderWidth: 1, borderColor: isSelected ? Colors.green : Colors.border, alignItems: "center" }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? "#fff" : Colors.text }}>{t}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function TrainerScheduleScreen() {
  const { date: paramDate, mode: paramMode } = useLocalSearchParams<{ date?: string; mode?: string }>();
  const today = new Date();

  // 알림 딥링크: date 파라미터로 해당 날짜 주간으로 이동
  useEffect(() => {
    if (!paramDate) return;
    const parts = paramDate.split("-");
    if (parts.length !== 3) return;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    setSelectedDate(d);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
    if (paramMode === "week") setViewMode("week");
  }, [paramDate, paramMode]);

  // 현재 보고 있는 연/월
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);

  // 선택된 날짜
  const [selectedDate, setSelectedDate] = useState(today);

  // 슬롯 데이터 (해당 월 전체)
  const [slots, setSlots] = useState<any[]>([]);
  const hasLoadedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 연동 회원 목록
  const [members, setMembers] = useState<any[]>([]);

  // 뷰 모드 (월간 / 주간)
  const [viewMode, setViewMode] = useState<"month" | "week">(paramMode === "month" ? "month" : "week");
  const [weekOffset, setWeekOffset] = useState(0);

  // 월별 메모
  const [monthMemo, setMonthMemo] = useState("");
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  // 회원 추가 모달 (슬롯 선택 후)
  const [addModal, setAddModal] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const [addingSlot, setAddingSlot] = useState<any | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  // 수동 슬롯 추가 모달 (시간 직접 선택)
  const [manualModal, setManualModal] = useState(false);

  useEffect(() => { if (!addModal) { setMemberSearchQuery(""); setPtNote(""); } }, [addModal]);
  useEffect(() => { if (!manualModal) { setMemberSearchQuery(""); setPtNote(""); } }, [manualModal]);
  const [manualTime, setManualTime] = useState("09:00");
  const [manualTimeFixed, setManualTimeFixed] = useState(false); // 주간 셀 탭 시 시간 고정
  const [addingManual, setAddingManual] = useState(false);
  const [trainerStartTime, setTrainerStartTime] = useState("09:00");
  const trainerStartTimeRef = useRef("09:00");
  const weekScrollRef = useRef<ScrollView>(null);

  // 요일 다중 선택 (수업 추가 시)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  // PT / OT / 개인운동 / 개인일정
  const [sessionType, setSessionType] = useState<
    "PT" | "OT" | "PERSONAL_WORKOUT" | "PERSONAL_SCHEDULE"
  >("PT");
  const [otName, setOtName] = useState("");
  const [otPhone, setOtPhone] = useState("");
  const [addingOt, setAddingOt] = useState(false);
  const [personalNote, setPersonalNote] = useState("");
  const [ptNote, setPtNote] = useState("");
  const [plan, setPlan] = useState<"FREE" | "PRO">("FREE");
  const [paymentVisible, setPaymentVisible] = useState(false);
  const paymentPanY = useRef(new Animated.Value(0)).current;
  const [editingNoteSlotId, setEditingNoteSlotId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [addingPersonal, setAddingPersonal] = useState(false);

  // 슬롯 오프셋: 0=정각, 30=30분
  const [slotOffset, setSlotOffset] = useState<0 | 30 | null | "loading">(
    "loading",
  );
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // 주간 뷰 열 너비 스케일: 1=좁게(기본), 2=보통, 3=넓게
  const [colScale, setColScale] = useState<1 | 2 | 3>(2);

  // 주간 뷰 시작/마지막 시간
  const [weekStartHour, setWeekStartHour] = useState(9);
  const [weekEndHour, setWeekEndHour] = useState(23);
  const SLOT_H_REF = useRef(30);
  const weekStartScrollRef = useRef<ScrollView>(null);
  const weekEndScrollRef = useRef<ScrollView>(null);
  const PICKER_ITEM_H = 44;

  useEffect(() => {
    if (!showOffsetModal) return;
    setTimeout(() => {
      (weekStartScrollRef.current as any)?.scrollToOffset({ offset: weekStartHour * PICKER_ITEM_H, animated: false });
      (weekEndScrollRef.current as any)?.scrollToOffset({ offset: (weekEndHour - 12) * PICKER_ITEM_H, animated: false });
    }, 100);
  }, [showOffsetModal]);

  // 주간 long press 상태 모달
  const [slotActionModal, setSlotActionModal] = useState(false);
  const [slotActionTarget, setSlotActionTarget] = useState<any | null>(null);

  // 일정 날짜/시간 변경
  const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
  const rescheduleTimeListRef = useRef<FlatList<string> | null>(null);

  useEffect(() => {
    if (slotActionTarget && rescheduleTimeListRef.current) {
      const target = slotActionTarget;
      const targetDate: Date = target._date ?? new Date();
      const slotOffset = target.startTime ? parseInt(target.startTime.slice(3, 5)) : 0;
      const opts: string[] = [];
      for (let h = weekStartHour; h <= weekEndHour; h++) {
        opts.push(slotOffset === 30 ? `${String(h).padStart(2, "0")}:30` : `${String(h).padStart(2, "0")}:00`);
      }
      const currentTime = rescheduleTime ?? (target.startTime ?? "").slice(0, 5);
      const idx = opts.indexOf(currentTime);
      if (idx >= 0) {
        rescheduleTimeListRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.5 });
      }
    }
  }, [slotActionTarget]);
  const [rescheduling, setRescheduling] = useState(false);

  // 주간→월간 날짜 이동 시 useFocusEffect 리셋 방지용 플래그
  const dateNavRef = useRef(false);

  // 취소된 슬롯 ID 로컬 캐시 (배포 전 임시: 백엔드가 OPEN으로 바꾸기 때문에 필터 유지)
  const cancelledIdsRef = useRef<Set<number>>(new Set());

  // 주 시작 요일: 0=일요일, 1=월요일
  const [weekStartDay, setWeekStartDay] = useState<0 | 1>(1);

  // ── 주간 슬라이드 애니메이션 ─────────────────────────────────────────────
  const SCREEN_W = Dimensions.get("window").width;
  const weekSlideX = useRef(new Animated.Value(0)).current;

  const weekSwipePanRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(-12, Math.min(12, gs.dx * 0.05));
        weekSlideX.setValue(clamped);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -50) {
          goWeekRef.current(1);
        } else if (gs.dx > 50) {
          goWeekRef.current(-1);
        } else {
          weekSlideX.stopAnimation();
          weekSlideX.setValue(0);
        }
      },
    })
  );

  // ── 모달 스와이프 다운 닫기 ──────────────────────────────────────────────
  const addModalPanY = useRef(new Animated.Value(0)).current;
  const manualModalPanY = useRef(new Animated.Value(0)).current;

  const makePanResponder = (panY: Animated.Value, onClose: () => void) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          onClose();
          panY.setValue(0);
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    });

  const addModalPan = useRef(
    makePanResponder(addModalPanY, () => {
      setAddModal(false);
      setSessionType("PT");
      setOtName("");
      setPtNote("");
    }),
  ).current;

  const manualModalPan = useRef(
    makePanResponder(manualModalPanY, () => {
      setManualModal(false);
      setSessionType("PT");
      setOtName("");
      setPtNote("");
    }),
  ).current;

  // ── 계산값 ────────────────────────────────────────────────────────────────
  const DAYS_KR = weekStartDay === 0 ? DAYS_KR_SUN : DAYS_KR_MON;

  const yearMonthStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
  // 주간 뷰가 두 달에 걸칠 때 두 번째 달
  const [secondYearMonthStr, setSecondYearMonthStr] = useState<string | null>(null);
  const dateKey = toDateKey(selectedDate);
  const activeRange = getActiveRange(weekStartDay);

  /** 주간 뷰: weekOffset 기준 7일 배열 */
  function getWeekDatesForOffset(offset: number): Date[] {
    const start = getThisWeekStart(weekStartDay);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + offset * 7 + i);
      return d;
    });
  }
  const currentWeekDates = getWeekDatesForOffset(weekOffset);

  /** 선택된 날짜가 활성 범위 내 + 오늘 이후인지 */
  const isDateActive = (d: Date): boolean => {
    const dateOnly = new Date(d);
    dateOnly.setHours(0, 0, 0, 0);
    const todayOnly = new Date(today);
    todayOnly.setHours(0, 0, 0, 0);
    return dateOnly >= todayOnly && dateOnly <= activeRange.to;
  };

  /** 해당 날짜의 슬롯들 */
  const daySlots = slots
    .filter((s) => s.date === dateKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // ─── 데이터 조회 ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(
    async (isRefresh = false, silent = false) => {
      cancelledIdsRef.current.clear();
      if (isRefresh) setRefreshing(true);
      else if (!silent) setLoading(true);
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const headers = { Authorization: `Bearer ${jwt}` };

        const extraFetch = secondYearMonthStr
          ? fetch(`${API_URL}/api/schedule/calendar/month?yearMonth=${secondYearMonthStr}`, { headers })
          : Promise.resolve(null);

        const [calRes, memoRes, slotSettingsRes, profileRes, calRes2] =
          await Promise.all([
            fetch(
              `${API_URL}/api/schedule/calendar/month?yearMonth=${yearMonthStr}`,
              { headers },
            ),
            fetch(`${API_URL}/api/schedule/memo?yearMonth=${yearMonthStr}`, {
              headers,
            }),
            fetch(`${API_URL}/api/trainer/slot-settings`, { headers }),
            fetch(`${API_URL}/api/profile/trainer`, { headers }),
            extraFetch,
          ]);
        if (profileRes?.ok) {
          const profileData = await profileRes.json();
          if (profileData.startTime) {
            const st = profileData.startTime.slice(0, 5);
            setTrainerStartTime(st);
            trainerStartTimeRef.current = st;
          }
        }

        if (calRes.ok) {
          const fetched = await calRes.json();
          const extra = calRes2?.ok ? await calRes2.json() : [];
          const merged = [...fetched, ...extra];
          setSlots(merged.filter((s: any) => !cancelledIdsRef.current.has(s.id)));
          hasLoadedRef.current = true;
        }
        if (memoRes?.ok) {
          const data = await memoRes.json();
          setMonthMemo(data.memo ?? "");
        }
        if (slotSettingsRes?.ok) {
          const data = await slotSettingsRes.json();
          const off = data.slotOffset;
          setSlotOffset(off === 30 ? 30 : 0);
          if (data.weekStartHour != null) {
            setWeekStartHour(data.weekStartHour);
            await AsyncStorage.setItem("weekStartHour", String(data.weekStartHour));
          } else {
            const saved = await AsyncStorage.getItem("weekStartHour");
            if (saved != null) setWeekStartHour(Number(saved));
          }
          if (data.weekEndHour != null) {
            setWeekEndHour(data.weekEndHour);
            await AsyncStorage.setItem("weekEndHour", String(data.weekEndHour));
          } else {
            const saved = await AsyncStorage.getItem("weekEndHour");
            if (saved != null) setWeekEndHour(Number(saved));
          }
        }
        const savedScale = await AsyncStorage.getItem("weekColScale");
        if (savedScale != null) setColScale(Number(savedScale) as 1 | 2 | 3);
      } catch (e) {
        console.error("fetchAll error:", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [yearMonthStr, secondYearMonthStr],
  );

  useFocusEffect(
    useCallback(() => {
      if (!dateNavRef.current) {
        const now = new Date();
        setSelectedDate(now);
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth() + 1);
        setWeekOffset(0);
        setSecondYearMonthStr(null);
      }
      // 현재 주가 두 달에 걸치는지 확인
      const weekDates = getWeekDatesForOffset(0);
      const monthSet = new Set(weekDates.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`));
      if (monthSet.size > 1) {
        const months = [...monthSet];
        setSecondYearMonthStr(months[1]);
      }
      dateNavRef.current = false;
      prevFetchKey.current = yearMonthStr; // useEffect 중복 방지
      fetchAll(false, hasLoadedRef.current); // 이미 데이터 있으면 스피너 없이 백그라운드 갱신
      fetchMembers();
      AsyncStorage.getItem("schedule_tutorial_done").then((v) => { if (!v) setShowTutorial(true); });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewMode, slotOffset]),
  );

  const fetchMembers = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };
      const [linkedRes, manualRes, homeRes] = await Promise.all([
        fetch(`${API_URL}/api/trainer/members`, { headers }),
        fetch(`${API_URL}/api/trainer/manual-members`, { headers }),
        fetch(`${API_URL}/api/trainer/home`, { headers }),
      ]);
      if (homeRes.ok) {
        const homeData = await homeRes.json();
        // trialEndDate가 미래면 무료체험 중 → FREE, 과거거나 없으면 plan 값 사용
        const isInTrial = homeData.trialEndDate && new Date(homeData.trialEndDate) > new Date();
        if (isInTrial) {
          setPlan("FREE");
        } else {
          const p = (homeData?.effectivePlan ?? homeData?.plan ?? "FREE").toUpperCase();
          setPlan(p === "PRO" ? "PRO" : "FREE");
        }
      }
      const linked = linkedRes.ok
        ? (await linkedRes.json())
            .map((m: any) => ({
              id: m.id,
              name: m.user?.name ?? "-",
              ptRemaining: m.ptRemaining ?? 0,
              ptTotal: m.ptTotal ?? 0,
              connected: m.connected !== false,
              moved: m.moved === true,
              isManual: false,
            }))
            // 연결해제·타 트레이너 이동·PT 미등록 제외 (잔여 0은 FREE 계산을 위해 유지)
            .filter((m: any) => m.connected && !m.moved && m.ptTotal > 0)
        : [];
      const manual = manualRes.ok
        ? (await manualRes.json())
            .map((m: any) => ({
              id: m.id,
              name: m.name ?? "-",
              ptRemaining: m.ptRemaining ?? 0,
              ptTotal: m.ptTotal ?? 0,
              isManual: true,
            }))
            // PT 미등록 제외 (잔여 0은 FREE 계산을 위해 유지)
            .filter((m: any) => m.ptTotal > 0)
        : [];
      setMembers([...linked, ...manual].sort((a, b) => a.name.localeCompare(b.name, "ko")));
    } catch (e) {
      console.error("fetchMembers error:", e);
    }
  };

  // ─── 시간 유틸 ──────────────────────────────────────────────────────────

  // 세션 타입별 색상
  const sessionColor = (type: string) => {
    if (type === "OT") return "#F97316";
    if (type === "PERSONAL_WORKOUT") return "#F59E0B";
    if (type === "PERSONAL_SCHEDULE") return "#8B5CF6";
    return Colors.green;
  };
  const sessionLabel = (type: string) => {
    if (type === "OT") return "OT";
    if (type === "PERSONAL_WORKOUT") return "개인운동";
    if (type === "PERSONAL_SCHEDULE") return "개인일정";
    return "PT";
  };
  const sessionBg = (type: string) => {
    if (type === "OT") return "#FFF7ED";
    if (type === "PERSONAL_WORKOUT") return "#FFFBEB";
    if (type === "PERSONAL_SCHEDULE") return "#F5F3FF";
    return Colors.greenLight;
  };
  const sessionBorder = (type: string) => {
    if (type === "OT") return "#F9731644";
    if (type === "PERSONAL_WORKOUT") return "#F59E0B44";
    if (type === "PERSONAL_SCHEDULE") return "#8B5CF644";
    return Colors.green + "44";
  };
  const isPersonalType = (type: string) =>
    type === "PERSONAL_WORKOUT" || type === "PERSONAL_SCHEDULE";

  const getEndTime = (start: string): string => {
    const [h, m] = start.split(":").map(Number);
    const total = h * 60 + m + 60;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  };


  // ─── 주간 이동 ───────────────────────────────────────────────────────────

  const goWeekRef = useRef<(delta: number) => void>(() => {});

  const goWeek = (delta: number) => {
    const newOffset = weekOffset + delta;
    weekSlideX.stopAnimation();
    weekSlideX.setValue(delta > 0 ? SCREEN_W : -SCREEN_W);
    setWeekOffset(newOffset);
    Animated.spring(weekSlideX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start(() => weekSlideX.setValue(0));
    // 주 중 가장 많은 날이 속한 달로 viewMonth 업데이트, 두 달에 걸치면 secondYearMonthStr 설정
    const dates = getWeekDatesForOffset(newOffset);
    const monthCount: Record<string, number> = {};
    dates.forEach((d) => {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCount[key] = (monthCount[key] ?? 0) + 1;
    });
    const sorted = Object.entries(monthCount).sort((a, b) => b[1] - a[1]);
    const dominantKey = sorted[0][0];
    const [dy, dm] = dominantKey.split("-").map(Number);
    if (dy !== viewYear || dm !== viewMonth) {
      setViewYear(dy);
      setViewMonth(dm);
    }
    if (sorted.length > 1) {
      setSecondYearMonthStr(sorted[1][0]);
    } else {
      setSecondYearMonthStr(null);
    }
  };
  goWeekRef.current = goWeek;

  useEffect(() => {
    const timer = setTimeout(() => {
      weekSlideX.stopAnimation();
      weekSlideX.setValue(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [weekOffset]);

  // ─── 월 이동 ─────────────────────────────────────────────────────────────

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setViewYear(y);
    setViewMonth(m);
    // 해당 월 1일로 선택 이동
    setSelectedDate(new Date(y, m - 1, 1));
  };

  // 월이 바뀌면 데이터 새로 가져오기
  const prevFetchKey = useRef(yearMonthStr);
  useEffect(() => {
    if (prevFetchKey.current !== yearMonthStr) {
      prevFetchKey.current = yearMonthStr;
      fetchAll();
    }
  }, [yearMonthStr, fetchAll]);

  // ─── 메모 저장 ───────────────────────────────────────────────────────────

  const saveMemo = async () => {
    setSavingMemo(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/schedule/memo?yearMonth=${yearMonthStr}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ memo: memoInput }),
        },
      );
      if (res.ok) {
        setMonthMemo(memoInput);
        setEditingMemo(false);
      }
    } catch (e) {
      Alert.alert("오류", "메모 저장에 실패했어요.");
    } finally {
      setSavingMemo(false);
    }
  };

  // ─── 회원 슬롯 추가 ──────────────────────────────────────────────────────

  const addMemberToSlot = async (m: any) => {
    if (!addingSlot) return;
    doAddMemberToSlot(m);
  };

  const doAddMemberToSlot = async (m: any) => {
    if (!addingSlot) return;
    setAddingMember(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const body: any = {
        date: addingSlot.date,
        startTime: addingSlot.startTime.slice(0, 5),
      };
      if (m.isManual) body.manualMemberId = m.id;
      else body.memberId = m.id;
      if (ptNote.trim()) body.note = ptNote.trim();
      const res = await fetch(`${API_URL}/api/schedule/create-and-confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.text()) || "추가 실패");
      setAddModal(false);
      setPtNote("");
      cancelledIdsRef.current.clear();
      fetchAll();
      Alert.alert("완료 ✓", `${m.name}님 수업이 추가됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAddingMember(false);
    }
  };

  const addManualSchedule = (m: any) => {
    doAddManualSchedule(m);
  };

  const doAddManualSchedule = async (m: any) => {
    setAddingManual(true);
    const dates = selectedDays.length > 0 ? selectedDays : [dateKey];
    const jwt = await AsyncStorage.getItem("jwt");
    const succeeded: string[] = [];
    const failed: string[] = [];
    try {
      for (const d of dates) {
        const body: any = { date: d, startTime: manualTime };
        if (m.isManual) body.manualMemberId = m.id;
        else body.memberId = m.id;
        if (ptNote.trim()) body.note = ptNote.trim();
        try {
          const res = await fetch(`${API_URL}/api/schedule/create-and-confirm`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify(body),
          });
          if (!res.ok) failed.push(d);
          else succeeded.push(d);
        } catch {
          failed.push(d);
        }
      }
      setManualModal(false);
      setPtNote("");
      cancelledIdsRef.current.clear();
      fetchAll();
      if (failed.length === 0) {
        const suffix = dates.length > 1 ? ` ${dates.length}일 일정이` : " 수업이";
        Alert.alert("완료 ✓", `${m.name}님${suffix} 추가됐어요!`);
      } else if (succeeded.length > 0) {
        Alert.alert("일부 완료", `${succeeded.length}일 추가됐어요.\n${failed.length}일은 실패했어요: ${failed.join(", ")}`);
      } else {
        Alert.alert("오류", "일정 추가에 실패했어요.");
      }
    } finally {
      setAddingManual(false);
    }
  };

  // OT 수업 추가: 이름 입력 → 미연동 회원 생성 → 스케줄 확정
  const addOtSchedule = async () => {
    const name = otName.trim();
    if (!name) {
      Alert.alert("오류", "OT 고객 이름을 입력해주세요.");
      return;
    }
    doAddOtSchedule();
  };

  const doAddOtSchedule = async () => {
    const name = otName.trim();
    const phone = otPhone.trim();
    setAddingOt(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      };
      // 1) 미연동 회원 생성 (전화번호 있으면 포함)
      const memberRes = await fetch(`${API_URL}/api/trainer/manual-members`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, phone: phone || undefined, memo: "OT" }),
      });
      if (!memberRes.ok) throw new Error("고객 생성 실패");
      const newMember = await memberRes.json();
      // 2) 스케줄 확정
      const schedRes = await fetch(
        `${API_URL}/api/schedule/create-and-confirm`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            date: dateKey,
            startTime: manualTime,
            manualMemberId: newMember.id,
            sessionType: "OT",
          }),
        },
      );
      if (!schedRes.ok)
        throw new Error((await schedRes.text()) || "스케줄 추가 실패");
      setManualModal(false);
      setOtName("");
      setOtPhone("");
      setSessionType("PT");
      cancelledIdsRef.current.clear();
      fetchAll();
      Alert.alert("완료 ✓", `${name}님 OT 수업이 추가됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAddingOt(false);
    }
  };

  // 개인운동 / 개인일정 추가
  const addPersonalSchedule = async (time: string, date: string) => {
    setAddingPersonal(true);
    const label =
      sessionType === "PERSONAL_WORKOUT" ? "개인 운동" : "개인 일정";
    const endT = getEndTime(time);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/schedule/create-and-confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          date,
          startTime: time,
          sessionType,
          note: personalNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "추가 실패");
      setAddModal(false);
      setManualModal(false);
      setPersonalNote("");
      setSessionType("PT");
      cancelledIdsRef.current.clear();
      fetchAll();
      Alert.alert("완료 ✓", `${label}이 추가됐어요!\n${time} ~ ${endT}`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAddingPersonal(false);
    }
  };

  const completeSlot = (slot: any) => {
    const displayLabel = slot.note ? slot.note : (slot.memberName ?? "수업");
    Alert.alert(
      "수업 완료",
      `${displayLabel}을 완료 처리할까요?`,
      [
        { text: "아니요", style: "cancel" },
        {
          text: "완료",
          onPress: async () => {
            try {
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(`${API_URL}/api/schedule/${slot.id}/complete`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${jwt}` },
              });
              if (!res.ok) throw new Error("완료 처리 실패");
              setSlots((prev) =>
                prev.map((s) => (s.id === slot.id ? { ...s, status: "COMPLETED" } : s)),
              );
              setSlotActionModal(false);
              Alert.alert("완료", "수업이 완료 처리됐어요.");
            } catch (e: any) {
              Alert.alert("오류", e.message);
            }
          },
        },
      ],
    );
  };

  const noShowSlot = (slot: any) => {
    const displayLabel = slot.note ? slot.note : (slot.memberName ?? "수업");
    Alert.alert(
      "노쇼 처리",
      `${displayLabel}을 노쇼 처리할까요?\nPT 횟수가 차감돼요.`,
      [
        { text: "아니요", style: "cancel" },
        {
          text: "노쇼",
          style: "destructive",
          onPress: async () => {
            try {
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(`${API_URL}/api/schedule/${slot.id}/no-show`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${jwt}` },
              });
              if (!res.ok) throw new Error("노쇼 처리 실패");
              setSlots((prev) =>
                prev.map((s) => (s.id === slot.id ? { ...s, status: "NO_SHOW" } : s)),
              );
              setSlotActionModal(false);
              Alert.alert("완료", "노쇼 처리됐어요.");
            } catch (e: any) {
              Alert.alert("오류", e.message);
            }
          },
        },
      ],
    );
  };

  const cancelSlot = (slot: any) => {
    const type = slot.sessionType ?? "";
    const isPersonal = type === "PERSONAL_WORKOUT" || type === "PERSONAL_SCHEDULE";
    const title = isPersonal
      ? type === "PERSONAL_WORKOUT" ? "개인운동 취소" : "개인일정 취소"
      : "수업 취소";
    const message = isPersonal
      ? type === "PERSONAL_WORKOUT" ? "개인운동을 취소하시겠어요?" : "개인일정을 취소하시겠어요?"
      : `${slot.memberName ?? sessionLabel(type)}님 수업을 취소할까요?`;
    Alert.alert(title, message, [
        { text: "아니요", style: "cancel" },
        {
          text: "취소",
          style: "destructive",
          onPress: async () => {
            try {
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(
                `${API_URL}/api/schedule/confirm/${slot.id}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${jwt}` },
                },
              );
              if (!res.ok) throw new Error("취소 실패");
              cancelledIdsRef.current.add(slot.id);
              setSlots((prev) => prev.filter((s) => s.id !== slot.id));
              Alert.alert("완료", "수업이 취소됐어요.");
            } catch (e: any) {
              Alert.alert("오류", e.message);
            }
          },
        },
      ],
    );
  };

  // ─── 캘린더 그리드 렌더 ──────────────────────────────────────────────────

  const renderCalendar = () => {
    const firstDow = getMonthFirstDayOfWeek(viewYear, viewMonth, weekStartDay);
    const daysInMon = getDaysInMonth(viewYear, viewMonth);
    const todayKey = toDateKey(today);

    // 확정/완료/노쇼 수업 점으로 표시
    const dotMap: Record<string, "green" | "gray"> = {};
    slots.forEach((s) => {
      if (s.status === "CONFIRMED" || s.status === "COMPLETED") {
        dotMap[s.date] = "green";
      } else if (s.status === "NO_SHOW" && !dotMap[s.date]) {
        dotMap[s.date] = "gray";
      }
    });

    // 그리드 셀 배열 생성 (앞 빈 칸 + 날짜)
    const cells: (number | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMon }, (_, i) => i + 1),
    ];
    // 7의 배수로 맞추기
    while (cells.length % 7 !== 0) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return (
      <View>
        {/* 요일 헤더 */}
        <View
          style={{
            flexDirection: "row",
            paddingBottom: 8,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          }}
        >
          {DAYS_KR.map((d, i) => (
            <View key={d} style={{ flex: 1, alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color:
                    i === 5
                      ? "#3B82F6"
                      : i === 6
                        ? "#EF4444"
                        : Colors.textMuted,
                }}
              >
                {d}
              </Text>
            </View>
          ))}
        </View>

        {/* 날짜 행 */}
        {rows.map((row, ri) => (
          <View
            key={ri}
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: Colors.border,
            }}
          >
            {row.map((day, ci) => {
              if (!day) return <View key={ci} style={{ flex: 1 }} />;

              const dk = makeDateKey(viewYear, viewMonth, day);
              const cellDate = new Date(viewYear, viewMonth - 1, day);
              const isSelected = dateKey === dk;
              const isToday = todayKey === dk;
              const active = isDateActive(cellDate);
              const dotColor = dotMap[dk];
              const isPast =
                cellDate <
                new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate(),
                );

              return (
                <TouchableOpacity
                  key={ci}
                  onPress={() => setSelectedDate(cellDate)}
                  style={{ flex: 1, alignItems: "center", paddingVertical: 8 }}
                >
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: isSelected
                        ? Colors.green
                        : "transparent",
                      borderWidth: isToday && !isSelected ? 1.5 : 0,
                      borderColor: Colors.green,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isToday || isSelected ? "800" : "500",
                        color: isSelected
                          ? "#fff"
                          : isToday
                            ? Colors.green
                            : ci === 5
                              ? "#3B82F6"
                              : ci === 6
                                ? "#EF4444"
                                : Colors.text,
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                  {/* 수업 점 */}
                  {dotColor && (
                    <View
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        marginTop: 3,
                        backgroundColor:
                          dotColor === "green" ? Colors.green : "#9CA3AF",
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // ─── 주간 뷰 렌더 ────────────────────────────────────────────────────────

  const renderWeekView = () => {
    const todayKey = toDateKey(today);
    const weekDateKeys = currentWeekDates.map((d) => toDateKey(d));

    // 화면 너비 안에 월~일이 모두 들어오도록 계산
    const SCREEN_W = Dimensions.get("window").width;
    const TIME_W = 30;
    const WEEK_GRID_PADDING = 40; // 화면 padding 20*2
    // colScale: 1=좁게(7열), 2=보통(5열 너비), 3=넓게(3열 너비)
    const COL_W = (SCREEN_W - WEEK_GRID_PADDING - TIME_W) / 7;
    const SLOT_H = colScale === 3 ? 52 : colScale === 2 ? 40 : 30;
    SLOT_H_REF.current = SLOT_H;
    const CELL_FONT = colScale === 3 ? 13 : colScale === 2 ? 12 : 11;
    const CELL_SUB_FONT = colScale === 3 ? 11 : colScale === 2 ? 10 : 9;
    const GRID_MAX_H = Math.max(540, Dimensions.get("window").height - 330);

    // 이번 주 슬롯 필터
    const weekSlots = slots.filter((s) => weekDateKeys.includes(s.date));
    const confirmedSlots = weekSlots.filter(
      (s) => s.status === "CONFIRMED" || s.status === "COMPLETED",
    );

    // 1시간 단위 시간대 (offset에 따라 :00 or :30)
    const effectiveOffset = slotOffset === 30 ? 30 : 0;
    const times = makeTimeOptions(effectiveOffset as 0 | 30, weekStartHour, weekEndHour);

    // "date_HH:mm" → slot 맵
    const slotMap: Record<string, any> = {};
    weekSlots.forEach((s) => {
      const key = `${s.date}_${s.startTime.slice(0, 5)}`;
      if (!slotMap[key]) slotMap[key] = s;
    });
    confirmedSlots.forEach((s) => {
      slotMap[`${s.date}_${s.startTime.slice(0, 5)}`] = s;
    });

    const openWeeklyAdd = async (d: Date, time: string, existingSlot?: any) => {
      if (members.length === 0) await fetchMembers();
      setSelectedDate(d);
      setManualTime(time);
      setManualTimeFixed(true);
      setSessionType("PT");
      setOtName("");
      setSelectedDays([toDateKey(d)]);
      setManualModal(true);
    };

    return (
      <View {...weekSwipePanRef.current.panHandlers} style={{ overflow: "hidden" }}>
        <Animated.View style={{ transform: [{ translateX: weekSlideX }] }}>
        {/* 헤더: 요일 + 날짜 */}
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: TIME_W }} />
          {currentWeekDates.map((d, i) => {
            const dk = toDateKey(d);
            const isToday = dk === todayKey;
            return (
              <TouchableOpacity
                key={dk}
                onPress={() => {
                  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                  dateNavRef.current = true;
                  setSelectedDate(target);
                  setViewYear(target.getFullYear());
                  setViewMonth(target.getMonth() + 1);
                  setViewMode("month");
                }}
                style={{
                  width: COL_W,
                  alignItems: "center",
                  paddingVertical: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: isToday
                      ? Colors.green
                      : i === 5
                        ? "#3B82F6"
                        : i === 6
                          ? "#EF4444"
                          : Colors.textMuted,
                  }}
                >
                  {DAYS_KR[i]}
                </Text>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    marginTop: 2,
                    backgroundColor: isToday ? Colors.green : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "800",
                      color: isToday
                        ? "#fff"
                        : i === 5
                          ? "#3B82F6"
                          : i === 6
                            ? "#EF4444"
                            : Colors.text,
                    }}
                  >
                    {d.getDate()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 구분선 */}
        <View
          style={{
            height: 1,
            backgroundColor: Colors.border,
            marginLeft: TIME_W,
            marginBottom: 6,
          }}
        />

        {/* 세로 스크롤 그리드 */}
        <ScrollView
          ref={weekScrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: GRID_MAX_H }}
        >
          {times.map((time) => (
            <View
              key={time}
              style={{
                flexDirection: "row",
                alignItems: "stretch",
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              {/* 시간 라벨 */}
              <View
                style={{
                  width: TIME_W,
                  alignItems: "flex-end",
                  paddingRight: 4,
                  paddingTop: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: "600",
                    color: Colors.textMuted,
                  }}
                >
                  {time}
                </Text>
              </View>

              {/* 각 요일 셀 */}
              {currentWeekDates.map((d, di) => {
                const dk = toDateKey(d);
                const slot = slotMap[`${dk}_${time}`];
                const isConfirmed =
                  slot?.status === "CONFIRMED" ||
                  slot?.status === "COMPLETED" ||
                  slot?.status === "NO_SHOW";
                const isNoShowSlot = slot?.status === "NO_SHOW";
                const isActive = isDateActive(d);

                return (
                  <View key={dk} style={{ width: COL_W }}>
                    {isConfirmed ? (
                      // 확정/완료/노쇼 슬롯
                      <TouchableOpacity
                        onPress={() => {
                          setSlotActionTarget({ ...slot, _date: d });
                          setRescheduleDate(null);
                          setRescheduleTime(null);
                          setSlotActionModal(true);
                        }}
                        style={{
                          backgroundColor:
                            slot.status === "COMPLETED"
                              ? Colors.blue
                              : slot.status === "NO_SHOW"
                                ? "#9CA3AF"
                                : sessionColor(slot.sessionType ?? "PT"),
                          borderRadius: 0,
                          paddingHorizontal: 2,
                          alignItems: "center",
                          justifyContent: "center",
                          height: SLOT_H,
                          borderRightWidth: 1,
                          borderRightColor: "rgba(255,255,255,0.35)",
                        }}
                      >
                        <Text
                          style={{ fontSize: CELL_FONT, fontWeight: "900", color: "#fff", textAlign: "center" }}
                          numberOfLines={1}
                        >
                          {isPersonalType(slot.sessionType ?? "")
                            ? (slot.note ?? sessionLabel(slot.sessionType ?? ""))
                            : (slot.memberName ?? (slot.sessionType === "OT" ? "OT" : "-"))}
                        </Text>
                        {!isPersonalType(slot.sessionType ?? "") && (() => {
                          const isFinished = slot.status === "COMPLETED" || slot.status === "NO_SHOW";
                          const sub = slot.note
                            ? slot.note
                            : isFinished
                              ? ""
                              : slot.sessionType === "OT" || (slot.ptTotal === 0 && slot.manualMemberId)
                                ? "OT"
                                : "";
                          return sub ? (
                            <Text style={{ fontSize: CELL_SUB_FONT, color: "#ffffffcc", textAlign: "center" }} numberOfLines={1}>
                              {sub}
                            </Text>
                          ) : null;
                        })()}
                      </TouchableOpacity>
                    ) : (
                      // 빈 칸 (활성 + 과거 모두 터치 가능)
                      <TouchableOpacity
                        onPress={() => openWeeklyAdd(d, time, slot)}
                        style={{
                          height: SLOT_H,
                          backgroundColor: "transparent",
                          borderRightWidth: 1,
                          borderRightColor: Colors.border,
                        }}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
        </Animated.View>
      </View>
    );
  };

  // ─── 슬롯 렌더 ───────────────────────────────────────────────────────────

  const renderSlots = () => {
    const selectedActive = isDateActive(selectedDate);
    const selectedPast =
      selectedDate <
      new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (loading)
      return (
        <ActivityIndicator color={Colors.green} style={{ marginTop: 24 }} />
      );

    if (daySlots.length === 0) {
      return (
        <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
          <Text style={{ fontSize: 13, color: Colors.textMuted }}>
            이날 스케줄이 없어요
          </Text>
          <TouchableOpacity
              onPress={async () => {
                if (members.length === 0) await fetchMembers();
                setManualTime("09:00");
                setManualTimeFixed(false);
                setSelectedDays([toDateKey(selectedDate)]);
                setManualModal(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "#fff",
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.green + "44",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>
                + 스케줄 추가
              </Text>
            </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        {daySlots.map((slot, idx) => {
          const isNoShowSlot = slot.status === "NO_SHOW";
          const isConfirmed =
            slot.status === "CONFIRMED" ||
            slot.status === "COMPLETED" ||
            isNoShowSlot;
          const isOpen = !isConfirmed;

          return (
            <View
              key={slot.id ?? `${slot.date}-${slot.startTime}-${idx}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                marginBottom: 6,
                backgroundColor:
                  slot.status === "COMPLETED"
                    ? Colors.blueBg
                    : slot.status === "NO_SHOW"
                      ? "#F3F4F6"
                      : !isConfirmed
                        ? "#fff"
                        : sessionBg(slot.sessionType ?? "PT"),
                borderWidth: 1,
                borderColor:
                  slot.status === "COMPLETED"
                    ? Colors.blue + "55"
                    : slot.status === "NO_SHOW"
                      ? "#D1D5DB"
                      : !isConfirmed
                        ? Colors.border
                        : sessionBorder(slot.sessionType ?? "PT"),
              }}
            >
              {/* 시간 */}
              <Text
                numberOfLines={1}
                allowFontScaling={false}
                style={{
                  fontSize: 14,
                  fontWeight: "800",
                  color: Colors.text,
                  width: 46,
                  flexShrink: 0,
                }}
              >
                {slot.startTime.slice(0, 5)}
              </Text>
              <View
                style={{
                  width: 1,
                  height: 28,
                  backgroundColor: Colors.border,
                  marginHorizontal: 12,
                }}
              />

              {/* 내용 */}
              <View style={{ flex: 1 }}>
                {isConfirmed ? (
                  <View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: isNoShowSlot ? Colors.textMuted : Colors.text,
                          textDecorationLine: isNoShowSlot
                            ? "line-through"
                            : "none",
                        }}
                      >
                        {isPersonalType(slot.sessionType ?? "")
                          ? slot.note || sessionLabel(slot.sessionType ?? "")
                          : slot.memberName}
                      </Text>
                      {slot.status === "COMPLETED" && (
                        <View
                          style={{
                            backgroundColor: Colors.blueBg,
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: "800", color: Colors.blue }}>
                            완료
                          </Text>
                        </View>
                      )}
                      {isNoShowSlot && (
                        <View
                          style={{
                            backgroundColor: "#9CA3AF33",
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color: "#9CA3AF",
                            }}
                          >
                            노쇼
                          </Text>
                        </View>
                      )}
                      {(slot.sessionType === "OT" ||
                        isPersonalType(slot.sessionType ?? "")) && (
                        <View
                          style={{
                            backgroundColor: sessionColor(
                              slot.sessionType ?? "PT",
                            ),
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color: "#fff",
                            }}
                          >
                            {sessionLabel(slot.sessionType ?? "PT")}
                          </Text>
                        </View>
                      )}
                    </View>
                    {isPersonalType(slot.sessionType ?? "") ? (
                      <Text
                        style={{
                          fontSize: 11,
                          color: sessionColor(slot.sessionType ?? ""),
                          marginTop: 2,
                        }}
                      >
                        {slot.sessionType === "PERSONAL_WORKOUT"
                          ? "개인 운동"
                          : "개인 일정"}
                      </Text>
                    ) : slot.status === "COMPLETED" ? null : slot.note ? (
                      <Text
                        style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {slot.note}
                      </Text>
                    ) : slot.sessionType === "OT" ? (
                      <Text
                        style={{ fontSize: 11, color: "#F97316", marginTop: 2 }}
                      >
                        체험 수업
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                    비어있음
                  </Text>
                )}
              </View>


              {/* 상태 버튼 */}
              {(slot.status === "CONFIRMED" || isNoShowSlot) && slot.id && (
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setSlotActionTarget(slot);
                      setSlotActionModal(true);
                    }}
                    style={{
                      backgroundColor: "#F3F4F6",
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "700" }}>수업 상태 변경</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 추가 버튼 (비어있음) */}
              {isOpen && (selectedActive || selectedPast) && (
                <TouchableOpacity
                  onPress={async () => {
                    if (members.length === 0) await fetchMembers();
                    setAddingSlot(slot);
                    setAddModal(true);
                  }}
                  style={{
                    backgroundColor: Colors.greenLight,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: Colors.green + "44",
                  }}
                >
                  <Text
                    style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}
                  >
                    + 추가
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* 슬롯 있을 때도 하단에 추가 버튼 */}
        {(selectedActive || selectedPast) && (
          <TouchableOpacity
            onPress={async () => {
              if (members.length === 0) await fetchMembers();
              setManualTime("09:00");
              setManualTimeFixed(false);
              setSelectedDays([toDateKey(selectedDate)]);
              setManualModal(true);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 8,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: Colors.green + "44",
            }}
          >
            <Text
              style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}
            >
              + 스케줄 추가
            </Text>
          </TouchableOpacity>
        )}
      </>
    );
  };

  // ─── JSX ─────────────────────────────────────────────────────────────────

  const selDate = selectedDate;
  const dayOfWeekKr = weekStartDay === 0
    ? DAYS_KR[selDate.getDay()]
    : DAYS_KR[(selDate.getDay() + 6) % 7];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAll(true)}
            tintColor={Colors.green}
          />
        }
      >
        {/* ── 헤더 ─────────────────────────────────────────────────────────── */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>
            일정
          </Text>
        </View>

        {/* ── 뷰 모드 토글 ──────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          {/* 탭 언더라인 스타일 */}
          <View style={{ flexDirection: "row" }}>
            {(["month", "week"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setViewMode(mode)}
                style={{
                  paddingHorizontal: 4,
                  paddingVertical: 6,
                  marginRight: 20,
                  borderBottomWidth: 2,
                  borderBottomColor:
                    viewMode === mode ? Colors.green : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "800",
                    color: viewMode === mode ? Colors.text : Colors.textMuted,
                  }}
                >
                  {mode === "month" ? "월간" : "주간"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 오른쪽: 설정 버튼 */}
          <TouchableOpacity
            onPress={() => setShowOffsetModal(true)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: Colors.bgSub,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* 색상 범례 */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 2, paddingBottom: 10 }}>
          {[
            { color: Colors.green, label: "수업 확정" },
            { color: Colors.blue, label: "수업 완료" },
            { color: "#9CA3AF", label: "노쇼" },
            { color: "#F97316", label: "OT" },
            { color: "#F59E0B", label: "개인운동" },
            { color: "#8B5CF6", label: "개인일정" },
          ].map(({ color, label }) => (
            <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{label}</Text>
            </View>
          ))}
        </View>

        {viewMode === "month" ? (
          <>
            {/* ── 월 네비게이션 ────────────────────────────────────────────────── */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => goMonth(-1)}
                style={{ padding: 6 }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    color: Colors.textMuted,
                    fontWeight: "300",
                  }}
                >
                  ‹
                </Text>
              </TouchableOpacity>
              <Text
                style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}
              >
                {viewYear}년 {viewMonth}월
              </Text>
              <TouchableOpacity
                onPress={() => goMonth(1)}
                style={{ padding: 6 }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    color: Colors.textMuted,
                    fontWeight: "300",
                  }}
                >
                  ›
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── 월간 캘린더 그리드 ───────────────────────────────────────────── */}
            <View style={{ marginBottom: 10 }}>{renderCalendar()}</View>

            {/* ── 월별 메모 ────────────────────────────────────────────────────── */}
            <TouchableOpacity
              onPress={() => {
                setMemoInput(monthMemo);
                setEditingMemo(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 8,
                marginBottom: 14,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>📝</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: monthMemo ? Colors.text : Colors.textMuted,
                }}
                numberOfLines={1}
              >
                {monthMemo || `${viewMonth}월 메모`}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: Colors.textMuted,
                }}
              >
                {monthMemo ? "수정" : "추가"}
              </Text>
            </TouchableOpacity>

            {/* ── 선택된 날짜 슬롯 ─────────────────────────────────────────────── */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "800",
                color: Colors.textSub,
                marginBottom: 10,
              }}
            >
              {selDate.getMonth() + 1}월 {selDate.getDate()}일 ({dayOfWeekKr})
              스케줄
            </Text>
            {renderSlots()}
          </>
        ) : (
          <>
            {/* ── 주간 네비게이션 ──────────────────────────────────────────── */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => goWeek(-1)}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  backgroundColor: Colors.bgSub,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: Colors.text }}>‹</Text>
              </TouchableOpacity>
              <Text
                style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}
              >
                {currentWeekDates[0].getMonth() + 1}월{" "}
                {currentWeekDates[0].getDate()}일 —{" "}
                {currentWeekDates[6].getMonth() !==
                currentWeekDates[0].getMonth()
                  ? `${currentWeekDates[6].getMonth() + 1}월 `
                  : ""}
                {currentWeekDates[6].getDate()}일
              </Text>
              <TouchableOpacity
                onPress={() => goWeek(1)}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  backgroundColor: Colors.bgSub,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: Colors.text }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* ── 주간 그리드 ──────────────────────────────────────────────── */}
            <View style={{ marginBottom: 16 }}>
              {loading ? (
                <ActivityIndicator
                  color={Colors.green}
                  style={{ marginVertical: 40 }}
                />
              ) : (
                renderWeekView()
              )}
            </View>
          </>
        )}
      </ScrollView>


      {/* ── 튜토리얼 모달 ───────────────────────────────────────────────────── */}
      <Modal
        visible={showTutorial}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 28 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>일정 화면 사용법</Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 20 }}>처음이신가요? 빠르게 알아볼게요</Text>

            {/* Step 1 */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 2 }}>빈 칸 선택 → 수업 추가</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, lineHeight: 18 }}>{"빈 시간 칸을 선택하면\nPT·OT·개인 일정을 추가할 수 있어요."}</Text>
              </View>
            </View>

            {/* Step 2 */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.blue, justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 2 }}>확정된 수업 선택 → 상세 관리</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, lineHeight: 18 }}>{"확정된 수업을 선택하면\n메모 수정, 날짜/시간 변경,\n완료·노쇼·취소 처리를 할 수 있어요."}</Text>
              </View>
            </View>

            {/* Step 3 */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24, alignItems: "flex-start" }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#F97316", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 2 }}>우측 상단 ⚙️ → 일정 설정</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, lineHeight: 18 }}>{"수업 시작 시간(정각/30분),\n주간 뷰 시작·마지막 시간을 설정할 수 있어요."}</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.setItem("schedule_tutorial_done", "1");
                setShowTutorial(false);
                setShowOffsetModal(true);
              }}
              style={{ backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>시작하기 →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 메모 수정 모달 ─────────────────────────────────────────────────── */}
      {/* ── 설정 모달 ────────────────────────────────────────────────────── */}
      <Modal
        visible={showOffsetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOffsetModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
          activeOpacity={1}
          onPress={() => setShowOffsetModal(false)}
        >
          <Pressable style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "85%" }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 14 }}>일정 설정</Text>

            {/* ── 공통 설정 (월간 + 주간) ── */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>수업 시작 시간</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {([{ label: "정각", value: 0 }, { label: "30분", value: 30 }] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={async () => {
                        try {
                          const jwt = await AsyncStorage.getItem("jwt");
                          await fetch(`${API_URL}/api/trainer/slot-settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ slotOffset: opt.value }) });
                          setSlotOffset(opt.value);
                          setManualTime(`09:${opt.value === 30 ? "30" : "00"}`);
                        } catch { Alert.alert("오류", "설정 저장에 실패했어요."); }
                      }}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1.5, borderColor: slotOffset === opt.value ? Colors.green : Colors.border, backgroundColor: slotOffset === opt.value ? Colors.greenLight : Colors.bgSub }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: slotOffset === opt.value ? Colors.green : Colors.textSub }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>주 시작 요일</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {([{ label: "월요일", value: 1 }, { label: "일요일", value: 0 }] as const).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setWeekStartDay(opt.value)}
                      style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", borderWidth: 1.5, borderColor: weekStartDay === opt.value ? Colors.green : Colors.border, backgroundColor: weekStartDay === opt.value ? Colors.greenLight : Colors.bgSub }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: "700", color: weekStartDay === opt.value ? Colors.green : Colors.textSub }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {/* ── 구분선 ── */}
            <View style={{ height: 1, backgroundColor: Colors.border, marginVertical: 14 }} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: Colors.textMuted, marginBottom: 10 }}>주간 뷰 설정</Text>

            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 8 }}>주간 뷰 크기</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {([{ label: "작게", value: 1 }, { label: "보통", value: 2 }, { label: "크게", value: 3 }] as const).map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={async () => {
                    setColScale(opt.value);
                    await AsyncStorage.setItem("weekColScale", String(opt.value));
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: colScale === opt.value ? Colors.green : Colors.border,
                    backgroundColor: colScale === opt.value ? Colors.greenLight : Colors.bgSub,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colScale === opt.value ? Colors.green : Colors.textSub }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12, justifyContent: "center" }}>
              {/* 시작 시간 */}
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>시작 시간</Text>
                <View style={{ borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSub, alignItems: "center", paddingVertical: 4, width: 90 }}>
                  <TouchableOpacity onPress={async () => {
                    const h = Math.max(0, weekStartHour - 1);
                    setWeekStartHour(h);
                    await AsyncStorage.setItem("weekStartHour", String(h));
                    try { const jwt = await AsyncStorage.getItem("jwt"); await fetch(`${API_URL}/api/trainer/slot-settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ weekStartHour: h }) }); } catch {}
                  }} style={{ paddingVertical: 6, paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>▲</Text>
                  </TouchableOpacity>
                  <View style={{ paddingVertical: 5, paddingHorizontal: 12, backgroundColor: Colors.greenLight, borderRadius: 6, marginVertical: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.green }}>{String(weekStartHour).padStart(2, "0")}:{slotOffset === 30 ? "30" : "00"}</Text>
                  </View>
                  <TouchableOpacity onPress={async () => {
                    const h = Math.min(23, weekStartHour + 1);
                    setWeekStartHour(h);
                    await AsyncStorage.setItem("weekStartHour", String(h));
                    try { const jwt = await AsyncStorage.getItem("jwt"); await fetch(`${API_URL}/api/trainer/slot-settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ weekStartHour: h }) }); } catch {}
                  }} style={{ paddingVertical: 6, paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={{ justifyContent: "center", paddingTop: 20 }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "600" }}>—</Text>
              </View>
              {/* 마지막 시간 */}
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>마지막 시간</Text>
                <View style={{ borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgSub, alignItems: "center", paddingVertical: 4, width: 90 }}>
                  <TouchableOpacity onPress={async () => {
                    const h = Math.max(12, weekEndHour - 1);
                    setWeekEndHour(h);
                    await AsyncStorage.setItem("weekEndHour", String(h));
                    try { const jwt = await AsyncStorage.getItem("jwt"); await fetch(`${API_URL}/api/trainer/slot-settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ weekEndHour: h }) }); } catch {}
                  }} style={{ paddingVertical: 6, paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>▲</Text>
                  </TouchableOpacity>
                  <View style={{ paddingVertical: 5, paddingHorizontal: 12, backgroundColor: Colors.greenLight, borderRadius: 6, marginVertical: 2 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.green }}>{String(weekEndHour).padStart(2, "0")}:{slotOffset === 30 ? "30" : "00"}</Text>
                  </View>
                  <TouchableOpacity onPress={async () => {
                    const h = Math.min(23, weekEndHour + 1);
                    setWeekEndHour(h);
                    await AsyncStorage.setItem("weekEndHour", String(h));
                    try { const jwt = await AsyncStorage.getItem("jwt"); await fetch(`${API_URL}/api/trainer/slot-settings`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` }, body: JSON.stringify({ weekEndHour: h }) }); } catch {}
                  }} style={{ paddingVertical: 6, paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 16, color: Colors.green, fontWeight: "700" }}>▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setShowOffsetModal(false)}
              style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: Colors.green, alignItems: "center" }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>확인</Text>
            </TouchableOpacity>
          </Pressable>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={editingMemo}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingMemo(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
            activeOpacity={1}
            onPress={() => setEditingMemo(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: Colors.border,
                borderRadius: 99,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                fontSize: 17,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 12,
              }}
            >
              {viewMonth}월 메모
            </Text>
            <TextInput
              value={memoInput}
              onChangeText={setMemoInput}
              placeholder="이달 메모를 입력하세요 (수업 계획, 공지사항 등)"
              placeholderTextColor={Colors.textMuted}
              multiline
              autoFocus
              textAlignVertical="top"
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 14,
                fontSize: 14,
                color: Colors.text,
                minHeight: 120,
                maxHeight: 220,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setEditingMemo(false)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: Colors.textSub }}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveMemo}
                disabled={savingMemo}
                style={{
                  flex: 2,
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                  opacity: savingMemo ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                >
                  {savingMemo ? "저장 중..." : "저장"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 회원 추가 모달 (슬롯 선택) ───────────────────────────────────── */}
      <Modal
        visible={addModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => Keyboard.dismiss()}
          />
          <Animated.View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
              maxHeight: "80%",
              transform: [{ translateY: addModalPanY }],
            }}
          >
            {/* 드래그 핸들 — 아래로 당기면 닫힘 */}
            <View
              {...addModalPan.panHandlers}
              style={{
                alignItems: "center",
                paddingVertical: 8,
                marginTop: -8,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 4,
              }}
            >
              {addingSlot?.startTime?.slice(0, 5)} 수업 추가
            </Text>

            {/* 수업 타입 선택 — 1×4 */}
            <View style={{ flexDirection: "row", gap: 6, marginVertical: 12 }}>
              {(
                ["PT", "OT", "PERSONAL_WORKOUT", "PERSONAL_SCHEDULE"] as const
              ).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setSessionType(type);
                    setOtName("");
                    setOtPhone("");
                    setPersonalNote("");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor:
                      sessionType === type ? sessionColor(type) : Colors.bgSub,
                    borderWidth: 1.5,
                    borderColor:
                      sessionType === type ? sessionColor(type) : Colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: sessionType === type ? "#fff" : Colors.textMuted,
                    }}
                  >
                    {type === "PT"
                      ? "PT"
                      : type === "OT"
                        ? "OT"
                        : type === "PERSONAL_WORKOUT"
                          ? "개인운동"
                          : "개인일정"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* OT: 이름 + 전화번호 입력 */}
            {sessionType === "OT" ? (
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  OT 고객 이름{" "}
                  <Text style={{ color: Colors.red, fontSize: 11 }}>*필수</Text>
                </Text>
                <TextInput
                  value={otName}
                  onChangeText={setOtName}
                  placeholder="고객 이름 입력"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 10,
                  }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  전화번호{" "}
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textMuted,
                      fontWeight: "400",
                    }}
                  >
                    (선택 · 정회원 전환 시 자동 연동)
                  </Text>
                </Text>
                <TextInput
                  value={otPhone}
                  onChangeText={(v) => setOtPhone(formatPhoneNumber(v))}
                  placeholder="010-0000-0000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />
                <TouchableOpacity
                  onPress={async () => {
                    const name = otName.trim();
                    if (!name) {
                      Alert.alert("오류", "OT 고객 이름을 입력해주세요.");
                      return;
                    }
                    if (!addingSlot) return;
                    const startT = addingSlot.startTime.slice(0, 5);
                    setAddingOt(true);
                    try {
                      const jwt = await AsyncStorage.getItem("jwt");
                      const headers = {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${jwt}`,
                      };
                      const phone = otPhone.trim();
                      const memberRes = await fetch(
                        `${API_URL}/api/trainer/manual-members`,
                        {
                          method: "POST",
                          headers,
                          body: JSON.stringify({
                            name,
                            phone: phone || undefined,
                            memo: "OT",
                          }),
                        },
                      );
                      if (!memberRes.ok)
                        throw new Error("고객 생성 실패");
                      const newMember = await memberRes.json();
                      const schedRes = await fetch(
                        `${API_URL}/api/schedule/create-and-confirm`,
                        {
                          method: "POST",
                          headers,
                          body: JSON.stringify({
                            date: addingSlot.date,
                            startTime: startT,
                            manualMemberId: newMember.id,
                            sessionType: "OT",
                          }),
                        },
                      );
                      if (!schedRes.ok)
                        throw new Error(
                          (await schedRes.text()) || "스케줄 추가 실패",
                        );
                      setAddModal(false);
                      setOtName("");
                      setOtPhone("");
                      setSessionType("PT");
                      cancelledIdsRef.current.clear();
                      fetchAll();
                      Alert.alert(
                        "완료 ✓",
                        `${name}님 OT 수업이 추가됐어요!`,
                      );
                    } catch (e: any) {
                      Alert.alert("오류", e.message);
                    } finally {
                      setAddingOt(false);
                    }
                  }}
                  disabled={addingOt || !otName.trim()}
                  style={{
                    backgroundColor:
                      addingOt || !otName.trim() ? Colors.border : "#F97316",
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    {addingOt ? "추가 중..." : "OT 수업 추가"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : isPersonalType(sessionType) ? (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  {"메모 "}
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textMuted,
                      fontWeight: "400",
                    }}
                  >
                    {"(선택)"}
                  </Text>
                </Text>
                <TextInput
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  placeholder={
                    sessionType === "PERSONAL_WORKOUT"
                      ? "운동 내용 메모"
                      : "일정 내용 메모"
                  }
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />
                <TouchableOpacity
                  onPress={() =>
                    addingSlot &&
                    addPersonalSchedule(
                      addingSlot.startTime.slice(0, 5),
                      addingSlot.date,
                    )
                  }
                  disabled={addingPersonal}
                  style={{
                    backgroundColor: addingPersonal
                      ? Colors.border
                      : sessionColor(sessionType),
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    {addingPersonal
                      ? "추가 중..."
                      : sessionType === "PERSONAL_WORKOUT"
                        ? "개인 운동 추가"
                        : "개인 일정 추가"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginBottom: 16,
                  }}
                >
                  이 시간에 추가할 회원을 선택하세요
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 4 }}>메모</Text>
                <TextInput
                  value={ptNote}
                  onChangeText={setPtNote}
                  placeholder="수업 메모를 입력하세요 (선택)"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.green + "88",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 13,
                    color: Colors.text,
                    marginBottom: 12,
                  }}
                />
                {/* 회원 검색 */}
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgSub, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, color: Colors.textMuted, marginRight: 6 }}>🔍</Text>
                  <TextInput
                    value={memberSearchQuery}
                    onChangeText={setMemberSearchQuery}
                    placeholder="회원 검색"
                    placeholderTextColor={Colors.textMuted}
                    style={{ flex: 1, fontSize: 13, color: Colors.text, padding: 0 }}
                  />
                </View>
                {/* FREE 5명 제한 안내 */}
                {plan === "FREE" && (
                  <TouchableOpacity onPress={() => { setAddModal(false); setTimeout(() => setPaymentVisible(true), 350); }} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: "#F97316" }}>🔒 FREE 플랜은 잔여횟수 적은 순 5명만 수업 추가 가능해요.</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#F97316" }}>PRO ›</Text>
                  </TouchableOpacity>
                )}
                <ScrollView showsVerticalScrollIndicator={false}>
                  {(() => {
                    const filtered = [...members]
                      .filter((m: any) => (m.ptRemaining ?? 0) > 0)
                      .sort((a: any, b: any) => a.name.localeCompare(b.name, "ko"))
                      .filter((m: any) => {
                        if (!memberSearchQuery) return true;
                        const isIncomplete = /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(memberSearchQuery);
                        if (isIncomplete) return true;
                        return m.name.includes(memberSearchQuery);
                      });
                    // FREE 플랜: 잔여 적은 순 5명만 unlock (0 포함 전체 기준)
                    const freeUnlockedIds = plan === "FREE"
                      ? new Set([...members].sort((a: any, b: any) => (a.ptRemaining ?? 0) - (b.ptRemaining ?? 0)).slice(0, 5).map((m: any) => `${m.isManual ? "manual" : "linked"}-${m.id}`))
                      : null;
                    return filtered.map((m: any, idx: number, arr: any[]) => {
                      const key = `${m.isManual ? "manual" : "linked"}-${m.id}`;
                      const locked = freeUnlockedIds !== null && !freeUnlockedIds.has(key);
                      return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => { if (locked) { setAddModal(false); setTimeout(() => setPaymentVisible(true), 350); } else { addMemberToSlot(m); } }}
                        disabled={addingMember && !locked}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 12,
                          borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                          borderBottomColor: Colors.border,
                          opacity: (addingMember && !locked) ? 0.5 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: Colors.green,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: "#fff",
                            }}
                          >
                            {m.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "700",
                                color: Colors.text,
                              }}
                            >
                              {m.name}
                            </Text>
                            {m.isManual && (
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: Colors.textMuted,
                                  fontWeight: "600",
                                }}
                              >
                                미연동
                              </Text>
                            )}
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 1,
                            }}
                          >
                            잔여 {m.ptRemaining}회
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: locked ? Colors.textMuted : Colors.green,
                          }}
                        >
                          {locked ? "🔒" : addingMember ? "..." : "추가"}
                        </Text>
                      </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
              </>
            )}

            <TouchableOpacity
              onPress={() => {
                setAddModal(false);
                setSessionType("PT");
                setOtName("");
              }}
              style={{ marginTop: 16, alignItems: "center", padding: 14 }}
            >
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                닫기
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 수동 스케줄 추가 모달 ──────────────────────────────────────────── */}
      <Modal
        visible={manualModal}
        transparent
        animationType="slide"
        onRequestClose={() => setManualModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => Keyboard.dismiss()}
          />
          <Animated.View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
              maxHeight: "90%",
              transform: [{ translateY: manualModalPanY }],
            }}
          >
            {/* 드래그 핸들 — 아래로 당기면 닫힘 */}
            <View
              {...manualModalPan.panHandlers}
              style={{
                alignItems: "center",
                paddingVertical: 8,
                marginTop: -8,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 4,
              }}
            >
              {manualTimeFixed
                ? `${manualTime} 스케줄 추가`
                : `${selDate.getMonth() + 1}월 ${selDate.getDate()}일 스케줄 추가`}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textMuted,
                marginBottom: 16,
              }}
            >
              시간 선택 후 회원을 탭하면 바로 확정돼요
            </Text>

            {/* 수업 타입 선택 — 1×4 */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
              {(
                ["PT", "OT", "PERSONAL_WORKOUT", "PERSONAL_SCHEDULE"] as const
              ).map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => {
                    setSessionType(type);
                    setOtName("");
                    setOtPhone("");
                    setPersonalNote("");
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 8,
                    alignItems: "center",
                    backgroundColor:
                      sessionType === type ? sessionColor(type) : Colors.bgSub,
                    borderWidth: 1.5,
                    borderColor:
                      sessionType === type ? sessionColor(type) : Colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: sessionType === type ? "#fff" : Colors.textMuted,
                    }}
                  >
                    {type === "PT"
                      ? "PT"
                      : type === "OT"
                        ? "OT"
                        : type === "PERSONAL_WORKOUT"
                          ? "개인운동"
                          : "개인일정"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 시간 선택 - 주간 셀 탭 시 숨김, + 버튼 시 선택 가능 */}
            {!manualTimeFixed && (
              <>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  시작 시간
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 20 }}
                >
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {makeTimeOptions(slotOffset === 30 ? 30 : 0).map((t) => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setManualTime(t)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor:
                            manualTime === t ? Colors.green : Colors.bgSub,
                          borderWidth: 1,
                          borderColor:
                            manualTime === t ? Colors.green : Colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: manualTime === t ? "#fff" : Colors.text,
                          }}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            {/* OT: 이름 + 전화번호 입력 / PT: 회원 선택 */}
            {sessionType === "OT" ? (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  OT 고객 이름{" "}
                  <Text style={{ color: Colors.red, fontSize: 11 }}>*필수</Text>
                </Text>
                <TextInput
                  value={otName}
                  onChangeText={setOtName}
                  placeholder="고객 이름 입력"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 10,
                  }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  전화번호{" "}
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textMuted,
                      fontWeight: "400",
                    }}
                  >
                    (선택 · 정회원 전환 자동 연동)
                  </Text>
                </Text>
                <TextInput
                  value={otPhone}
                  onChangeText={(v) => setOtPhone(formatPhoneNumber(v))}
                  placeholder="010-0000-0000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />
                <TouchableOpacity
                  onPress={addOtSchedule}
                  disabled={addingOt || !otName.trim()}
                  style={{
                    backgroundColor:
                      addingOt || !otName.trim() ? Colors.border : "#F97316",
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    {addingOt ? "추가 중..." : "OT 수업 추가"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : isPersonalType(sessionType) ? (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  {"메모 "}
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textMuted,
                      fontWeight: "400",
                    }}
                  >
                    {"(선택)"}
                  </Text>
                </Text>
                <TextInput
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  placeholder={
                    sessionType === "PERSONAL_WORKOUT"
                      ? "운동 내용 메모"
                      : "일정 내용 메모"
                  }
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />
                <TouchableOpacity
                  onPress={() =>
                    addPersonalSchedule(manualTime, toDateKey(selectedDate))
                  }
                  disabled={addingPersonal}
                  style={{
                    backgroundColor: addingPersonal
                      ? Colors.border
                      : sessionColor(sessionType),
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    {addingPersonal
                      ? "추가 중..."
                      : sessionType === "PERSONAL_WORKOUT"
                        ? "개인 운동 추가"
                        : "개인 일정 추가"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* 요일 다중 선택 */}
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>날짜 선택</Text>
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
                  {currentWeekDates.map((d) => {
                    const dk = toDateKey(d);
                    const isSelected = selectedDays.includes(dk);
                    const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];
                    const dayLabel = dayLabels[d.getDay()];
                    const dateNum = d.getDate();
                    return (
                      <TouchableOpacity
                        key={dk}
                        onPress={() => {
                          setSelectedDays(prev =>
                            prev.includes(dk) ? prev.filter(x => x !== dk) : [...prev, dk]
                          );
                        }}
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: isSelected ? Colors.green : Colors.bgSub,
                          borderWidth: 1.5,
                          borderColor: isSelected ? Colors.green : Colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: isSelected ? "#fff" : Colors.textMuted }}>{dayLabel}</Text>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: isSelected ? "#fff" : Colors.text }}>{dateNum}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 4 }}>메모</Text>
                <TextInput
                  value={ptNote}
                  onChangeText={setPtNote}
                  placeholder="수업 메모를 입력하세요 (선택)"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: sessionColor(sessionType) + "88",
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 13,
                    color: Colors.text,
                    marginBottom: 10,
                  }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 4,
                  }}
                >
                  회원 선택
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgSub, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, marginBottom: 8, height: 36 }}>
                  <Text style={{ fontSize: 13, color: Colors.textMuted, marginRight: 6 }}>🔍</Text>
                  <TextInput
                    value={memberSearchQuery}
                    onChangeText={setMemberSearchQuery}
                    placeholder="회원 검색"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{ flex: 1, fontSize: 13, color: Colors.text, paddingVertical: 0 }}
                  />
                </View>
                {/* FREE 5명 제한 안내 */}
                {plan === "FREE" && (
                  <TouchableOpacity onPress={() => { setManualModal(false); setTimeout(() => setPaymentVisible(true), 350); }} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, gap: 6 }}>
                    <Text style={{ fontSize: 12, color: "#F97316" }}>🔒 FREE 플랜은 잔여횟수 적은 순 5명만 수업 추가 가능해요.</Text>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#F97316" }}>PRO ›</Text>
                  </TouchableOpacity>
                )}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 260 }}
                >
                  {(() => {
                    const filtered = [...members]
                      .filter((m: any) => (m.ptRemaining ?? 0) > 0)
                      .filter((m: any) => {
                        if (!memberSearchQuery) return true;
                        const isIncomplete = /^[ㄱ-ㅎㅏ-ㅣ]+$/.test(memberSearchQuery);
                        if (isIncomplete) return true;
                        return m.name.includes(memberSearchQuery);
                      })
                      .sort((a: any, b: any) => a.name.localeCompare(b.name, "ko"));
                    const freeUnlockedIds = plan === "FREE"
                      ? new Set([...members].sort((a: any, b: any) => (a.ptRemaining ?? 0) - (b.ptRemaining ?? 0)).slice(0, 5).map((m: any) => `${m.isManual ? "manual" : "linked"}-${m.id}`))
                      : null;
                    return filtered.map((m: any, idx: number, arr: any[]) => {
                      const key = `${m.isManual ? "manual" : "linked"}-${m.id}`;
                      const locked = freeUnlockedIds !== null && !freeUnlockedIds.has(key);
                      return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => { if (locked) { setManualModal(false); setTimeout(() => setPaymentVisible(true), 350); } else { addManualSchedule(m); } }}
                        disabled={addingManual && !locked}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 12,
                          borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                          borderBottomColor: Colors.border,
                          opacity: (addingManual && !locked) ? 0.5 : 1,
                        }}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            backgroundColor: Colors.green,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 12,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "800",
                              color: "#fff",
                            }}
                          >
                            {m.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "700",
                                color: Colors.text,
                              }}
                            >
                              {m.name}
                            </Text>
                            {m.isManual && (
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: Colors.textMuted,
                                  fontWeight: "600",
                                }}
                              >
                                미연동
                              </Text>
                            )}
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 1,
                            }}
                          >
                            잔여 {m.ptRemaining}회
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: locked ? Colors.textMuted : Colors.green,
                          }}
                        >
                          {locked ? "🔒" : addingManual ? "..." : "추가"}
                        </Text>
                      </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
              </>
            )}
            <TouchableOpacity
              onPress={() => {
                setManualModal(false);
                setSessionType("PT");
                setOtName("");
                setMemberSearchQuery("");
              }}
              style={{ marginTop: 16, alignItems: "center", padding: 14 }}
            >
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                닫기
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 주간 슬롯 long press 액션 모달 */}
      <Modal
        visible={slotActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setSlotActionModal(false); setRescheduleDate(null); setRescheduleTime(null); }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 }}
          activeOpacity={1}
          onPress={() => { setSlotActionModal(false); setRescheduleDate(null); setRescheduleTime(null); }}
        >
          <TouchableOpacity activeOpacity={1} style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "85%", maxHeight: "85%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text, flex: 1 }}>
                {isPersonalType(slotActionTarget?.sessionType ?? "")
                  ? sessionLabel(slotActionTarget?.sessionType ?? "")
                  : (slotActionTarget?.memberName ?? "수업")}
              </Text>
              <TouchableOpacity onPress={() => { setSlotActionModal(false); setRescheduleDate(null); setRescheduleTime(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 18, color: Colors.textMuted, lineHeight: 22 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 12 }}>
              {slotActionTarget?._date
                ? `${slotActionTarget._date.getMonth() + 1}월${slotActionTarget._date.getDate()}일 ${(slotActionTarget.startTime ?? "").slice(0, 5)}`
                : ""}
            </Text>

            {/* 메모 */}
            {editingNoteSlotId === slotActionTarget?.id ? (
              <View style={{ marginBottom: 14 }}>
                <TextInput
                  value={editingNoteText}
                  onChangeText={setEditingNoteText}
                  placeholder="메모 입력"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  multiline
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: Colors.green,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    fontSize: 13,
                    color: Colors.text,
                    lineHeight: 18,
                    minHeight: 44,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                  <TouchableOpacity
                    onPress={() => setEditingNoteSlotId(null)}
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: Colors.border }}
                  >
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        const jwt = await AsyncStorage.getItem("jwt");
                        await fetch(`${API_URL}/api/schedule/${slotActionTarget.id}/note`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
                          body: JSON.stringify({ note: editingNoteText }),
                        });
                        setSlots((prev) => prev.map((s) => s.id === slotActionTarget.id ? { ...s, note: editingNoteText || null } : s));
                        setEditingNoteSlotId(null);
                        setSlotActionModal(false);
                        Alert.alert("완료", "메모가 저장됐어요.");
                      } catch { Alert.alert("오류", "메모 저장에 실패했어요."); }
                    }}
                    style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7, backgroundColor: Colors.green }}
                  >
                    <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>저장</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => { setEditingNoteSlotId(slotActionTarget?.id); setEditingNoteText(slotActionTarget?.note ?? ""); }}
                style={{ backgroundColor: Colors.bgSub, borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: Colors.border }}
              >
                {slotActionTarget?.note
                  ? <Text style={{ fontSize: 13, color: Colors.textMuted, lineHeight: 18 }}>{slotActionTarget.note}</Text>
                  : <Text style={{ fontSize: 13, color: Colors.textPlaceholder, lineHeight: 18 }}>메모 추가...</Text>
                }
              </TouchableOpacity>
            )}

            {/* 날짜/시간 변경 */}
            {slotActionTarget?.status === "CONFIRMED" && (() => {
              const target = slotActionTarget;
              const targetDate: Date = target._date ?? new Date();
              // 그 주 월~일 날짜 생성
              const weekDays: Date[] = [];
              const dayOfWeek = targetDate.getDay(); // 0=일
              const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
              const monday = new Date(targetDate);
              monday.setDate(targetDate.getDate() + mondayOffset);
              for (let i = 0; i < 7; i++) {
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                weekDays.push(d);
              }
              const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
              // 시간 옵션 (트레이너 주간 시작~끝, 슬롯 오프셋 기준)
              const timeOptions: string[] = [];
              for (let h = weekStartHour; h <= weekEndHour; h++) {
                if (slotOffset === 30) {
                  timeOptions.push(`${String(h).padStart(2, "0")}:30`);
                } else {
                  timeOptions.push(`${String(h).padStart(2, "0")}:00`);
                }
              }
              const selectedDateStr = rescheduleDate ?? `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
              const selectedTimeStr = rescheduleTime ?? (target.startTime ?? "").slice(0, 5);

              return (
                <View style={{ marginBottom: 14 }}>
                  {/* 날짜변경 */}
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>날짜변경</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {weekDays.map((d) => {
                        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        const isSelected = ds === selectedDateStr;
                        return (
                          <TouchableOpacity
                            key={ds}
                            onPress={() => setRescheduleDate(ds)}
                            style={{ alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: isSelected ? Colors.green : Colors.bgSub, borderWidth: 1, borderColor: isSelected ? Colors.green : Colors.border }}
                          >
                            <Text style={{ fontSize: 11, color: isSelected ? "#fff" : Colors.textMuted }}>{DAY_LABELS[d.getDay()]}</Text>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? "#fff" : Colors.text }}>{d.getDate()}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                  {/* 시간변경 */}
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>시간변경</Text>
                  {(() => {
                    const selectedIdx = timeOptions.indexOf(selectedTimeStr);
                    const ITEM_W = 58;
                    return (
                      <RescheduleTimeFlatList
                        timeOptions={timeOptions}
                        selectedTimeStr={selectedTimeStr}
                        selectedIdx={selectedIdx}
                        ITEM_W={ITEM_W}
                        listRef={rescheduleTimeListRef}
                        onSelect={(t) => setRescheduleTime(t)}
                      />
                    );
                  })()}
                  {/* 변경 버튼 (항상 표시) */}
                  {true && (
                    <View style={{ flexDirection: "row", gap: 6, justifyContent: "flex-end" }}>
                      <TouchableOpacity
                        onPress={() => { setRescheduleDate(null); setRescheduleTime(null); }}
                        style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: Colors.border }}
                      >
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={rescheduling}
                        onPress={async () => {
                          try {
                            setRescheduling(true);
                            const jwt = await AsyncStorage.getItem("jwt");
                            const res = await fetch(`${API_URL}/api/schedule/${target.id}/reschedule`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
                              body: JSON.stringify({ date: selectedDateStr, startTime: selectedTimeStr + ":00" }),
                            });
                            if (!res.ok) throw new Error("변경 실패");
                            setRescheduleDate(null);
                            setRescheduleTime(null);
                            setSlotActionModal(false);
                            fetchAll();
                            Alert.alert("완료", "일정이 변경됐어요.");
                          } catch { Alert.alert("오류", "일정 변경에 실패했어요."); }
                          finally { setRescheduling(false); }
                        }}
                        style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 7, backgroundColor: Colors.green }}
                      >
                        <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>{rescheduling ? "변경 중..." : "변경"}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {slotActionTarget?.status === "CONFIRMED" && (
              <>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textMuted, marginBottom: 10 }}>수업 상태 변경</Text>
                {!isPersonalType(slotActionTarget?.sessionType ?? "") && (
                  <TouchableOpacity
                    onPress={() => completeSlot(slotActionTarget)}
                    style={{
                      backgroundColor: Colors.blueBg,
                      borderWidth: 1,
                      borderColor: Colors.blue + "55",
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.blue }}>완료</Text>
                  </TouchableOpacity>
                )}
                {!isPersonalType(slotActionTarget?.sessionType ?? "") && (
                  <TouchableOpacity
                    onPress={() => noShowSlot(slotActionTarget)}
                    style={{
                      backgroundColor: "#F3F4F6",
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#6B7280" }}>노쇼</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => { setSlotActionModal(false); cancelSlot(slotActionTarget); }}
                  style={{
                    backgroundColor: Colors.redBg,
                    borderWidth: 1,
                    borderColor: Colors.red + "44",
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.red }}>취소</Text>
                </TouchableOpacity>
              </>
            )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 업그레이드 바텀시트 ──────────────────────────────────────────── */}
      <Modal
        visible={paymentVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setPaymentVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 28,
                paddingBottom: 40,
              }}
            >
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 20 }}>PRO 플랜으로 업그레이드</Text>
              <View style={{ borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: Colors.green + "55", backgroundColor: Colors.greenLight, marginBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.green }}>PRO</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                    <Text style={{ fontSize: 26, fontWeight: "900", color: Colors.green }}>14,900</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green, marginBottom: 3 }}>원/월</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: Colors.textSub, lineHeight: 20, marginBottom: 10 }}>{"✓ 회원 무제한 관리\n   PRO로 업그레이드해서 회원 수 제한 없이\n   모든 회원을 관리할 수 있어요."}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      if (!Purchases || typeof Purchases.getOfferings !== "function") {
                        Alert.alert("오류", "결제 모듈을 불러오지 못했어요.");
                        return;
                      }
                      const offerings = await Purchases.getOfferings();
                      const pkg = offerings.current?.monthly ?? offerings.current?.availablePackages[0];
                      if (!pkg) { Alert.alert("오류", "구독 상품을 불러오지 못했어요."); return; }
                      await Purchases.purchasePackage(pkg);
                      setPlan("PRO");
                      setPaymentVisible(false);
                      Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                    } catch (e: any) {
                      if (!e.userCancelled) Alert.alert("결제 실패", e.message ?? "다시 시도해주세요.");
                    }
                  }}
                  style={{ marginTop: 16, backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>시작하기</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const customerInfo = await Purchases.restorePurchases();
                    if (customerInfo.entitlements.active["FitLogApp Pro"]) {
                      setPlan("PRO");
                      setPaymentVisible(false);
                      Alert.alert("복원 완료", "구독이 복원됐어요.");
                    } else {
                      Alert.alert("복원 없음", "복원할 구독이 없어요.");
                    }
                  } catch (e: any) {
                    Alert.alert("오류", e?.message ?? "복원에 실패했어요.");
                  }
                }}
              >
                <Text style={{ textAlign: "center", fontSize: 14, color: Colors.textMuted }}>구독 복원하기</Text>
              </TouchableOpacity>
              <Text style={{ textAlign: "center", fontSize: 11, color: Colors.textMuted, lineHeight: 17, marginTop: 20, marginBottom: 4 }}>
                {Platform.OS === "ios"
                  ? "구독은 매월 자동 갱신되며, 다음 결제일 24시간 전까지\nApple ID 설정 > 구독에서 취소할 수 있습니다.\n환불은 Apple 정책에 따릅니다."
                  : "구독은 매월 자동 갱신되며, 다음 결제일 24시간 전까지\nGoogle Play에서 취소할 수 있습니다.\n환불은 Google Play 정책에 따릅니다."}
              </Text>
              <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setPaymentVisible(false)}>
                <Text style={{ textAlign: "center", fontSize: 14, color: Colors.textMuted }}>나중에 할게요</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
