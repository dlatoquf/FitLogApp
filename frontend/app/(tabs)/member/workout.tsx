import AsyncStorage from "@react-native-async-storage/async-storage";
import CommentSection from "../../../components/CommentSection";
import OuwanCard from "../../../components/OuwanCard";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Colors } from "../../../constants/Colors";
import { ANALYTICS_URL, API_URL } from "../../../constants/api";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

function getWeekDates(offset = 0): Date[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface MediaItem {
  id: number;
  url: string;
  publicId: string;
  mediaType: "IMAGE" | "VIDEO";
}

interface WorkoutLog {
  workoutId?: number;
  date: string;
  workoutType: string;
  conditionScore?: number;
  memo?: string;
  painPoints?: string;
  feedback?: string;
  exercises: {
    name: string;
    memo?: string;
    sets: { setId?: number; weight: any; reps: any; rpe?: any }[];
  }[];
  mediaList?: MediaItem[];
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { date: dateParam, from: fromParam } = useLocalSearchParams<{ date?: string; from?: string }>();
  const fromNotifications = fromParam === "notifications";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam);
      const getMonday = (date: Date) => {
        const m = new Date(date);
        m.setHours(0, 0, 0, 0);
        m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
        return m;
      };
      const d = new Date(dateParam);
      const offset = Math.round(
        (getMonday(d).getTime() - getMonday(new Date()).getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      setWeekOffset(offset);
    }
  }, [dateParam]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ouwanVisible, setOuwanVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [exercises, setExercises] = useState<
    {
      name: string;
      sets: { weight: string; reps: string }[];
      memo: string;
    }[]
  >([{ name: "", sets: [{ weight: "", reps: "" }], memo: "" }]);
  const [personalBodyParts, setPersonalBodyParts] = useState<string[]>([]);
  const [personalCondition, setPersonalCondition] = useState<number | null>(
    null,
  );

  const [mediaGallery, setMediaGallery] = useState<MediaItem[]>([]);
  const [mediaGalleryIndex, setMediaGalleryIndex] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [missions, setMissions] = useState<{
    id: number;
    content: string;
    status: string;
    workoutLogId: number | null;
  }[]>([]);
  const [expandedExerciseMediaKeys, setExpandedExerciseMediaKeys] = useState<{
    [key: string]: boolean;
  }>({});

  const getExerciseMediaList = (exercise: any) => {
    const list = exercise?.mediaList ?? exercise?.medias ?? [];
    const items = list.length > 0 ? list : (exercise?.media ? [exercise.media] : []);
    return items
      .filter(Boolean)
      .map((m: any) => ({
        id: m.id,
        url: m.url ?? m.mediaUrl ?? m.secureUrl,
        publicId: m.publicId,
        mediaType: m.mediaType ?? m.type ?? "IMAGE",
      }))
      .filter((m: any) => !!m.url);
  };

  const getExerciseMediaKey = (log: any, exercise: any, exIdx: number) =>
    `${log.workoutId ?? log.id ?? "log"}-${exercise.name ?? "exercise"}-${exIdx}`;

  const getExerciseMediaToggleLabel = (mediaList: any[], isOpen: boolean) => {
    const hasImage = mediaList.some((m) => String(m.mediaType).toUpperCase() !== "VIDEO");
    const hasVideo = mediaList.some((m) => String(m.mediaType).toUpperCase() === "VIDEO");
    const label = hasImage && hasVideo ? "사진/영상" : hasVideo ? "영상" : "사진";
    return `${label} ${isOpen ? "접기" : "보기"}`;
  };
  const [mediaSaving, setMediaSaving] = useState(false);

  // ── 전체보기 모달 ──
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // "date" = 날짜별, "exercise" = 운동별
  const [historyTab, setHistoryTab] = useState<"date" | "exercise">("date");
  const [memberId, setMemberId] = useState<number | null>(null);
  // 날짜별 - 입력한 날짜
  const [historyDateInput, setHistoryDateInput] = useState("");
  // 날짜별 - 해당 날짜 로그 결과
  const [historyDateLogs, setHistoryDateLogs] = useState<WorkoutLog[]>([]);
  const [historyDateLoading, setHistoryDateLoading] = useState(false);
  // 날짜별 - PT/개인 필터 ("ALL" | "PT" | "PERSONAL")
  const [historyDateFilter, setHistoryDateFilter] = useState<
    "ALL" | "PT" | "PERSONAL"
  >("ALL");
  // 운동별 - 전체 운동 이름 목록 (이름 + 기록 횟수)
  const [historyExerciseList, setHistoryExerciseList] = useState<
    { name: string; count: number }[]
  >([]);
  // 운동별 - 검색어
  const [historyExerciseSearch, setHistoryExerciseSearch] = useState("");
  // 운동별 - 드롭다운 열림 여부
  const [historyExDropOpen, setHistoryExDropOpen] = useState(false);
  const [historyExSelectorH, setHistoryExSelectorH] = useState(46);
  // 운동별 - 선택한 운동 이름
  const [historySelectedExercise, setHistorySelectedExercise] = useState<
    string | null
  >(null);
  // 운동별 - 선택 운동의 날짜별 기록
  const [historyExerciseLogs, setHistoryExerciseLogs] = useState<
    {
      date: string;
      sets: { weight: string; reps: string }[];
      workoutType: string;
    }[]
  >([]);
  const [historyAllLogs, setHistoryAllLogs] = useState<any[]>([]);
  // 클로저 문제 방지용 ref
  const historyAllLogsRef = useRef<any[]>([]);
  const mainScrollRef = useRef<any>(null);
  // 최근 운동일 목록 (날짜별 탭 빠른 선택용)
  const [historyRecentDates, setHistoryRecentDates] = useState<string[]>([]);

  const saveMediaToDevice = async (url: string) => {
    setMediaSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("권한 필요", "갤러리 저장 권한이 필요해요.");
        return;
      }
      const filename = url.split("/").pop()?.split("?")[0] ?? "fitlog_media";
      const fileUri = FileSystem.documentDirectory + filename;
      const { uri } = await FileSystem.downloadAsync(url, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("저장 완료", "갤러리에 저장됐어요!");
    } catch (e: any) {
      Alert.alert("저장 실패", e?.message ?? String(e));
    } finally {
      setMediaSaving(false);
    }
  };

  // raw API 응답 → WorkoutLog 형식으로 정규화
  const normalizeLog = (l: any) => ({
    workoutId: l.workoutId ?? l.workout_id ?? l.id,
    date: String(l.date ?? l.logDate ?? l.log_date ?? "").slice(0, 10),
    workoutType: l.workoutType ?? l.workout_type ?? "PERSONAL",
    conditionScore: l.conditionScore ?? l.condition_score ?? null,
    memo: l.memo ?? null,
    painPoints: l.painPoints ?? l.pain_points ?? null,
    feedback: l.feedback ?? null,
    exercises: l.exercises ?? l.sets ?? l.workoutSets ?? [],
    mediaList: l.mediaList ?? [],
  });

  // ── 전체보기 모달 열기: 전체 로그 로드 + 운동 이름 목록 추출 ──
  const openHistoryModal = async () => {
    setShowHistoryModal(true);
    setHistoryTab("date");
    setHistoryDateInput("");
    setHistoryDateLogs([]);
    setHistoryDateFilter("ALL");
    setHistoryExerciseSearch("");
    setHistoryExDropOpen(false);
    setHistorySelectedExercise(null);
    setHistoryExerciseLogs([]);

    try {
      let rawLogs = allLogsCache.current;
      const jwt = await AsyncStorage.getItem("jwt");

      if (rawLogs.length === 0) {
        const res = await fetch(
          `${API_URL}/api/fitlog/me?from=2000-01-01&to=${toDateKey(new Date())}`,
          { headers: { Authorization: `Bearer ${jwt}` } },
        );
        if (res.ok) {
          rawLogs = await res.json();
          allLogsCache.current = rawLogs;
        }
      }

      // raw 데이터 정규화 후 state + ref 모두 업데이트
      const normalized = rawLogs.map(normalizeLog);
      historyAllLogsRef.current = normalized;
      setHistoryAllLogs(normalized);

      // 최근 운동일 최대 10개 (중복 제거, 최신순)
      const allDates = [...normalized, ...workoutLogs]
        .map((l: any) => l.date)
        .filter(Boolean);
      const uniqueDates = Array.from(new Set(allDates))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 10);
      setHistoryRecentDates(uniqueDates);

      // 운동 이름별 기록 횟수 집계 (날짜 중복 제거)
      const allSources = [...normalized, ...workoutLogs];
      // 이름 → 날짜 Set 맵
      const nameCountMap = new Map<string, Set<string>>();
      allSources.forEach((log: any) => {
        (log.exercises ?? []).forEach((ex: any) => {
          const n = String(ex.name ?? "").trim();
          if (!n) return;
          if (!nameCountMap.has(n)) nameCountMap.set(n, new Set());
          nameCountMap.get(n)!.add(log.date);
        });
      });
      // 횟수 많은 순으로 정렬
      const exerciseList = Array.from(nameCountMap.entries())
        .map(([name, dates]) => ({ name, count: dates.size }))
        .sort((a, b) => b.count - a.count);
      setHistoryExerciseList(exerciseList);
    } catch (e) {
      console.log("전체보기 로드 오류:", e);
    }
  };

  const [trainerPlan, setTrainerPlan] = useState<string | null>(null);

  // ── member 정보(id, trainerPlan) 캐시 fetch ──
  const fetchMemberInfo = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/home`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.member?.id) setMemberId(d.member.id);
        if (d?.member?.trainerPlan) setTrainerPlan(d.member.trainerPlan);
      }
    } catch {}
  };


  // ── 날짜별 검색 (ref 사용 → 클로저 문제 없음) ──
  const searchByDate = (dateStr: string) => {
    if (!dateStr || dateStr.length < 10) return;
    setHistoryDateLoading(true);
    // ref의 정규화된 데이터 + 현재 주간 데이터 합치기
    const allSources = [...historyAllLogsRef.current, ...workoutLogs];
    const result = allSources.filter((l: any) => l.date === dateStr);
    // workoutId 기준 중복 제거
    const seen = new Set<any>();
    const unique = result.filter((l: any) => {
      const key = l.workoutId ?? l.date + l.workoutType;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setHistoryDateLogs(unique as WorkoutLog[]);
    setHistoryDateLoading(false);
  };

  // ── 운동별 기록 조회 (ref 사용) ──
  const selectExerciseHistory = (name: string) => {
    setHistorySelectedExercise(name);
    const allSources = [...historyAllLogsRef.current, ...workoutLogs];
    const logs: {
      date: string;
      sets: { weight: string; reps: string }[];
      workoutType: string;
    }[] = [];
    allSources.forEach((l: any) => {
      const exercises = l.exercises ?? [];
      const match = exercises.find(
        (ex: any) => String(ex.name ?? "").trim() === name,
      );
      if (match) {
        logs.push({
          date: l.date,
          sets: match.sets ?? [],
          workoutType: l.workoutType ?? "PERSONAL",
        });
      }
    });
    // 날짜 최신순, 중복 제거
    const seen = new Set<string>();
    const unique = logs.filter((l) => {
      if (seen.has(l.date)) return false;
      seen.add(l.date);
      return true;
    });
    unique.sort((a, b) => b.date.localeCompare(a.date));
    setHistoryExerciseLogs(unique);
  };

  const prevWeekOffset = useRef(weekOffset);

  const weekDates = getWeekDates(weekOffset);
  const ptDates = new Set(
    workoutLogs
      .filter((l) => l.workoutType === "PT")
      .map((l) => String(l.date ?? (l as any).logDate).slice(0, 10)),
  );
  const fitDates = new Set(
    workoutLogs
      .filter((l) => l.workoutType === "PERSONAL")
      .map((l) => String(l.date ?? (l as any).logDate).slice(0, 10)),
  );

  const fetchAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const jwt = await AsyncStorage.getItem("jwt");

      // 운동 로그 안에 PT/PERSONAL이 같이 오므로
      // /api/member/schedule/this-week 별도 호출은 제거해서 중복 조회를 줄임
      await fetchLogs(jwt, weekOffset);
      // 챌린지 fetch
      try {
        const mRes = await fetch(`${API_URL}/api/missions/my`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (mRes.ok) setMissions(await mRes.json());
      } catch {}
    } catch (e: any) {
      console.log("운동로그 오류:", e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchLogs = async (jwt: string | null, offset: number) => {
    const dates = getWeekDates(offset);
    const from = toDateKey(dates[0]);
    const to = toDateKey(dates[6]);
    try {
      const j = jwt ?? (await AsyncStorage.getItem("jwt"));
      const res = await fetch(
        `${API_URL}/api/fitlog/me?from=${from}&to=${to}`,
        {
          headers: { Authorization: `Bearer ${j}` },
        },
      );
      if (res.ok) {
        const raw = await res.json();
        console.log("운동로그 응답:", raw);

        const normalized = raw.map((l: any) => ({
          workoutId: l.workoutId ?? l.workout_id ?? l.id,
          date: String(l.date ?? l.logDate ?? l.log_date).slice(0, 10),
          workoutType: l.workoutType ?? l.workout_type,
          conditionScore: l.conditionScore ?? null,
          memo: l.memo ?? null,
          painPoints: l.painPoints ?? null,
          feedback: l.feedback ?? null,
          exercises: l.exercises ?? l.sets ?? l.workoutSets ?? [],
          mediaList: l.mediaList ?? [],
        }));
        setWorkoutLogs(normalized);
      } else {
        setWorkoutLogs([]);
      }
    } catch {
      setWorkoutLogs([]);
    }
  };

  // 이전 기록 상태
  const [suggestions, setSuggestions] = useState<{
    [key: number]: { date: string; sets: any[]; latestMemo?: string } | null;
  }>({});
  const [nameSelected, setNameSelected] = useState<{ [key: number]: boolean }>(
    {},
  );
  const suggestionRequestRef = useRef<{ [key: number]: string }>({});
  const allLogsCache = useRef<any[]>([]);

  const fetchSuggestion = async (exerciseName: string, idx: number) => {
    const normalizedName = exerciseName.trim().toLowerCase();
    suggestionRequestRef.current[idx] = normalizedName;

    if (!normalizedName) {
      setSuggestions((prev) => ({ ...prev, [idx]: null }));
      return;
    }

    const applySuggestion = (value: { date: string; sets: any[]; latestMemo?: string } | null) => {
      if (suggestionRequestRef.current[idx] !== normalizedName) return;
      setSuggestions((prev) => ({ ...prev, [idx]: value }));
    };

    const findLatest = (logs: any[]) => {
      return (
        logs
          .map((l: any) => ({
            ...l,
            date: String(l.date ?? l.logDate ?? l.log_date).slice(0, 10),
            exercises: l.exercises ?? l.sets ?? l.workoutSets ?? [],
          }))
          // 오늘 입력 중인 기록은 이전 기록 후보에서 제외
          .filter((l: any) => l.date < selectedDate)
          .filter((l: any) =>
            l.exercises?.some(
              (ex: any) =>
                String(ex.name ?? "")
                  .trim()
                  .toLowerCase() === normalizedName,
            ),
          )
          .sort((a: any, b: any) => b.date.localeCompare(a.date))
      );
    };

    try {
      // 캐시 + 현재 주간 데이터 합쳐서 먼저 찾기
      const combined = [...workoutLogs, ...allLogsCache.current];
      let found = findLatest(combined);

      // 없으면 전체 이력 API 조회 후 캐시 저장
      if (found.length === 0) {
        const jwt = await AsyncStorage.getItem("jwt");
        const res = await fetch(
          `${API_URL}/api/fitlog/me?from=2000-01-01&to=${toDateKey(new Date())}`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          },
        );

        if (res.ok) {
          const allLogs = await res.json();
          allLogsCache.current = allLogs;
          found = findLatest(allLogs);
        }
      }

      if (found.length > 0) {
        const lastEx = found[0].exercises.find(
          (ex: any) =>
            String(ex.name ?? "")
              .trim()
              .toLowerCase() === normalizedName,
        );
        const latestMemo = lastEx?.memo?.trim() || undefined;
        applySuggestion({ date: found[0].date, sets: lastEx?.sets ?? [], latestMemo });
      } else {
        applySuggestion(null);
      }
    } catch (e) {
      console.log("이전 기록 조회 오류:", e);
      applySuggestion(null);
    }
  };

  const hasUnsavedPersonalData = () =>
    exercises.some(
      (ex) => ex.name.trim() || ex.sets.some((s) => s.weight || s.reps),
    ) || personalBodyParts.length > 0 || personalCondition !== null;

  const resetPersonalForm = (clear = false) => {
    const doClose = () => {
      setShowAddModal(false);
      setEditingWorkoutId(null);
      if (clear) {
        setExercises([{ name: "", sets: [{ weight: "", reps: "" }], memo: "" }]);
        setSuggestions({});
        setPersonalBodyParts([]);
        setPersonalCondition(null);
      }
    };

    if (!clear && hasUnsavedPersonalData()) {
      Alert.alert(
        "운동 기록이 저장되지 않았어요",
        "저장 버튼을 눌러 저장하거나, 그냥 나가면 입력한 내용이 사라져요.",
        [
          { text: "계속 입력", style: "cancel" },
          {
            text: "나가기",
            style: "destructive",
            onPress: () => {
              setExercises([{ name: "", sets: [{ weight: "", reps: "" }], memo: "" }]);
              setSuggestions({});
              setPersonalBodyParts([]);
              setPersonalCondition(null);
              doClose();
            },
          },
        ],
      );
      return;
    }
    doClose();
  };

  const openPersonalForm = async () => {
    if (showAddModal) {
      resetPersonalForm();
      return;
    }
    Keyboard.dismiss();
    const draftKey = `personal_draft_${selectedDate}`;
    const draft = await AsyncStorage.getItem(draftKey);
    if (draft && !editingWorkoutId) {
      Alert.alert("임시저장된 내용이 있어요", "이어서 작성할까요?", [
        {
          text: "새로 작성",
          style: "destructive",
          onPress: () => {
            AsyncStorage.removeItem(draftKey);
            setShowAddModal(true);
          },
        },
        {
          text: "불러오기",
          onPress: () => {
            try {
              const parsed = JSON.parse(draft);
              if (parsed.exercises) setExercises(parsed.exercises);
              if (parsed.personalBodyParts) setPersonalBodyParts(parsed.personalBodyParts);
              if (parsed.personalCondition !== undefined) setPersonalCondition(parsed.personalCondition);
            } catch {}
            setShowAddModal(true);
          },
        },
      ]);
    } else {
      setShowAddModal(true);
    }
  };

  const startEditPersonalLog = (log: any) => {
    setEditingWorkoutId(log.workoutId ?? log.workout_id ?? log.id ?? null);
    setExercises(
      (log.exercises ?? []).map((ex: any) => ({
        name: ex.name ?? "",
        memo: ex.memo ?? "",
        sets: (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
        })),
      })),
    );
    setPersonalBodyParts(
      log.painPoints
        ? log.painPoints
            .split(",")
            .map((p: string) => p.trim())
            .filter(Boolean)
        : [],
    );
    setPersonalCondition(log.conditionScore ?? null);
    setShowAddModal(true);
  };

  const savePersonalLog = async () => {
    const valid = exercises.filter((ex) => ex.name.trim());
    if (valid.length === 0) {
      Alert.alert("오류", "운동명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const url = editingWorkoutId
        ? `${API_URL}/api/fitlog/${editingWorkoutId}`
        : `${API_URL}/api/fitlog/personal`;

      const payload = {
        date: selectedDate,
        conditionScore: personalCondition ?? undefined,
        painPoints:
          personalBodyParts.length > 0
            ? personalBodyParts.join(",")
            : undefined,
        exercises: valid.map((ex) => ({
          name: ex.name,
          memo: ex.memo?.trim() || undefined,
          sets: ex.sets
            .filter((s) => s.reps)
            .map((s, i) => ({
              setNumber: i + 1,
              weight: s.weight ? Number(s.weight) : null,
              reps: Number(s.reps),
            })),
        })),
      };

      let res = await fetch(url, {
        method: editingWorkoutId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(
          message ||
            (editingWorkoutId
              ? "수정 실패: 백엔드에 PUT /api/fitlog/{id} API가 있는지 확인해주세요."
              : "저장 실패"),
        );
      }

      resetPersonalForm(true);
      await fetchLogs(null, weekOffset);
      Alert.alert(
        "완료",
        editingWorkoutId
          ? "개인 운동이 수정됐어요!"
          : "개인 운동이 등록됐어요!",
      );
    } catch (e: any) {
      Alert.alert("오류", e?.message);
    } finally {
      setSaving(false);
    }
  };

  // 탭 포커스될 때마다 자동 새로고침 (현재 weekOffset 기준)
  useFocusEffect(
    useCallback(() => {
      setSelectedDate(toDateKey(new Date()));
      setWeekOffset(0);
      fetchAll();
      if (!memberId) fetchMemberInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // weekOffset 변경 시 날짜 리셋 + 재조회
  useEffect(() => {
    if (prevWeekOffset.current === weekOffset) return;
    prevWeekOffset.current = weekOffset;
    const dates = getWeekDates(weekOffset);
    const weekKeys = dates.map((d) => toDateKey(d));
    // selectedDate가 이미 해당 주 안에 있으면 리셋하지 않음 (알림 날짜 이동 보호)
    if (!weekKeys.includes(selectedDate)) {
      const todayKey = toDateKey(new Date());
      const inThisWeek = weekKeys.includes(todayKey);
      setSelectedDate(inThisWeek ? todayKey : weekKeys[0]);
    }
    fetchLogs(null, weekOffset);
  }, [weekOffset]);

  if (loading) {
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

  const dayPt = workoutLogs.filter(
    (l) =>
      String(l.date ?? (l as any).logDate).slice(0, 10) === selectedDate &&
      l.workoutType === "PT",
  );

  const dayFitLogs = workoutLogs.filter(
    (l) =>
      String(l.date ?? (l as any).logDate).slice(0, 10) === selectedDate &&
      l.workoutType === "PERSONAL",
  );
  const isToday = selectedDate === toDateKey(new Date());

  const renderWorkoutCard = (
    log: WorkoutLog,
    color: string,
    title: string,
    onEdit?: () => void,
  ) => {
    const exercises = log.exercises ?? [];
    const mediaList = log.mediaList ?? [];
    const anyLog = log as any;
    // 컨디션 스코어 기준
    // 4 = 최상 (최고의 컨디션, 모든 세트 완벽 소화)
    // 3 = 좋음  (컨디션 좋고 운동이 잘 됨)
    // 2 = 보통  (평범한 훈련, 큰 무리 없음)
    // 1 = 나쁨  (몸이 무겁거나 컨디션이 좋지 않음)
    const conditionLabel =
      anyLog.conditionScore === 4
        ? "최상"
        : anyLog.conditionScore === 3
          ? "좋음"
          : anyLog.conditionScore === 2
            ? "보통"
            : anyLog.conditionScore === 1
              ? "나쁨"
              : null;

    return (
      <View
        key={`${log.workoutId ?? title}-${log.date}-${log.workoutType}`}
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
            marginBottom: anyLog.painPoints || conditionLabel ? 8 : 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 17, fontWeight: "900", color: Colors.text }}
            >
              {title}
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}
            >
              {log.date} · {exercises.length}개 운동
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

        {/* 부위 + 컨디션 */}
        {(anyLog.painPoints || conditionLabel) && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 12,
            }}
          >
            {anyLog.painPoints &&
              anyLog.painPoints
                .split(",")
                .map((p: string) => p.trim())
                .filter(Boolean)
                .map((part: string) => (
                  <View
                    key={part}
                    style={{
                      backgroundColor: color + "18",
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: color + "44",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color }}>
                      {part}
                    </Text>
                  </View>
                ))}
            {conditionLabel && (
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: Colors.textSub,
                  }}
                >
                  컨디션 {conditionLabel}
                </Text>
              </View>
            )}
          </View>
        )}

        {anyLog.memo ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textSub, marginBottom: 3 }}>특이사항</Text>
            <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>{anyLog.memo}</Text>
          </View>
        ) : null}

        {exercises.map((exercise: any, exIdx: number) => {
          const sets = exercise.sets ?? [];
          const mediaList = getExerciseMediaList(exercise);
          const mediaKey = getExerciseMediaKey(log, exercise, exIdx);
          const isMediaOpen = !!expandedExerciseMediaKeys[mediaKey];

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
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "900",
                    color: Colors.text,
                    flex: 1,
                  }}
                >
                  {exercise.name}
                </Text>
                {mediaList.length > 0 ? (
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedExerciseMediaKeys((prev) => ({
                        ...prev,
                        [mediaKey]: !prev[mediaKey],
                      }))
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color }}>
                      {getExerciseMediaToggleLabel(mediaList, isMediaOpen)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View
                style={{
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 8,
                  overflow: "hidden",
                  marginTop: 4,
                }}
              >
                {/* 헤더 */}
                <View
                  style={{
                    flexDirection: "row",
                    backgroundColor: "#f6f7f6",
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.border,
                  }}
                >
                  {[
                    { label: "SET", flex: 0.7 },
                    { label: "KG", flex: 1 },
                    { label: "REP", flex: 1 },
                  ].map((col, idx) => (
                    <View
                      key={col.label}
                      style={{
                        flex: col.flex,
                        alignItems: "center",
                        paddingVertical: 5,
                        borderRightWidth: idx < 2 ? 1 : 0,
                        borderRightColor: Colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: Colors.textMuted,
                        }}
                      >
                        {col.label}
                      </Text>
                    </View>
                  ))}
                </View>
                {/* 세트 rows */}
                {sets.map((set: any, setIdx: number) => (
                  <View
                    key={`${setIdx}-${set.weight}-${set.reps}`}
                    style={{
                      flexDirection: "row",
                      borderTopWidth: setIdx === 0 ? 0 : 1,
                      borderTopColor: "#edf0ed",
                    }}
                  >
                    <View
                      style={{
                        flex: 0.7,
                        alignItems: "center",
                        paddingVertical: 6,
                        borderRightWidth: 1,
                        borderRightColor: Colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: Colors.textSub,
                        }}
                      >
                        {setIdx + 1}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 6,
                        borderRightWidth: 1,
                        borderRightColor: Colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "900",
                          color,
                        }}
                      >
                        {Number(set.weight) > 0 ? set.weight : "맨몸"}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        alignItems: "center",
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "900",
                          color,
                        }}
                      >
                        {set.reps}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              {exercise.memo ? (
                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: Colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textSub,
                      fontStyle: "italic",
                    }}
                  >
                    메모: {exercise.memo}
                  </Text>
                </View>
              ) : null}

              {isMediaOpen && mediaList.length > 0 ? (
                <View style={{ marginTop: 9, gap: 8 }}>
                  {mediaList.map((media: any, mediaIdx: number) => {
                    const isVideo = String(media.mediaType).toUpperCase() === "VIDEO";
                    return (
                      <TouchableOpacity
                        key={`${media.url}-${mediaIdx}`}
                        activeOpacity={0.9}
                        onPress={() => {
                          setMediaGallery(mediaList);
                          setMediaGalleryIndex(mediaIdx);
                        }}
                        style={{
                          overflow: "hidden",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          backgroundColor: "#fff",
                        }}
                      >
                        {isVideo ? (
                          <Video
                            source={{ uri: media.url }}
                            style={{ width: "100%", height: 220 }}
                            resizeMode={ResizeMode.CONTAIN}
                            useNativeControls
                            shouldPlay={false}
                          />
                        ) : (
                          <Image
                            source={{ uri: media.url }}
                            style={{ width: "100%", height: 220 }}
                            resizeMode="contain"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        {anyLog.feedback ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textSub,
                marginBottom: 4,
              }}
            >
              피드백
            </Text>
            <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>
              {anyLog.feedback}
            </Text>
          </View>
        ) : null}

        {/* 사진/영상 보기 버튼 */}
        {mediaList.length > 0 && (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <TouchableOpacity
              onPress={() => {
                setMediaGallery(mediaList);
                setMediaGalleryIndex(0);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: color + "44",
                backgroundColor: color + "0d",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color }}>
                사진 / 영상 보기
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                ({mediaList.length})
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 챌린지 */}
        {(() => {
          const logMissions = missions.filter(
            (m) => m.workoutLogId != null && Number(m.workoutLogId) === Number(log.workoutId),
          );
          if (logMissions.length === 0) return null;
          const doneCount = logMissions.filter((m) => m.status === "DONE").length;
          return (
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#f97316" }}>
                  챌린지
                </Text>
                <Text style={{ fontSize: 11, color: "#f9731699", marginLeft: "auto" }}>
                  {doneCount}/{logMissions.length} 완료
                </Text>
              </View>
              {logMissions.map((m) => {
                const isDone = m.status === "DONE";
                const isFailed = m.status === "FAILED";
                return (
                  <View
                    key={m.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: "#f97316",
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: isDone ? Colors.textMuted : isFailed ? "#ef444499" : Colors.text,
                        textDecorationLine: isDone ? "line-through" : "none",
                      }}
                    >
                      {m.content}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </View>
    );
  };

  return (
    <>
      <KeyboardAwareScrollView
        ref={mainScrollRef}
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAll(true)}
            tintColor={Colors.green}
          />
        }
      >
        {/* 헤더 */}
        {fromNotifications && (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/member/notifications" as any)}
            style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 4 }}
          >
            <Text style={{ fontSize: 18, color: Colors.green, fontWeight: "700" }}>‹</Text>
            <Text style={{ fontSize: 15, color: Colors.green, fontWeight: "600" }}>알림</Text>
          </TouchableOpacity>
        )}
        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: Colors.text,
            marginBottom: 20,
          }}
        >
          운동 로그
        </Text>

        {/* 주간 캘린더 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 6,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <TouchableOpacity
              onPress={() => setWeekOffset((w) => w - 1)}
              delayPressIn={60}
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
              delayPressIn={60}
              style={{ padding: 6, opacity: weekOffset === 0 ? 0.3 : 1 }}
            >
              <Text style={{ fontSize: 20, color: Colors.green }}>›</Text>
            </TouchableOpacity>
          </View>

          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {weekDates.map((date, i) => {
              const key = toDateKey(date);
              const isSelected = selectedDate === key;
              const isTodayD = toDateKey(new Date()) === key;
              const hasPt = ptDates.has(key);
              const hasFit = fitDates.has(key);
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSelectedDate(key)}
                  delayPressIn={60}
                  style={{ alignItems: "center", gap: 4 }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textMuted,
                      fontWeight: "600",
                    }}
                  >
                    {DAYS[i]}
                  </Text>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: isSelected
                        ? Colors.green
                        : isTodayD
                          ? Colors.greenLight
                          : "transparent",
                      borderWidth: isTodayD && !isSelected ? 1.5 : 0,
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
                          : isTodayD
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
                    {hasPt && (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: Colors.green,
                        }}
                      />
                    )}
                    {hasFit && (
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 3,
                          backgroundColor: Colors.blue,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View
            style={{
              height: 1,
              backgroundColor: Colors.border,
              marginTop: 6,
              marginBottom: 6,
            }}
          />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 0 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.green,
                }}
              />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>PT</Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.blue,
                }}
              />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                개인운동
              </Text>
            </View>
          </View>
        </View>

        {/* 선택 날짜 + 전체보기 + 개인운동 추가 버튼 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{ fontSize: 15, fontWeight: "700", color: Colors.textSub }}
            >
              {selectedDate} 기록
            </Text>
            <TouchableOpacity
              onPress={() => {
                openHistoryModal();
              }}
              style={{
                borderWidth: 1,
                borderColor: Colors.blue + "44",
                borderRadius: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{ fontSize: 11, color: Colors.blue, fontWeight: "700" }}
              >
                전체 운동 기록
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={openPersonalForm}
            style={{
              backgroundColor: showAddModal
                ? Colors.border
                : Colors.blue + "22",
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: showAddModal ? Colors.border : Colors.blue + "55",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: showAddModal ? Colors.textSub : Colors.blue,
              }}
            >
              {showAddModal ? "접기" : "+ 개인운동 등록"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 개인운동 입력폼은 하단 모달에서 표시 */}

        {/* PT 기록 */}
        {dayPt.length > 0 && (
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
                style={{ fontSize: 15, fontWeight: "900", color: Colors.text }}
              >
                PT 수업
              </Text>
            </View>

            {dayPt.map((log) => (
              <View key={`pt-wrap-${log.workoutId}`}>
                {renderWorkoutCard(log, Colors.green, "PT 수업 완료")}
                {trainerPlan && log.workoutId && (
                  <CommentSection targetType="WORKOUT_LOG" targetId={log.workoutId} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* 개인 운동 기록 */}
        {dayFitLogs.length > 0 && (
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
                  backgroundColor: Colors.blue,
                }}
              />
              <Text
                style={{ fontSize: 15, fontWeight: "900", color: Colors.text }}
              >
                개인 운동
              </Text>
            </View>

            {dayFitLogs.map((log) => (
              <View key={`fit-wrap-${log.workoutId}`}>
                {renderWorkoutCard(
                  log,
                  Colors.blue,
                  "개인 운동 완료",
                  () => startEditPersonalLog(log),
                )}
                {trainerPlan && log.workoutId && (
                  <CommentSection targetType="WORKOUT_LOG" targetId={log.workoutId} />
                )}
              </View>
            ))}
          </View>
        )}

        {/* 오운완 인증샷 버튼 — 운동 기록 있을 때만 */}
        {(dayPt.length > 0 || dayFitLogs.length > 0) && (
          <TouchableOpacity
            onPress={() => setOuwanVisible(true)}
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              marginBottom: 4,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: Colors.green + "55",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.green }}>
              오늘 운동 인증하기
            </Text>
          </TouchableOpacity>
        )}

        {dayPt.length === 0 && dayFitLogs.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏋️</Text>
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>
              이날 운동 기록이 없어요
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textMuted,
                marginTop: 4,
              }}
            >
              + 개인운동 버튼으로 기록해보세요!
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* 오운완 인증샷 모달 */}
      <OuwanCard
        visible={ouwanVisible}
        onClose={() => setOuwanVisible(false)}
        date={selectedDate}
        exercises={[
          ...dayPt.flatMap((log: any) =>
            (log.exercises ?? []).map((ex: any) => ex.name ?? ex.exerciseName ?? "")
          ),
          ...dayFitLogs.flatMap((log: any) =>
            (log.exercises ?? []).map((ex: any) => ex.name ?? ex.exerciseName ?? "")
          ),
        ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)}
        sessionType={dayPt.length > 0 ? "PT" : "개인운동"}
      />

      {/* 개인운동 입력폼 모달 (Bottom Sheet) */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => resetPersonalForm()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => resetPersonalForm()}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
          />

          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: SCREEN_H * 0.92,
              overflow: "hidden",
            }}
          >
            <View
              style={{ alignItems: "center", paddingTop: 10, paddingBottom: 2 }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: Colors.border,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 4,
                    height: 18,
                    backgroundColor: Colors.blue,
                    borderRadius: 2,
                  }}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "900",
                    color: Colors.text,
                  }}
                >
                  {editingWorkoutId ? "개인운동 수정" : "개인운동 등록"}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  {selectedDate}
                </Text>
                <TouchableOpacity
                  onPress={() => resetPersonalForm()}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 4 }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      color: Colors.textMuted,
                      lineHeight: 24,
                    }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={{ paddingHorizontal: 20 }}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 부위 선택 */}
              <View style={{ marginBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  부위 (복수 선택)
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {["가슴", "등", "어깨", "팔", "하체", "코어", "전신"].map(
                    (part) => {
                      const selected = personalBodyParts.includes(part);
                      return (
                        <TouchableOpacity
                          key={part}
                          onPress={() =>
                            setPersonalBodyParts(
                              selected
                                ? personalBodyParts.filter((p) => p !== part)
                                : [...personalBodyParts, part],
                            )
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: selected
                              ? Colors.blue
                              : Colors.bgSub,
                            borderWidth: 1,
                            borderColor: selected ? Colors.blue : Colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: selected ? "#fff" : Colors.textSub,
                            }}
                          >
                            {part}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>

              {/* 컨디션 선택 */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  컨디션
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {/* 컨디션 선택 칩
                    4 = 최상: 최고의 컨디션, 모든 세트 완벽 소화
                    3 = 좋음: 컨디션 좋고 운동이 잘 됨
                    2 = 보통: 평범한 훈련, 큰 무리 없음
                    1 = 나쁨: 몸이 무겁거나 컨디션이 좋지 않음 */}
                  {[
                    { label: "최상", value: 4 },
                    { label: "좋음", value: 3 },
                    { label: "보통", value: 2 },
                    { label: "나쁨", value: 1 },
                  ].map(({ label, value }) => {
                    const selected = personalCondition === value;
                    return (
                      <TouchableOpacity
                        key={value}
                        onPress={() =>
                          setPersonalCondition(selected ? null : value)
                        }
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: selected
                            ? Colors.blue
                            : Colors.bgSub,
                          borderWidth: 1,
                          borderColor: selected ? Colors.blue : Colors.border,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: selected ? "#fff" : Colors.textSub,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {exercises.map((ex, ei) => (
                <View
                  key={`exercise-${ei}`}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    padding: 8,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                      position: "relative",
                      zIndex: 100,
                    }}
                  >
                    <TextInput
                      value={ex.name}
                      onChangeText={(v) => {
                        const u = [...exercises];
                        u[ei].name = v;
                        setExercises(u);
                        setNameSelected((prev) => ({
                          ...prev,
                          [ei]: false,
                        }));
                        fetchSuggestion(v, ei);
                      }}
                      onSubmitEditing={() =>
                        setNameSelected((prev) => ({ ...prev, [ei]: true }))
                      }
                      returnKeyType="done"
                      placeholder="운동명"
                      placeholderTextColor={Colors.textPlaceholder}
                      style={{
                        flex: 1,
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

                    {ex.name.trim().length > 0 &&
                      suggestions[ei] === null &&
                      !nameSelected[ei] &&
                      (() => {
                        const allSources = [
                          ...workoutLogs,
                          ...allLogsCache.current,
                        ];
                        const q = ex.name.replaceAll(" ", "").toLowerCase();
                        return allSources.some((log: any) =>
                          (log.exercises ?? []).some((item: any) =>
                            String(item.name ?? "")
                              .replaceAll(" ", "")
                              .toLowerCase()
                              .includes(q),
                          ),
                        );
                      })() && (
                        <View
                          style={{
                            position: "absolute",
                            left: 0,
                            right: exercises.length > 1 ? 46 : 0,
                            top: 42,
                            zIndex: 200,
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: Colors.blue + "33",
                            borderRadius: 10,
                            overflow: "hidden",
                          }}
                        >
                          {Array.from(
                            new Set(
                              [...workoutLogs, ...allLogsCache.current].flatMap(
                                (log: any) =>
                                  (log.exercises ?? [])
                                    .map((item: any) => String(item.name ?? ""))
                                    .filter((name: string) =>
                                      name
                                        .replaceAll(" ", "")
                                        .toLowerCase()
                                        .includes(
                                          ex.name
                                            .replaceAll(" ", "")
                                            .toLowerCase(),
                                        ),
                                    ),
                              ),
                            ),
                          )
                            .slice(0, 4)
                            .map((name: string) => (
                              <TouchableOpacity
                                key={name}
                                onPress={() => {
                                  const u = [...exercises];
                                  u[ei].name = name;
                                  setExercises(u);
                                  setNameSelected((prev) => ({
                                    ...prev,
                                    [ei]: true,
                                  }));
                                  fetchSuggestion(name, ei);
                                }}
                                style={{
                                  paddingHorizontal: 12,
                                  paddingVertical: 9,
                                  borderBottomWidth: 1,
                                  borderBottomColor: Colors.border,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "800",
                                    color: Colors.text,
                                  }}
                                >
                                  {name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </View>
                      )}

                    {exercises.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          setExercises(exercises.filter((_, i) => i !== ei));
                          setSuggestions((prev) => {
                            const n = { ...prev };
                            delete n[ei];
                            return n;
                          });
                        }}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: Colors.bgSub,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: Colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 16, color: Colors.textMuted }}>
                          ×
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {ex.sets.map((s, si) => (
                    <View
                      key={`set-${ei}-${si}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: si === ex.sets.length - 1 ? 0 : 6,
                      }}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          backgroundColor: Colors.blue,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "900",
                            color: "#fff",
                          }}
                        >
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
                          style={{
                            flex: 1,
                            height: 30,
                            fontSize: 13,
                            color: Colors.text,
                            paddingVertical: 0,
                          }}
                        />
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          kg
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
                          value={s.reps}
                          onChangeText={(v) => {
                            const u = [...exercises];
                            u[ei].sets[si].reps = v;
                            setExercises(u);
                          }}
                          placeholder="0"
                          placeholderTextColor={Colors.textPlaceholder}
                          keyboardType="number-pad"
                          style={{
                            flex: 1,
                            height: 30,
                            fontSize: 13,
                            color: Colors.text,
                            paddingVertical: 0,
                          }}
                        />
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          회
                        </Text>
                      </View>

                      {ex.sets.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            const u = [...exercises];
                            u[ei].sets = u[ei].sets.filter((_, i) => i !== si);
                            setExercises(u);
                          }}
                          style={{
                            width: 24,
                            height: 30,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 16,
                              color: Colors.textMuted,
                            }}
                          >
                            ×
                          </Text>
                        </TouchableOpacity>
                      )}

                      {si === ex.sets.length - 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            const u = [...exercises];
                            u[ei].sets.push({ weight: "", reps: "" });
                            setExercises(u);
                          }}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            backgroundColor: Colors.blue,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 20,
                              color: "#fff",
                              fontWeight: "900",
                            }}
                          >
                            +
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {suggestions[ei] && (
                    <View
                      style={{
                        backgroundColor: Colors.blue + "12",
                        borderRadius: 10,
                        padding: 8,
                        marginTop: 10,
                        borderWidth: 1,
                        borderColor: Colors.blue + "33",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.blue,
                          fontWeight: "800",
                          marginBottom: 6,
                        }}
                      >
                        이전 기록 {suggestions[ei]!.date} · 누르면 입력
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 5,
                        }}
                      >
                        {suggestions[ei]!.sets.map(
                          (prevSet: any, prevIdx: number) => (
                            <TouchableOpacity
                              key={`prev-${ei}-${prevIdx}`}
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
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderWidth: 1,
                                borderColor: Colors.blue + "33",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: Colors.blue,
                                  fontWeight: "900",
                                }}
                              >
                                {prevIdx + 1}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  color: Colors.text,
                                  fontWeight: "800",
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
                  )}

                  {/* 운동별 메모 */}
                  <TextInput
                    value={ex.memo}
                    onChangeText={(v) => {
                      const u = [...exercises];
                      u[ei].memo = v;
                      setExercises(u);
                    }}
                    placeholder="메모 (선택)"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{
                      marginTop: 6,
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 9,
                      paddingVertical: 6,
                      fontSize: 12,
                      color: Colors.text,
                    }}
                  />
                  {suggestions[ei]?.latestMemo && !ex.memo && (
                    <TouchableOpacity
                      onPress={() => {
                        const u = [...exercises];
                        u[ei].memo = suggestions[ei]!.latestMemo!;
                        setExercises(u);
                      }}
                      style={{
                        marginTop: 4,
                        backgroundColor: Colors.bgSub,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontSize: 10, color: Colors.textMuted }}>최근</Text>
                      <Text style={{ fontSize: 11, color: Colors.textSub, flex: 1 }} numberOfLines={1}>
                        {suggestions[ei]!.latestMemo}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={() =>
                  setExercises([
                    ...exercises,
                    {
                      name: "",
                      sets: [{ weight: "", reps: "" }],
                      memo: "",
                    },
                  ])
                }
                style={{
                  backgroundColor: Colors.blue + "12",
                  borderWidth: 1,
                  borderColor: Colors.blue + "33",
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.blue,
                    fontWeight: "900",
                  }}
                >
                  + 운동 추가
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {!editingWorkoutId && (
                  <TouchableOpacity
                    onPress={async () => {
                      const draftKey = `personal_draft_${selectedDate}`;
                      const draft = {
                        exercises,
                        personalBodyParts,
                        personalCondition,
                      };
                      await AsyncStorage.setItem(draftKey, JSON.stringify(draft));
                      Alert.alert("임시저장 완료", "나중에 이어서 작성할 수 있어요.", [
                        { text: "확인", onPress: () => resetPersonalForm(true) },
                      ]);
                    }}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: Colors.blue,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.blue }}>
                      임시저장
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={savePersonalLog}
                  disabled={saving}
                  style={{
                    flex: editingWorkoutId ? undefined : 2,
                    backgroundColor: Colors.blue,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                    opacity: saving ? 0.6 : 1,
                    ...(editingWorkoutId ? { alignSelf: "stretch" as const, width: "100%" } : {}),
                  }}
                >
                  <Text
                    style={{ fontSize: 15, fontWeight: "900", color: "#fff" }}
                  >
                    {saving
                      ? "저장 중..."
                      : editingWorkoutId
                        ? "개인운동 수정 완료"
                        : "개인운동 등록"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════
          전체보기 모달 (날짜별 / 운동별)
      ══════════════════════════════════ */}
      <Modal visible={showHistoryModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{
              flex: 1,
              marginTop: 60,
              backgroundColor: Colors.bg ?? "#f5f5f5",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
            }}
          >
            {/* 헤더 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 14,
                backgroundColor: "#fff",
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Text
                style={{ fontSize: 17, fontWeight: "900", color: Colors.text }}
              >
                이전 운동 기록
              </Text>
              <TouchableOpacity
                onPress={() => setShowHistoryModal(false)}
                style={{ padding: 4 }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    color: Colors.textMuted,
                    fontWeight: "700",
                  }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* 탭: 날짜별 / 운동별 */}
            <View
              style={{
                flexDirection: "row",
                backgroundColor: "#fff",
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              {(["date", "exercise"] as const).map((tab) => {
                const isActive = historyTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => {
                      setHistoryTab(tab);
                      setHistorySelectedExercise(null);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderBottomWidth: 2,
                      borderBottomColor: isActive ? Colors.blue : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: isActive ? Colors.blue : Colors.textMuted,
                      }}
                    >
                      {tab === "date" ? "날짜별" : "운동별"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── 날짜별 탭 ── */}
            {historyTab === "date" && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* 날짜 입력 (숫자만 입력해도 자동 포맷) */}
                <View
                  style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}
                >
                  <View style={{ flex: 1 }}>
                    <TextInput
                      value={historyDateInput}
                      onChangeText={(text) => {
                        const digits = text.replace(/\D/g, "").slice(0, 8);
                        let formatted = digits;
                        if (digits.length > 4)
                          formatted =
                            digits.slice(0, 4) + "-" + digits.slice(4);
                        if (digits.length > 6)
                          formatted =
                            digits.slice(0, 4) +
                            "-" +
                            digits.slice(4, 6) +
                            "-" +
                            digits.slice(6);
                        setHistoryDateInput(formatted);
                        if (digits.length === 0) {
                          setHistoryDateLogs([]);
                          setHistoryDateFilter("ALL");
                        }
                        if (digits.length === 8) {
                          searchByDate(
                            digits.slice(0, 4) +
                              "-" +
                              digits.slice(4, 6) +
                              "-" +
                              digits.slice(6),
                          );
                        }
                      }}
                      placeholder="날짜 입력  예) 20260325"
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="numeric"
                      style={{
                        backgroundColor: "#fff",
                        borderWidth: 1,
                        borderColor:
                          historyDateLogs.length > 0
                            ? Colors.blue
                            : Colors.border,
                        borderRadius: 10,
                        paddingHorizontal: 14,
                        paddingRight: historyDateInput.length > 0 ? 40 : 14,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: Colors.text,
                      }}
                    />
                    {historyDateInput.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setHistoryDateInput("");
                          setHistoryDateLogs([]);
                          setHistoryDateFilter("ALL");
                          Keyboard.dismiss();
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          position: "absolute",
                          right: 12,
                          top: 0,
                          bottom: 0,
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      searchByDate(historyDateInput);
                    }}
                    style={{
                      backgroundColor: Colors.blue,
                      borderRadius: 10,
                      paddingHorizontal: 16,
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontWeight: "900", fontSize: 13 }}
                    >
                      조회
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 최근 운동일 빠른 선택 칩 */}
                {historyRecentDates.length > 0 &&
                  historyDateLogs.length === 0 && (
                    <View style={{ marginBottom: 14 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.textMuted,
                          marginBottom: 6,
                        }}
                      >
                        최근 운동일
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {historyRecentDates.map((d) => (
                            <TouchableOpacity
                              key={d}
                              onPress={() => {
                                setHistoryDateInput(d);
                                searchByDate(d);
                              }}
                              style={{
                                backgroundColor: Colors.bgSub,
                                borderWidth: 1,
                                borderColor: Colors.border,
                                borderRadius: 8,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: Colors.textSub,
                                  fontWeight: "600",
                                }}
                              >
                                {d}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                {/* PT / 개인운동 필터 칩 */}
                {historyDateLogs.length > 0 && (
                  <View
                    style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}
                  >
                    {(["ALL", "PT", "PERSONAL"] as const).map((f) => {
                      const label =
                        f === "ALL"
                          ? "전체"
                          : f === "PT"
                            ? "PT 수업"
                            : "개인운동";
                      const active = historyDateFilter === f;
                      return (
                        <TouchableOpacity
                          key={f}
                          onPress={() => setHistoryDateFilter(f)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: active
                              ? Colors.blue
                              : Colors.bgSub,
                            borderWidth: 1,
                            borderColor: active ? Colors.blue : Colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: active ? "#fff" : Colors.textSub,
                            }}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {historyDateLoading && (
                  <ActivityIndicator
                    color={Colors.blue}
                    style={{ marginTop: 24 }}
                  />
                )}

                {!historyDateLoading &&
                  historyDateInput.length === 10 &&
                  historyDateLogs.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 40 }}>
                      <Text style={{ fontSize: 28, marginBottom: 8 }}>📭</Text>
                      <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                        {historyDateInput} 에 운동 기록이 없어요
                      </Text>
                    </View>
                  )}

                {historyDateLogs
                  .filter((log) =>
                    historyDateFilter === "ALL"
                      ? true
                      : log.workoutType === historyDateFilter,
                  )
                  .map((log) => (
                    <View key={`hist-wrap-${log.workoutId}`}>
                      {renderWorkoutCard(
                        log,
                        log.workoutType === "PT" ? Colors.green : Colors.blue,
                        log.workoutType === "PT" ? "PT 수업 완료" : "개인 운동",
                      )}
                      {trainerPlan && log.workoutId && log.workoutType === "PT" && (
                        <CommentSection targetType="WORKOUT_LOG" targetId={log.workoutId} />
                      )}
                    </View>
                  ))}

                {/* 필터 적용 후 결과 없을 때 */}
                {!historyDateLoading &&
                  historyDateFilter !== "ALL" &&
                  historyDateLogs.length > 0 &&
                  historyDateLogs.filter(
                    (l) => l.workoutType === historyDateFilter,
                  ).length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 30 }}>
                      <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                        {historyDateFilter === "PT" ? "PT 수업" : "개인운동"}{" "}
                        기록이 없어요
                      </Text>
                    </View>
                  )}
              </ScrollView>
            )}

            {/* ── 운동별 탭 ── */}
            {historyTab === "exercise" && (
              <View style={{ flex: 1 }}>
                {/* 운동 선택 전: 드롭다운 검색 + 리스트 */}
                {!historySelectedExercise && (
                  <View style={{ flex: 1 }}>
                    {/* 바깥 터치 시 드롭다운 닫기 */}
                    {historyExDropOpen && (
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => {
                          Keyboard.dismiss();
                          setHistoryExDropOpen(false);
                          setHistoryExerciseSearch("");
                        }}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 5,
                        }}
                      />
                    )}

                    {/* 드롭다운 트리거 + 플로팅 패널 */}
                    <View
                      style={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 8,
                        zIndex: 10,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setHistoryExDropOpen((prev) => !prev)}
                        onLayout={(e) =>
                          setHistoryExSelectorH(e.nativeEvent.layout.height)
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#fff",
                          borderWidth: 1,
                          borderColor: historyExDropOpen
                            ? Colors.blue
                            : Colors.border,
                          borderRadius: 10,
                          paddingHorizontal: 14,
                          paddingVertical: 11,
                          gap: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            color: Colors.textPlaceholder,
                            flex: 1,
                          }}
                        >
                          운동 이름으로 검색
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          {historyExDropOpen ? "▲" : "▼"}
                        </Text>
                      </TouchableOpacity>

                      {/* 플로팅 드롭다운 */}
                      {historyExDropOpen && (
                        <View
                          style={{
                            position: "absolute",
                            top: historyExSelectorH + 12,
                            left: 16,
                            right: 16,
                            zIndex: 20,
                            borderWidth: 1,
                            borderColor: Colors.border,
                            borderRadius: 12,
                            backgroundColor: "#fff",
                            overflow: "hidden",
                            maxHeight: 320,
                            shadowColor: "#000",
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            shadowOffset: { width: 0, height: 4 },
                            elevation: 8,
                          }}
                        >
                          <View
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderBottomWidth: 1,
                              borderBottomColor: Colors.border,
                            }}
                          >
                            <TextInput
                              value={historyExerciseSearch}
                              onChangeText={setHistoryExerciseSearch}
                              placeholder="운동명 검색"
                              placeholderTextColor={Colors.textPlaceholder}
                              autoFocus
                              style={{
                                backgroundColor: Colors.bgSub,
                                borderRadius: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 7,
                                fontSize: 13,
                                color: Colors.text,
                              }}
                            />
                          </View>
                          <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="always"
                          >
                            {(() => {
                              const q = historyExerciseSearch
                                .trim()
                                .toLowerCase();
                              const filtered = q
                                ? historyExerciseList.filter(({ name }) =>
                                    name.toLowerCase().includes(q),
                                  )
                                : historyExerciseList;
                              if (filtered.length === 0) {
                                return (
                                  <View
                                    style={{
                                      alignItems: "center",
                                      paddingVertical: 20,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 13,
                                        color: Colors.textMuted,
                                      }}
                                    >
                                      {q
                                        ? `"${historyExerciseSearch}" 결과 없음`
                                        : "아직 운동 기록이 없어요"}
                                    </Text>
                                  </View>
                                );
                              }
                              return filtered.map(({ name, count }, idx) => (
                                <TouchableOpacity
                                  key={name}
                                  onPress={() => {
                                    Keyboard.dismiss();
                                    setHistoryExDropOpen(false);
                                    setHistoryExerciseSearch("");
                                    selectExerciseHistory(name);
                                  }}
                                  style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    paddingHorizontal: 14,
                                    paddingVertical: 12,
                                    backgroundColor: "#fff",
                                    borderBottomWidth:
                                      idx < filtered.length - 1 ? 1 : 0,
                                    borderBottomColor: Colors.border,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 14,
                                      fontWeight: "500",
                                      color: Colors.text,
                                    }}
                                  >
                                    {name}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: Colors.textMuted,
                                    }}
                                  >
                                    총 {count}회
                                  </Text>
                                </TouchableOpacity>
                              ));
                            })()}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    {/* 운동 목록 (항상 표시) */}
                    <ScrollView
                      style={{ flex: 1 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {historyExerciseList.length === 0 ? (
                        <View
                          style={{ alignItems: "center", paddingVertical: 40 }}
                        >
                          <Text
                            style={{ fontSize: 14, color: Colors.textMuted }}
                          >
                            아직 운동 기록이 없어요
                          </Text>
                        </View>
                      ) : (
                        historyExerciseList.map(({ name, count }) => (
                          <TouchableOpacity
                            key={name}
                            onPress={() => {
                              Keyboard.dismiss();
                              selectExerciseHistory(name);
                            }}
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              paddingHorizontal: 20,
                              paddingVertical: 14,
                              backgroundColor: "#fff",
                              borderBottomWidth: 1,
                              borderBottomColor: Colors.border,
                            }}
                          >
                            <View>
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "700",
                                  color: Colors.text,
                                }}
                              >
                                {name}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: Colors.textMuted,
                                  marginTop: 2,
                                }}
                              >
                                총 {count}회 기록
                              </Text>
                            </View>
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
                        ))
                      )}
                    </ScrollView>
                  </View>
                )}

                {/* 운동 선택 후: 뒤로가기 + 날짜별 기록 */}
                {historySelectedExercise && (
                  <View style={{ flex: 1 }}>
                    {/* 헤더: 뒤로가기 + 운동명 + 총 기록 수 */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: Colors.border,
                        backgroundColor: "#fff",
                        gap: 8,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          setHistorySelectedExercise(null);
                          setHistoryExerciseLogs([]);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 2,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            color: Colors.blue,
                            fontWeight: "700",
                          }}
                        >
                          ‹
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: Colors.blue,
                            fontWeight: "700",
                          }}
                        >
                          {historySelectedExercise}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                        전체 기록 {historyExerciseLogs.length}회
                      </Text>
                    </View>

                    <ScrollView
                      style={{ flex: 1 }}
                      contentContainerStyle={{
                        paddingHorizontal: 16,
                        paddingTop: 12,
                        paddingBottom: 24,
                      }}
                    >
                      {historyExerciseLogs.length === 0 && (
                        <View
                          style={{ alignItems: "center", paddingVertical: 40 }}
                        >
                          <Text
                            style={{ fontSize: 14, color: Colors.textMuted }}
                          >
                            기록이 없어요
                          </Text>
                        </View>
                      )}
                      {historyExerciseLogs.map((item, idx) => {
                        const maxWeight = item.sets.reduce((max, s) => {
                          const w = parseFloat(String(s.weight ?? "0")) || 0;
                          return w > max ? w : max;
                        }, 0);
                        return (
                          <View
                            key={idx}
                            style={{
                              backgroundColor: "#fff",
                              borderRadius: 12,
                              padding: 14,
                              marginBottom: 10,
                              borderWidth: 1,
                              borderColor: Colors.border,
                            }}
                          >
                            {/* 날짜 + PT/개인 뱃지 + 최고 중량 */}
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 10,
                              }}
                            >
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: "800",
                                    color: Colors.blue,
                                  }}
                                >
                                  {item.date}
                                </Text>
                                <View
                                  style={{
                                    backgroundColor:
                                      item.workoutType === "PT"
                                        ? Colors.green + "18"
                                        : Colors.blue + "12",
                                    borderRadius: 6,
                                    paddingHorizontal: 7,
                                    paddingVertical: 2,
                                    borderWidth: 1,
                                    borderColor:
                                      item.workoutType === "PT"
                                        ? Colors.green + "44"
                                        : Colors.blue + "33",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 10,
                                      fontWeight: "700",
                                      color:
                                        item.workoutType === "PT"
                                          ? Colors.green
                                          : Colors.blue,
                                    }}
                                  >
                                    {item.workoutType === "PT" ? "PT" : "개인"}
                                  </Text>
                                </View>
                              </View>
                              {maxWeight > 0 && (
                                <View
                                  style={{
                                    backgroundColor: Colors.blue + "12",
                                    borderRadius: 999,
                                    paddingHorizontal: 10,
                                    paddingVertical: 3,
                                    borderWidth: 1,
                                    borderColor: Colors.blue + "33",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      fontWeight: "700",
                                      color: Colors.blue,
                                    }}
                                  >
                                    최고 {maxWeight}kg
                                  </Text>
                                </View>
                              )}
                            </View>
                            {/* 세트 태그 */}
                            <View
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 6,
                              }}
                            >
                              {item.sets.map((set, si) => (
                                <View
                                  key={si}
                                  style={{
                                    backgroundColor: Colors.bgSub,
                                    borderRadius: 8,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderWidth: 1,
                                    borderColor: Colors.border,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: "600",
                                      color: Colors.textSub,
                                    }}
                                  >
                                    {si + 1}세트{" "}
                                    {set.weight ? `${set.weight}kg × ` : ""}
                                    {set.reps}회
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>


      {/* 갤러리 뷰어 모달 */}
      <Modal visible={mediaGallery.length > 0} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {/* 헤더 */}
          <View
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              right: 0,
              zIndex: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "700",
                opacity: 0.8,
              }}
            >
              {mediaGalleryIndex + 1} / {mediaGallery.length}
            </Text>
            <TouchableOpacity
              onPress={() => setMediaGallery([])}
              style={{ padding: 8 }}
            >
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* 스와이프 영역 */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setMediaGalleryIndex(idx);
            }}
            style={{ flex: 1 }}
          >
            {mediaGallery.map((media, idx) => (
              <View
                key={idx}
                style={{
                  width: SCREEN_W,
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {media.mediaType === "IMAGE" ? (
                  <ScrollView
                    style={{ width: SCREEN_W, height: SCREEN_H }}
                    contentContainerStyle={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    maximumZoomScale={4}
                    minimumZoomScale={1}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    centerContent
                  >
                    <Image
                      source={{ uri: media.url }}
                      style={{ width: SCREEN_W, height: SCREEN_H }}
                      resizeMode="contain"
                    />
                  </ScrollView>
                ) : (
                  <Video
                    source={{ uri: media.url }}
                    style={{ width: SCREEN_W, height: SCREEN_H * 0.7 }}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={idx === mediaGalleryIndex}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* 인디케이터 dots */}
          {mediaGallery.length > 1 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
              }}
            >
              {mediaGallery.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      i === mediaGalleryIndex
                        ? "#fff"
                        : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </View>
          )}

          {/* 저장 버튼 */}
          <TouchableOpacity
            onPress={() =>
              saveMediaToDevice(mediaGallery[mediaGalleryIndex]?.url)
            }
            disabled={mediaSaving}
            style={{
              marginHorizontal: 20,
              marginBottom: 40,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: mediaSaving
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.18)",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {mediaSaving ? "저장 중..." : "갤러리에 저장"}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}
