import AsyncStorage from "@react-native-async-storage/async-storage";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { apiGet, getWeekDates, toDateKey } from "../../../hooks/useApi";
import { DietFeedback, DietResponse, FitLog, Member } from "../../../types";

const SCREEN_W = Dimensions.get("window").width - 72;

interface BodyLog {
  date: string;
  weight?: number;
  bodyFatMass?: number; // 체지방량 (kg)
  bodyFat?: number; // 체지방률 (%) - 자동계산
  muscleMass?: number;
}

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const MEAL_TYPES = [
  { key: "BREAKFAST", label: "아침" },
  { key: "LUNCH", label: "점심" },
  { key: "DINNER", label: "저녁" },
  { key: "SNACK", label: "간식" },
];

const DEFAULT_GOALS = {
  kcal: 2000,
  carbs: 0,
  protein: 0,
  fat: 0,
};

// 날짜(+시간) 포맷 헬퍼: "2024-01-15T14:30:00" → "2024.01.15 오후 2:30"
const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  if (dateStr.includes("T") || (dateStr.includes(" ") && dateStr.length > 10)) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "오후" : "오전";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${y}.${m}.${day} ${ampm} ${h12}:${min}`;
  }
  return dateStr.replace(/-/g, ".");
};

export default function MemberDetailScreen() {
  const { id, initialTab } = useLocalSearchParams<{ id: string; initialTab?: string }>();
  const memberId = Number(id);

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab ? Number(initialTab) : 0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const weekDates = getWeekDates(weekOffset);
  const isToday = toDateKey(selectedDate) === toDateKey(new Date());

  const [dietData, setDietData] = useState<DietResponse | null>(null);
  const [goalKcal, setGoalKcal] = useState(DEFAULT_GOALS.kcal);
  const [goalCarbs, setGoalCarbs] = useState(DEFAULT_GOALS.carbs);
  const [goalProtein, setGoalProtein] = useState(DEFAULT_GOALS.protein);
  const [goalFat, setGoalFat] = useState(DEFAULT_GOALS.fat);
  const [feedbacks, setFeedbacks] = useState<DietFeedback[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const [fitLogs, setFitLogs] = useState<FitLog[]>([]);
  const [allFitLogs, setAllFitLogs] = useState<FitLog[]>([]);
  const [fitLogHistoryLoaded, setFitLogHistoryLoaded] = useState(false);
  const [exerciseSuggest, setExerciseSuggest] = useState<{ ei: number; names: string[] } | null>(null);
  // 주 단위 캐시: weekKey → logs
  const [fitLogCache, setFitLogCache] = useState<{
    [weekKey: string]: FitLog[];
  }>({});
  const [fitLogsLoading, setFitLogsLoading] = useState(false);
  const didLoadWorkoutRef = useRef(false);
  const fetchingFitLogKeyRef = useRef<string | null>(null);
  const fetchingFitLogHistoryRef = useRef(false);
  const [exercises, setExercises] = useState([
    { name: "", sets: [{ weight: "", reps: "" }] },
  ]);
  const [showFitLogForm, setShowFitLogForm] = useState(false);
  const [editingFitLogId, setEditingFitLogId] = useState<number | null>(null);
  const [savingFitLog, setSavingFitLog] = useState(false);

  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [showPTEdit, setShowPTEdit] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ptForm, setPtForm] = useState({
    sessions: "0",
    startDate: todayStr,
    endDate: "",
    memo: "",
  });

  const fetchMember = async () => {
    try {
      const data = await apiGet<Member>(`/api/trainer/members/${memberId}`);
      setMember(data);
      setPtForm({
        sessions: "0",
        startDate: todayStr,
        endDate: data.ptExpDate || "",
        memo: "",
      });
      applyGoalData(data);
    } catch {
      setMember({
        id: memberId,
        user: { id: memberId, name: "회원" },
        ptRemaining: 0,
        ptTotal: 0,
      } as any);
    }
  };

  const applyGoalData = (data: any) => {
    const kcal = Number(
      data?.targetCalories ??
        data?.goalCalories ??
        data?.kcal ??
        DEFAULT_GOALS.kcal,
    );
    const carbs = Number(
      data?.targetCarbs ??
        data?.goalCarbs ??
        data?.carbs ??
        DEFAULT_GOALS.carbs,
    );
    const protein = Number(
      data?.targetProtein ??
        data?.goalProtein ??
        data?.protein ??
        DEFAULT_GOALS.protein,
    );
    const fat = Number(
      data?.targetFat ?? data?.goalFat ?? data?.fat ?? DEFAULT_GOALS.fat,
    );

    setGoalKcal(Number.isFinite(kcal) && kcal > 0 ? kcal : DEFAULT_GOALS.kcal);
    setGoalCarbs(Number.isFinite(carbs) ? carbs : DEFAULT_GOALS.carbs);
    setGoalProtein(Number.isFinite(protein) ? protein : DEFAULT_GOALS.protein);
    setGoalFat(Number.isFinite(fat) ? fat : DEFAULT_GOALS.fat);
  };

  const fetchMemberGoals = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const urls = [
        `${API_URL}/api/member/goals/member/${memberId}`,
        `${API_URL}/api/trainer/members/${memberId}/goals`,
        `${API_URL}/api/member/${memberId}/goals`,
      ];

      for (const url of urls) {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (res.ok) {
          const data = await res.json();
          applyGoalData(data);
          return;
        }
      }
    } catch {}
  };

  const fetchDiet = async () => {
    try {
      const data = await apiGet<DietResponse>(
        `${ENDPOINTS.diet.member(memberId)}?date=${toDateKey(selectedDate)}`,
      );
      setDietData(data);
    } catch {
      setDietData(null);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const data = await apiGet<DietFeedback[]>(
        ENDPOINTS.diet.feedbackByMember(memberId),
      );
      setFeedbacks(data);
    } catch {
      setFeedbacks([]);
    }
  };

  const fetchFitLogs = async (forceRefresh = false) => {
    // 주 단위 캐시 키
    console.log("fetchFitLogs 호출");
    const weekStart = getWeekDates(weekOffset)[0];
    const weekEnd = getWeekDates(weekOffset)[6];
    const weekKey = `${memberId}_${toDateKey(weekStart)}_${toDateKey(weekEnd)}`;

    // 캐시 있으면 즉시 표시
    if (!forceRefresh && fitLogCache[weekKey]) {
      setFitLogs(fitLogCache[weekKey]);
      return;
    }

    // 같은 주차 요청이 이미 진행 중이면 중복 조회 방지
    if (!forceRefresh && fetchingFitLogKeyRef.current === weekKey) {
      return;
    }

    fetchingFitLogKeyRef.current = weekKey;
    setFitLogsLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/fitlog/member/${memberId}?from=${toDateKey(weekStart)}&to=${toDateKey(weekEnd)}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (!res.ok) throw new Error();
      const data: FitLog[] = await res.json();
      // 캐시 저장
      setFitLogCache((prev) => ({ ...prev, [weekKey]: data }));
      setFitLogs(data);
    } catch {
      setFitLogs([]);
    } finally {
      if (fetchingFitLogKeyRef.current === weekKey) {
        fetchingFitLogKeyRef.current = null;
      }
      setFitLogsLoading(false);
    }
  };

  const fetchFitLogHistory = async (forceRefresh = false) => {
    if (!forceRefresh && fitLogHistoryLoaded) return;
    if (!forceRefresh && fetchingFitLogHistoryRef.current) return;

    fetchingFitLogHistoryRef.current = true;

    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/fitlog/member/${memberId}?from=2000-01-01&to=${toDateKey(new Date())}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );

      if (!res.ok) throw new Error();

      const data: FitLog[] = await res.json();
      setAllFitLogs(data);
      setFitLogHistoryLoaded(true);
    } catch (e) {
      console.log("운동 기록 전체 이력 조회 실패:", e);
    } finally {
      fetchingFitLogHistoryRef.current = false;
    }
  };

  // 날짜별 필터 (캐시된 데이터에서)
  const selectedDateKey = toDateKey(selectedDate);
  const dayFitLogs = fitLogs.filter(
    (l: any) => String(l.date ?? l.logDate).slice(0, 10) === selectedDateKey,
  );
  const dayPtLogs = dayFitLogs.filter((l: any) => l.workoutType === "PT");
  const dayPersonalLogs = dayFitLogs.filter(
    (l: any) => l.workoutType === "PERSONAL",
  );

  const getExerciseNameSuggestions = (query: string): string[] => {
    if (!query.trim()) return [];
    const q = query.replaceAll(" ", "").toLowerCase();
    const source = allFitLogs.length > 0 ? allFitLogs : fitLogs;
    const names = new Set<string>();
    source.forEach((log: any) => {
      (log.exercises ?? []).forEach((ex: any) => {
        if (ex.name && ex.name.replaceAll(" ", "").toLowerCase().includes(q)) {
          names.add(ex.name);
        }
      });
    });
    return Array.from(names).slice(0, 5);
  };

  const normalizeExerciseName = (name: string) =>
    name.trim().replace(/\s+/g, " ").toLowerCase();

  const getLatestSameExercise = (exerciseName: string) => {
    const targetName = normalizeExerciseName(exerciseName);
    if (!targetName) return null;

    const selectedDateKey = toDateKey(selectedDate);

    const historySource = allFitLogs.length > 0 ? allFitLogs : fitLogs;

    const candidates = historySource
      .map((log: any) => ({
        ...log,
        date: String(log.date ?? log.logDate ?? log.log_date).slice(0, 10),
        workoutId: log.workoutId ?? log.workout_id ?? log.id ?? 0,
        exercises: log.exercises ?? log.sets ?? log.workoutSets ?? [],
      }))
      .filter((log: any) => log.date < selectedDateKey)
      .filter(
        (log: any) => Number(log.workoutId) !== Number(editingFitLogId ?? -1),
      )
      .flatMap((log: any) =>
        (log.exercises || [])
          .filter(
            (ex: any) => normalizeExerciseName(ex.name || "") === targetName,
          )
          .map((ex: any) => ({
            date: log.date,
            workoutId: log.workoutId,
            exercise: ex,
          })),
      )
      .sort((a: any, b: any) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return Number(b.workoutId) - Number(a.workoutId);
      });

    return candidates[0] ?? null;
  };

  const fetchBodyLogs = async () => {
    try {
      const raw = await apiGet<any[]>(ENDPOINTS.bodylog.member(memberId));
      // 체지방률 자동계산: bodyFatMass / weight * 100
      const processed: BodyLog[] = raw.map((l) => ({
        date: l.createdAt || l.logDate || l.date,
        weight: l.weight,
        bodyFatMass: l.bodyFatMass,
        bodyFat:
          l.bodyFatMass && l.weight
            ? Math.round((l.bodyFatMass / l.weight) * 1000) / 10
            : l.bodyFat,
        muscleMass: l.muscleMass,
      }));
      setBodyLogs(processed);
    } catch {
      setBodyLogs([]);
    }
  };

// 알림에서 initialTab param이 오면 해당 탭으로 이동
useEffect(() => {
  if (initialTab !== undefined) {
    setTab(Number(initialTab));
  }
}, [initialTab]);

// 회원 기본 정보 + 최신 목표
useEffect(() => {
  const init = async () => {
    setLoading(true);
    await fetchMember();
    await fetchMemberGoals();
    setLoading(false);
  };

  init();
}, [memberId]);

// 탭 전환 시 운동/바디만 처리
useEffect(() => {
  if (tab === 1) {
    if (!didLoadWorkoutRef.current) {
      didLoadWorkoutRef.current = true;
      fetchFitLogs();
      fetchFitLogHistory();
    }
  } else if (tab === 2) {
    fetchBodyLogs();
  }
}, [tab]);

// 식단 탭: 날짜 변경 시 식단 + 피드백 조회
useEffect(() => {
  if (tab === 0) {
    fetchDiet();
    fetchFeedbacks();
  }
}, [tab, selectedDate, memberId]);

// 운동 탭: 주 변경 시만
useEffect(() => {
  if (tab !== 1 || !didLoadWorkoutRef.current) return;
  fetchFitLogs();
}, [weekOffset]);

  const sendFeedback = async () => {
    if (!feedbackText.trim()) return;

    setSendingFeedback(true);

    try {
      const jwt = await AsyncStorage.getItem("jwt");

      const res = await fetch(`${API_URL}${ENDPOINTS.diet.feedback}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          memberId,
          targetDate: toDateKey(selectedDate),
          comment: feedbackText,
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "피드백 전송 실패");
      }

      setFeedbackText("");
      fetchFeedbacks();
      Alert.alert("완료", "피드백이 전송됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "피드백 전송 중 오류가 발생했어요.");
    } finally {
      setSendingFeedback(false);
    }
  };

  const resetFitLogForm = () => {
    setExercises([{ name: "", sets: [{ weight: "", reps: "" }] }]);
    setEditingFitLogId(null);
    setShowFitLogForm(false);
  };

  const startEditFitLog = (log: any) => {
    setEditingFitLogId(log.id ?? log.workoutId ?? null);
    setExercises(
      (log.exercises ?? []).map((ex: any) => ({
        name: ex.name ?? "",
        sets: (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
        })),
      })),
    );
    setShowFitLogForm(true);
  };

  const saveFitLog = async () => {
    const valid = exercises.filter((ex) => ex.name.trim());
    if (!valid.length) {
      Alert.alert("오류", "운동명을 입력해주세요.");
      return;
    }
    setSavingFitLog(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const url = editingFitLogId
        ? `${API_URL}/api/fitlog/${editingFitLogId}`
        : `${API_URL}${ENDPOINTS.fitlog.create}`;

      const res = await fetch(url, {
        method: editingFitLogId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          memberId,
          date: toDateKey(selectedDate),
          exercises: valid.map((ex) => ({
            name: ex.name,
            sets: ex.sets
              .filter((s) => s.weight || s.reps)
              .map((s, i) => ({
                setNumber: i + 1,
                weight: parseFloat(s.weight) || 0,
                reps: parseInt(s.reps) || 0,
              })),
          })),
        }),
      });

      if (!res.ok) {
        const message = await res.text();

        if (editingFitLogId && res.status === 404) {
          throw new Error(
            "운동 기록 수정 API를 찾지 못했어요. 백엔드 FitLogController에 PUT /api/fitlog/{id}가 있는지 확인해주세요.",
          );
        }

        throw new Error(message || "PT 기록 저장 실패");
      }
      Alert.alert(
        "완료",
        editingFitLogId
          ? "PT 수업 기록이 수정됐어요!"
          : "PT 수업 기록이 등록됐어요! 회원에게 알림이 전송됩니다.",
      );
      resetFitLogForm();
      // 캐시 무효화 후 재조회
      setFitLogCache({});
      setFitLogHistoryLoaded(false);
      await fetchMember();
      fetchFitLogs(true);
      fetchFitLogHistory(true);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSavingFitLog(false);
    }
  };

  const savePT = async () => {
    if (!ptForm.sessions || Number(ptForm.sessions) <= 0) {
      Alert.alert("오류", "추가할 횟수를 입력해주세요.");
      return;
    }
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/trainer/members/${memberId}/pt/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            sessions: Number(ptForm.sessions),
            startDate: ptForm.startDate || undefined,
            endDate: ptForm.endDate || undefined,
            memo: ptForm.memo || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error("PT 추가 실패");
      setShowPTEdit(false);
      fetchMember();
      Alert.alert("완료", `PT ${ptForm.sessions}회가 추가됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    }
  };

  if (loading || !member) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const ptPct =
    member.ptTotal > 0 ? ((member.ptRemaining || 0) / member.ptTotal) * 100 : 0;
  const totalCalories = dietData?.totalCalories ?? 0;
  const dietPct =
    goalKcal > 0 ? Math.round((totalCalories / goalKcal) * 100) : 0;
  const selectedDateFeedbacks = feedbacks.filter(
    (fb) => fb.targetDate === toDateKey(selectedDate),
  );

  const WeekCalendar = () => (
    <View
      style={{
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w - 1)}
          style={{ padding: 6 }}
        >
          <Text style={{ fontSize: 20, color: Colors.green }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub }}
        >
          {weekOffset === 0
            ? "이번 주"
            : weekOffset < 0
              ? `${Math.abs(weekOffset)}주 전`
              : `+${weekOffset}주`}
          {"  "}
          {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} ~{" "}
          {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
        </Text>
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => Math.min(w + 1, 0))}
          style={{ padding: 6, opacity: weekOffset === 0 ? 0.3 : 1 }}
        >
          <Text style={{ fontSize: 20, color: Colors.green }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {weekDates.map((date, i) => {
          const key = toDateKey(date);
          const isSelected = toDateKey(selectedDate) === key;
          const isToday = toDateKey(new Date()) === key;
          const workoutLogsForDate = fitLogs.filter((log: any) => {
            const logDate = String(
              log.date ?? log.logDate ?? log.log_date ?? "",
            ).slice(0, 10);
            return logDate === key;
          });

          const dayHasPt = workoutLogsForDate.some((log: any) => {
            const type = String(
              log.workoutType ?? log.workout_type ?? log.type ?? "",
            ).toUpperCase();
            return type === "PT";
          });

          const dayHasPersonal = workoutLogsForDate.some((log: any) => {
            const type = String(
              log.workoutType ?? log.workout_type ?? log.type ?? "",
            ).toUpperCase();
            return type === "PERSONAL" || type === "PERSONAL_WORKOUT";
          });

          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDate(date)}
              style={{ alignItems: "center", gap: 4 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  fontWeight: "600",
                }}
              >
                {WEEK_DAYS[i]}
              </Text>

              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isSelected
                    ? Colors.green
                    : isToday
                      ? Colors.greenLight
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
                    fontWeight: "700",
                    color: isSelected
                      ? "#fff"
                      : isToday
                        ? Colors.green
                        : Colors.text,
                  }}
                >
                  {date.getDate()}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 3,
                  height: 6,
                  alignItems: "center",
                }}
              >
                {dayHasPt ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: Colors.green,
                    }}
                  />
                ) : null}
                {dayHasPersonal ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: "#4A90FF",
                    }}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: Colors.green,
            }}
          />
          <Text
            style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}
          >
            PT
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#4A90FF",
            }}
          />
          <Text
            style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}
          >
            개인운동
          </Text>
        </View>
      </View>
    </View>
  );

  // 체중 그래프 컴포넌트
  const BodyGraph = ({
    logs,
    metric,
    color,
    label,
    unit,
    isLast = false,
  }: {
    logs: BodyLog[];
    metric: keyof BodyLog;
    color: string;
    label: string;
    unit: string;
    isLast?: boolean;
  }) => {
    const TOTAL_SLOTS = 8;
    const data = logs.slice(-8);

    const validData = data.filter((log) => {
      const value = log[metric] as number | undefined;
      return value !== undefined && value !== null && value > 0;
    });

    if (validData.length < 1) return null;

    const chartH = 42;
    const chartPadX = 18;
    const chartW = SCREEN_W - 36;
    const stepX = chartW / (TOTAL_SLOTS - 1);

    const values = validData.map((log) => log[metric] as number);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);

    const diff = maxV - minV;
    const padding = diff === 0 ? 0.5 : diff * 0.15;
    minV = minV - padding;
    maxV = maxV + padding;
    const range = maxV - minV || 1;

    const graphColor = color;

    const points = validData.map((log, i) => {
      const value = log[metric] as number;
      const x = chartPadX + i * stepX;

      return {
        x,
        y: chartH - ((value - minV) / range) * (chartH - 20) - 10,
        val: value,
        date: String(log.date ?? "").slice(0, 10).slice(5),
      };
    });

    return (
      <View style={{ marginBottom: isLast ? 0 : 26, width: SCREEN_W }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: Colors.text,
            marginBottom: 18,
          }}
        >
          {label}
        </Text>

        <View
          style={{ height: chartH + 24, position: "relative", width: SCREEN_W }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: SCREEN_W,
              height: chartH,
            }}
          >
            {/* 그리드 라인 */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: chartPadX + i * stepX,
                  top: 0,
                  width: 1,
                  height: chartH,
                  backgroundColor: Colors.border + "40",
                }}
              />
            ))}

            {/* 라인 */}
            {points.map((p, i) => {
              if (i >= points.length - 1) return null;

              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    width: len,
                    height: 2,
                    backgroundColor: graphColor,
                    transformOrigin: "left center",
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* 포인트 + 수치 */}
            {points.map((p, i) => (
              <View key={i}>
                <View
                  style={{
                    position: "absolute",
                    left: p.x - 3.5,
                    top: p.y - 3.5,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: graphColor,
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />

                <View
                  style={{
                    position: "absolute",
                    left: p.x - 22,
                    top: p.y - 16,
                    width: 44,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: graphColor,
                    }}
                  >
                    {Number(p.val).toFixed(1).replace(/\.0$/, "")}
                    {unit}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* x축 날짜 라벨 */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: chartH + 8,
              width: SCREEN_W,
              height: 16,
            }}
          >
            {points.map((p, i) => (
              <Text
                key={i}
                style={{
                  position: "absolute",
                  left: p.x - 22,
                  width: 44,
                  textAlign: "center",
                  fontSize: 7,
                  color: Colors.textMuted,
                }}
              >
                {p.date}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };


  const renderFitLogCard = (
    log: any,
    color: string,
    title: string,
    onEdit?: () => void,
  ) => {
    const exercises = log.exercises ?? [];
    const logDate = String(log.date ?? log.logDate ?? log.log_date ?? "").slice(0, 10);

    return (
      <View
        key={`${log.id ?? log.workoutId ?? title}-${logDate}-${log.workoutType ?? ""}`}
        style={{
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 18,
          padding: 16,
          marginBottom: 14,
          backgroundColor: "#fff",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color: Colors.text }}>
              {title}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}>
              {logDate} · {exercises.length}개 운동
            </Text>
          </View>

          {onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={{
                borderWidth: 1,
                borderColor: color + "44",
                backgroundColor: color + "12",
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 7,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "800", color }}>
                수정
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {exercises.map((exercise: any, exIdx: number) => {
          const sets = exercise.sets ?? [];

          return (
            <View
              key={`${exercise.name}-${exIdx}`}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 16,
                padding: 13,
                marginBottom: exIdx === exercises.length - 1 ? 0 : 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.text }}>
                  {exercise.name}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: "900", color }}>
                  {sets.length}세트
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 7,
                }}
              >
                {sets.map((set: any, setIdx: number) => (
                  <View
                    key={`${setIdx}-${set.weight}-${set.reps}`}
                    style={{
                      width: "30.7%",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#fff",
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 999,
                      paddingHorizontal: 7,
                      paddingVertical: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "900",
                        color,
                        marginRight: 5,
                      }}
                    >
                      {setIdx + 1}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 12, fontWeight: "800", color: Colors.text }}
                    >
                      {set.weight ? `${set.weight}kg × ` : ""}
                      {set.reps}회
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 40,
        }}
      >
        {/* 헤더 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 22, color: Colors.textMuted }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.text }}>
            {member.user.name}
          </Text>
          {member.goal && (
            <View
              style={{
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                {member.goal}
              </Text>
            </View>
          )}
        </View>

        {/* PT 잔여 카드 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: member.ptTotal > 0 ? 10 : 0,
            }}
          >
            <View
              style={{ flexDirection: "row", gap: 16, alignItems: "flex-end" }}
            >
              <View>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  PT 잔여
                </Text>
                <Text
                  style={{ fontSize: 28, fontWeight: "900", color: "#4A90FF" }}
                >
                  {member.ptRemaining ?? 0}회
                </Text>
              </View>
              {member.ptTotal > 0 && (
                <View>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    총
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: Colors.textSub,
                    }}
                  >
                    {member.ptTotal}회
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => setShowPTEdit(true)}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}
                >
                  + 추가
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {member.ptTotal > 0 && (
            <>
              <View
                style={{
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                  height: 6,
                }}
              >
                <View
                  style={{
                    width: `${Math.min(ptPct, 100)}%` as any,
                    height: 6,
                    backgroundColor: "#4A90FF",
                    borderRadius: 99,
                  }}
                />
              </View>
              {member.ptStartDate && (
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginTop: 6,
                  }}
                >
                  {member.ptStartDate} 시작
                  {member.ptExpDate ? ` · ${member.ptExpDate} 만료` : ""}
                </Text>
              )}
            </>
          )}
        </View>

        {/* 목표 칼로리/탄단지 카드 */}
        {goalKcal > 0 && (
          <View
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 8, fontWeight: "600" }}>
              목표 영양소 (유지)
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {[
                { label: "칼로리", value: `${Math.round(goalKcal)}`, unit: "kcal" },
                { label: "탄수화물", value: `${Math.round(goalCarbs)}`, unit: "g" },
                { label: "단백질", value: `${Math.round(goalProtein)}`, unit: "g" },
                { label: "지방", value: `${Math.round(goalFat)}`, unit: "g" },
              ].map(({ label, value, unit }) => (
                <View key={label} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>{label}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>
                    {value}
                    <Text style={{ fontSize: 10, fontWeight: "400", color: Colors.textMuted }}>{unit}</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 탭 */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
          {["식단로그", "운동로그", "바디로그"].map((t, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setTab(i)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: tab === i ? Colors.green : Colors.bgSub,
                borderWidth: 1,
                borderColor: tab === i ? Colors.green : Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: tab === i ? "#fff" : Colors.textMuted,
                }}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── 식단 탭 ── */}
        {tab === 0 && (
          <View>
            {/* 주간 캘린더 */}
            <WeekCalendar />

            {/* 칼로리 요약 */}
            <View
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 5,
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textMuted,
                      marginBottom: 2,
                    }}
                  >
                    {member.user.name}님 칼로리
                  </Text>
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "900",
                      color:
                        totalCalories > goalKcal ? Colors.red : Colors.green,
                    }}
                  >
                    {Math.round(totalCalories).toLocaleString()}
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                      {" "}
                      kcal
                    </Text>
                  </Text>
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textMuted,
                      marginBottom: 4,
                    }}
                  >
                    목표
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color:
                        totalCalories > goalKcal ? Colors.red : Colors.green,
                      fontWeight: "700",
                    }}
                  >
                    {totalCalories > goalKcal
                      ? `${Math.round(totalCalories - goalKcal)} 초과`
                      : `${Math.round(goalKcal - totalCalories)} 남음`}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                  height: 8,
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    width: `${Math.min(dietPct, 100)}%` as any,
                    height: 8,
                    borderRadius: 99,
                    backgroundColor: dietPct > 100 ? Colors.red : Colors.green,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>0</Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.green,
                    fontWeight: "700",
                  }}
                >
                  목표 {goalKcal.toLocaleString()}kcal
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-around",
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: Colors.border,
                }}
              >
                {[
                  {
                    label: "탄수화물",
                    val: dietData?.totalCarbs ?? 0,
                    goal: goalCarbs,
                  },
                  {
                    label: "단백질",
                    val: dietData?.totalProtein ?? 0,
                    goal: goalProtein,
                  },
                  {
                    label: "지방",
                    val: dietData?.totalFat ?? 0,
                    goal: goalFat,
                  },
                ].map(({ label, val, goal }) => {
                  const isOverGoal = goal > 0 && val > goal;
                  const valueColor = isOverGoal ? Colors.red : Colors.text;

                  return (
                    <View key={label} style={{ alignItems: "center" }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "800",
                          color: valueColor,
                        }}
                      >
                        {Math.round(val)}
                        <Text style={{ fontSize: 11, color: valueColor }}>
                          g
                        </Text>
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.textMuted,
                          marginTop: 2,
                        }}
                      >
                        {label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: isOverGoal
                            ? Colors.red
                            : Colors.textPlaceholder,
                        }}
                      >
                        / {goal}g
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* 식사별 */}
            {MEAL_TYPES.map(({ key, label }) => {
              const mealGroup = dietData?.meals?.find(
                (m) => m.mealType === key,
              );
              const foods = mealGroup?.foods ?? [];
              return (
                <View key={key} style={{ marginBottom: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "700",
                        color: Colors.text,
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                  {foods.length === 0 ? (
                    <View
                      style={{
                        backgroundColor: Colors.bgSub,
                        borderRadius: 10,
                        padding: 12,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      <Text
                        style={{ fontSize: 12, color: Colors.textPlaceholder }}
                      >
                        기록 없음
                      </Text>
                    </View>
                  ) : (
                    foods.map((f, i) => (
                      <View
                        key={i}
                        style={{
                          backgroundColor: Colors.bgSub,
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 4,
                          borderLeftWidth: 3,
                          borderLeftColor: Colors.green,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: Colors.text,
                            }}
                          >
                            {f.foodName}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.text,
                              marginTop: 2,
                            }}
                          >
                            탄 {f.carbs}g · 단 {f.protein}g · 지 {f.fat}g
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: Colors.green,
                          }}
                        >
                          {f.calories}kcal
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })}

            {/* 이전 피드백 - 간식 바로 아래 */}
            {selectedDateFeedbacks.length > 0 && (
              <View style={{ marginTop: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>
                  이전 피드백
                </Text>
                {selectedDateFeedbacks.map((fb) => (
                  <View
                    key={fb.id}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 8,
                      borderLeftWidth: 3,
                      borderLeftColor: Colors.green,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 4 }}>{fb.targetDate}</Text>
                    <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>{fb.comment}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 피드백 입력 */}
            <View
              style={{
                backgroundColor: Colors.greenLight,
                borderWidth: 1,
                borderColor: Colors.green + "44",
                borderRadius: 14,
                padding: 14,
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.green, marginBottom: 10 }}>
                💬 {member.user.name}님께 피드백
              </Text>
              <TextInput
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="식단에 대한 피드백을 입력하세요..."
                placeholderTextColor={Colors.textPlaceholder}
                multiline
                numberOfLines={3}
                style={{
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 13,
                  color: Colors.text,
                  textAlignVertical: "top",
                  marginBottom: 10,
                  minHeight: 70,
                }}
              />
              <TouchableOpacity
                onPress={sendFeedback}
                disabled={sendingFeedback || !feedbackText.trim()}
                style={{
                  backgroundColor: feedbackText.trim() ? Colors.green : Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: feedbackText.trim() ? "#fff" : Colors.textMuted }}>
                  {sendingFeedback ? "전송 중..." : "📤 전송 + 알림"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── 운동 탭 ── */}
        {tab === 1 && (
          <View>
            <WeekCalendar />

            {/* 선택 날짜 + PT 수업 등록 버튼 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: Colors.textSub,
                }}
              >
                {selectedDateKey} 기록
              </Text>
              {isToday && dayPtLogs.length === 0 && (
                <TouchableOpacity
                  onPress={() => {
                    if (showFitLogForm) {
                      setShowFitLogForm(false);
                    } else {
                      setShowFitLogForm(true);
                      fetchFitLogHistory();
                    }
                  }}
                  style={{
                    backgroundColor: showFitLogForm ? Colors.border : Colors.green,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: showFitLogForm ? Colors.textSub : "#fff",
                    }}
                  >
                    {showFitLogForm ? "접기" : "+ PT 등록"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 오늘만 PT 입력폼 표시 */}
            {isToday &&
              showFitLogForm &&
              (editingFitLogId !== null || dayPtLogs.length === 0) && (
                <View
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 14,
                    padding: 12,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  {/* 헤더 */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ width: 4, height: 18, backgroundColor: Colors.green, borderRadius: 2 }} />
                      <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.text }}>
                        {editingFitLogId ? "PT 수업 수정" : "PT 수업 등록"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>{toDateKey(selectedDate)}</Text>
                  </View>
                  {exercises.map((ex, ei) => (
                    <View
                      key={ei}
                      style={{
                        backgroundColor: "#fff",
                        borderRadius: 10,
                        padding: 8,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      {/* 운동명 */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <TextInput
                            value={ex.name}
                            onChangeText={(v) => {
                              const u = [...exercises];
                              u[ei].name = v;
                              setExercises(u);
                              const suggestions = getExerciseNameSuggestions(v);
                              setExerciseSuggest(
                                suggestions.length > 0 ? { ei, names: suggestions } : null,
                              );
                            }}
                            onBlur={() => setTimeout(() => setExerciseSuggest(null), 150)}
                            placeholder="운동명"
                            placeholderTextColor={Colors.textPlaceholder}
                            style={{
                              backgroundColor: Colors.bgSub,
                              borderWidth: 1,
                              borderColor: Colors.border,
                              borderRadius: 9,
                              paddingHorizontal: 9,
                              paddingVertical: 0,
                              height: 32,
                              fontSize: 13,
                              fontWeight: "800",
                              color: Colors.text,
                            }}
                          />
                        </View>

                        {exercises.length > 1 && (
                          <TouchableOpacity
                            onPress={() =>
                              setExercises(exercises.filter((_, i) => i !== ei))
                            }
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 9,
                              backgroundColor: Colors.bgSub,
                              justifyContent: "center",
                              alignItems: "center",
                              borderWidth: 1,
                              borderColor: Colors.border,
                            }}
                          >
                            <Text style={{ fontSize: 16, color: Colors.textMuted }}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* 운동명 자동완성 */}
                      {exerciseSuggest?.ei === ei &&
                        exerciseSuggest.names.length > 0 && (
                          <View
                            style={{
                              backgroundColor: "#fff",
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: Colors.border,
                              marginBottom: 10,
                              overflow: "hidden",
                            }}
                          >
                            {exerciseSuggest.names.map((name, ni) => (
                              <TouchableOpacity
                                key={ni}
                                onPress={() => {
                                  const u = [...exercises];
                                  u[ei].name = name;
                                  setExercises(u);
                                  setExerciseSuggest(null);
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 8,
                                  borderBottomWidth:
                                    ni < exerciseSuggest.names.length - 1 ? 1 : 0,
                                  borderBottomColor: Colors.border,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    color: Colors.text,
                                    fontWeight: "600",
                                  }}
                                >
                                  {name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}

                      {/* 세트 입력 - 촘촘한 한 줄 구성 */}
                      <View style={{ gap: 4 }}>
                        {ex.sets.map((s, si) => (
                          <View
                            key={si}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 28,
                                borderRadius: 7,
                                backgroundColor: Colors.green,
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "900", color: "#fff" }}>
                                {si + 1}
                              </Text>
                            </View>

                            <View
                              style={{
                                flex: 1,
                                height: 30,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: Colors.bgSub,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: Colors.border,
                                paddingHorizontal: 8,
                              }}
                            >
                              <TextInput
                                value={s.weight}
                                onChangeText={(v) => {
                                  const u = [...exercises];
                                  u[ei].sets[si].weight = v;
                                  setExercises(u);
                                }}
                                placeholder="0"
                                placeholderTextColor={Colors.textPlaceholder}
                                keyboardType="decimal-pad"
                                style={{ flex: 1, height: 30, fontSize: 12, color: Colors.text, paddingVertical: 0 }}
                              />
                              <Text style={{ fontSize: 10, color: Colors.textMuted }}>kg</Text>
                            </View>

                            <View
                              style={{
                                flex: 1,
                                height: 30,
                                flexDirection: "row",
                                alignItems: "center",
                                backgroundColor: Colors.bgSub,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: Colors.border,
                                paddingHorizontal: 8,
                              }}
                            >
                              <TextInput
                                value={s.reps}
                                onChangeText={(v) => {
                                  const u = [...exercises];
                                  u[ei].sets[si].reps = v;
                                  setExercises(u);
                                }}
                                placeholder="0"
                                placeholderTextColor={Colors.textPlaceholder}
                                keyboardType="number-pad"
                                style={{ flex: 1, height: 30, fontSize: 12, color: Colors.text, paddingVertical: 0 }}
                              />
                              <Text style={{ fontSize: 10, color: Colors.textMuted }}>회</Text>
                            </View>

                            {ex.sets.length > 1 ? (
                              <TouchableOpacity
                                onPress={() => {
                                  const u = [...exercises];
                                  u[ei].sets = u[ei].sets.filter((_, i) => i !== si);
                                  setExercises(u);
                                }}
                                style={{
                                  width: 24,
                                  height: 28,
                                  borderRadius: 8,
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <Text style={{ fontSize: 14, color: Colors.textMuted }}>✕</Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={{ width: 24 }} />
                            )}

                            {si === ex.sets.length - 1 ? (
                              <TouchableOpacity
                                onPress={() => {
                                  const u = [...exercises];
                                  u[ei].sets.push({ weight: "", reps: "" });
                                  setExercises(u);
                                }}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  backgroundColor: Colors.green,
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                <Text style={{ fontSize: 16, color: "#fff", fontWeight: "900", marginTop: -1 }}>
                                  +
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={{ width: 28 }} />
                            )}
                          </View>
                        ))}
                      </View>

                      {(() => {
                        const latest = getLatestSameExercise(ex.name);
                        if (!latest) return null;

                        return (
                          <View
                            style={{
                              marginTop: 6,
                              backgroundColor: Colors.greenLight,
                              borderRadius: 8,
                              padding: 6,
                              borderWidth: 1,
                              borderColor: Colors.green + "33",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                color: Colors.green,
                                fontWeight: "800",
                                marginBottom: 5,
                              }}
                            >
                              이전 기록 {latest.date} · 누르면 입력
                            </Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                              {latest.exercise.sets?.map(
                                (prevSet: any, prevIdx: number) => (
                                  <TouchableOpacity
                                    key={prevIdx}
                                    onPress={() => {
                                      const u = [...exercises];
                                      while (u[ei].sets.length <= prevIdx) {
                                        u[ei].sets.push({ weight: "", reps: "" });
                                      }
                                      u[ei].sets[prevIdx].weight = prevSet.weight
                                        ? String(prevSet.weight)
                                        : "";
                                      u[ei].sets[prevIdx].reps = prevSet.reps
                                        ? String(prevSet.reps)
                                        : "";
                                      setExercises(u);
                                    }}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      backgroundColor: "#fff",
                                      borderRadius: 999,
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                      borderWidth: 1,
                                      borderColor: Colors.green + "33",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        color: Colors.green,
                                        fontWeight: "900",
                                      }}
                                    >
                                      {prevIdx + 1}
                                    </Text>
                                    <Text
                                      style={{
                                        fontSize: 11,
                                        color: Colors.text,
                                        fontWeight: "700",
                                      }}
                                    >
                                      {"  "}
                                      {prevSet.weight ? `${prevSet.weight}kg × ` : ""}
                                      {prevSet.reps}회
                                    </Text>
                                  </TouchableOpacity>
                                ),
                              )}
                            </View>
                          </View>
                        );
                      })()}
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={() =>
                      setExercises([
                        ...exercises,
                        { name: "", sets: [{ weight: "", reps: "" }] },
                      ])
                    }
                    style={{
                      backgroundColor: Colors.greenLight,
                      borderWidth: 1,
                      borderColor: Colors.green + "44",
                      borderRadius: 10,
                      padding: 8,
                      alignItems: "center",
                      marginTop: 2,
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.green,
                        fontWeight: "700",
                      }}
                    >
                      + 운동 추가
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveFitLog}
                    disabled={savingFitLog}
                    style={{
                      backgroundColor: Colors.green,
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}
                    >
                      {savingFitLog
                        ? "저장 중..."
                        : editingFitLogId
                          ? "PT 수정 완료"
                          : "PT 수업 등록 + 회원 알림"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            {/* 이날 운동 기록 */}
            {fitLogsLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <ActivityIndicator color={Colors.green} />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginTop: 8,
                  }}
                >
                  운동 기록 불러오는 중...
                </Text>
              </View>
            ) : dayFitLogs.length > 0 ? (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 10,
                  }}
                >
                  이날 운동 기록
                </Text>

                {/* PT 수업 */}
                {dayPtLogs.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: Colors.green,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: Colors.text,
                        }}
                      >
                        PT 수업
                      </Text>
                    </View>

                    {dayPtLogs.map((log: any) =>
                      renderFitLogCard(
                        log,
                        Colors.green,
                        "PT 수업 완료",
                        () => startEditFitLog(log),
                      )
                    )}
                  </View>
                )}

                {/* 개인 운동 */}
                {dayPersonalLogs.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#4A90FF",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: Colors.text,
                        }}
                      >
                        개인 운동
                      </Text>
                    </View>

                    {dayPersonalLogs.map((log: any) =>
                      renderFitLogCard(
                        log,
                        "#4A90FF",
                        "개인 운동 완료",
                        undefined,
                      )
                    )}
                  </View>
                )}
              </View>
            ) : (
              !isToday && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                    이날 운동 기록이 없어요
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {/* ── 바디로그 탭 ── */}
        {tab === 2 && (
          <View>
            {bodyLogs.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📊</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                  등록된 바디로그가 없어요
                </Text>
              </View>
            ) : (
              <View>
                {/* 그래프 2개: 체중 + 체지방량 - 데이터 2개 이상일 때만 */}
                {bodyLogs.length > 0 && (
                  <View
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 14,
                      padding: 12,
                      paddingBottom: 4,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      alignItems: "flex-start",
                      overflow: "hidden",
                    }}
                  >
                    <BodyGraph
                      logs={bodyLogs}
                      metric="weight"
                      color={Colors.green}
                      label="체중 변화"
                      unit="kg"
                    />
                    <BodyGraph
                      logs={bodyLogs}
                      metric="bodyFat"
                      color={Colors.green}
                      label="체지방률 변화"
                      unit="%"
                      isLast
                    />
                  </View>
                )}

                {/* 기록 목록: 몸무게 / 체지방량 / 체지방률 / 근육량 */}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 10,
                  }}
                >
                  기록 목록
                </Text>
                {bodyLogs
                  .slice()
                  .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                  .map((log, i) => (
                    <View
                      key={i}
                      style={{
                        backgroundColor: Colors.bgSub,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.textMuted,
                          marginBottom: 8,
                        }}
                      >
                        {formatDateTime(log.date)}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        {[
                          {
                            label: "몸무게",
                            key: "weight",
                            val: log.weight,
                            unit: "kg",
                            color: Colors.text,
                          },
                          {
                            label: "체지방량",
                            key: "bodyFatMass",
                            val: log.bodyFatMass,
                            unit: "kg",
                            color: Colors.text,
                          },
                          {
                            label: "체지방률",
                            key: "bodyFat",
                            val: log.bodyFat,
                            unit: "%",
                            color: Colors.text,
                          },
                          {
                            label: "근육량",
                            key: "muscleMass",
                            val: log.muscleMass,
                            unit: "kg",
                            color: Colors.text,
                          },
                        ].map(({ label, key, val, unit, color }) => {
                          const prev = bodyLogs
                            .slice()
                            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                            [i + 1];

                          const prevVal = prev?.[key as keyof BodyLog];
                          const diff =
                            typeof val === "number" && typeof prevVal === "number"
                              ? Number((val - prevVal).toFixed(1))
                              : null;

                          const isUp = diff !== null && diff > 0;
                          const isDown = diff !== null && diff < 0;

                          return (
                            <View key={label} style={{ alignItems: "center" }}>
                              <View
                                style={{
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: "800",
                                    color,
                                  }}
                                >
                                  {val ?? "-"}
                                  {val ? unit : ""}
                                </Text>

                                {diff !== null && diff !== 0 && (
                                  <View
                                    style={{
                                      alignItems: "center",
                                      marginTop: 2,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        fontWeight: "700",
                                        color: isUp
                                          ? Colors.green
                                          : Colors.textMuted,
                                      }}
                                    >
                                      {isUp ? "↑" : "↓"}
                                      {Math.abs(diff)}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              <Text
                                style={{
                                  fontSize: 10,
                                  color: Colors.textMuted,
                                  marginTop: 2,
                                }}
                              >
                                {label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* PT 수정 모달 */}
      <Modal
        visible={showPTEdit}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPtForm({ sessions: "0", startDate: todayStr, endDate: "", memo: "" });
          setShowPTEdit(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => {
              setPtForm({ sessions: "0", startDate: todayStr, endDate: "", memo: "" });
              setShowPTEdit(false);
            }}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: Platform.OS === "ios" ? 40 : 24,
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
                fontSize: 18,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 4,
              }}
            >
              PT 추가 등록
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 8 }}
            >
              현재 잔여: {member?.ptRemaining ?? 0}회 · 총:{" "}
              {member?.ptTotal ?? 0}회
            </Text>

            {/* 첫 등록일 표시 */}
            {member?.ptStartDate ? (
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  📅 첫 PT 등록일:
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.text,
                  }}
                >
                  {member.ptStartDate}
                </Text>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: "#FFF9E6",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "#FFE58F",
                }}
              >
                <Text style={{ fontSize: 12, color: "#B8860B" }}>
                  🌟 첫 PT 등록이에요! 시작일을 확인해주세요.
                </Text>
              </View>
            )}

            {/* 추가 횟수 */}
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}
            >
              추가할 횟수
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  setPtForm((f) => ({
                    ...f,
                    sessions: String(Math.max(0, Number(f.sessions) - 1)),
                  }))
                }
                style={{
                  padding: 12,
                  borderRightWidth: 1,
                  borderRightColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 18, color: Colors.textMuted }}>−</Text>
              </TouchableOpacity>
              <TextInput
                value={ptForm.sessions}
                onChangeText={(v) =>
                  setPtForm((f) => ({
                    ...f,
                    sessions: v.replace(/[^0-9]/g, ""),
                  }))
                }
                keyboardType="number-pad"
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontSize: 24,
                  fontWeight: "800",
                  color: Colors.green,
                  paddingVertical: 10,
                }}
              />
              <TouchableOpacity
                onPress={() =>
                  setPtForm((f) => ({
                    ...f,
                    sessions: String(Number(f.sessions) + 1),
                  }))
                }
                style={{
                  padding: 12,
                  borderLeftWidth: 1,
                  borderLeftColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 18, color: Colors.green }}>+</Text>
              </TouchableOpacity>
            </View>

            {/* 추가 후 잔여 미리보기 */}
            <View
              style={{
                backgroundColor: Colors.greenLight,
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 2,
                }}
              >
                추가 후 잔여
              </Text>
              <Text
                style={{ fontSize: 22, fontWeight: "900", color: Colors.green }}
              >
                {(member?.ptRemaining ?? 0) + Number(ptForm.sessions || 0)}회
              </Text>
            </View>

            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}
            >
              계약 시작일
            </Text>
            <TextInput
              value={ptForm.startDate}
              onChangeText={(v) => {
                const n = v.replace(/[^0-9]/g, "").slice(0, 8);
                const fmt =
                  n.length > 6
                    ? `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6)}`
                    : n.length > 4
                      ? `${n.slice(0, 4)}-${n.slice(4)}`
                      : n;
                setPtForm((f) => ({ ...f, startDate: fmt }));
                if (n.length === 8) Keyboard.dismiss();
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={10}
              style={{
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: Colors.text,
                marginBottom: 10,
              }}
            />
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}
            >
              만료일 (선택)
            </Text>
            <TextInput
              value={ptForm.endDate}
              onChangeText={(v) => {
                const n = v.replace(/[^0-9]/g, "").slice(0, 8);
                const fmt =
                  n.length > 6
                    ? `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6)}`
                    : n.length > 4
                      ? `${n.slice(0, 4)}-${n.slice(4)}`
                      : n;
                setPtForm((f) => ({ ...f, endDate: fmt }));
                if (n.length === 8) Keyboard.dismiss();
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textPlaceholder}
              keyboardType="number-pad"
              maxLength={10}
              style={{
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: Colors.text,
                marginBottom: 10,
              }}
            />
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}
            >
              메모
            </Text>
            <TextInput
              value={ptForm.memo}
              onChangeText={(v) => setPtForm((f) => ({ ...f, memo: v }))}
              placeholder="예: 추가 결제 10회"
              placeholderTextColor={Colors.textPlaceholder}
              style={{
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: Colors.text,
                marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setPtForm({ sessions: "0", startDate: todayStr, endDate: "", memo: "" });
                  setShowPTEdit(false);
                }}
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
                onPress={savePT}
                style={{
                  flex: 2,
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                >
                  추가 등록
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}