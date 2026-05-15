import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

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

interface WorkoutLog {
  workoutId?: number;
  date: string;
  workoutType: string;
  exercises: {
    name: string;
    sets: { setId?: number; weight: any; reps: any; rpe?: any }[];
  }[];
}

export default function WorkoutScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [exercises, setExercises] = useState([
    { name: "", sets: [{ weight: "", reps: "" }] },
  ]);

  const didFetchInitial = useRef(false);
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
          exercises: l.exercises ?? l.sets ?? l.workoutSets ?? [],
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
    [key: number]: { date: string; sets: any[] } | null;
  }>({});
  const suggestionRequestRef = useRef<{ [key: number]: string }>({});

  const fetchSuggestion = async (exerciseName: string, idx: number) => {
    const normalizedName = exerciseName.trim().toLowerCase();
    suggestionRequestRef.current[idx] = normalizedName;

    if (!normalizedName) {
      setSuggestions((prev) => ({ ...prev, [idx]: null }));
      return;
    }

    const applySuggestion = (value: { date: string; sets: any[] } | null) => {
      if (suggestionRequestRef.current[idx] !== normalizedName) return;
      setSuggestions((prev) => ({ ...prev, [idx]: value }));
    };

    const findLatest = (logs: any[]) => {
      return (
        logs
          .map((l: any) => ({
            ...l,
            date: String(l.date ?? l.logDate ?? l.log_date).slice(0, 10),
            workoutType: l.workoutType ?? l.workout_type,
            exercises: l.exercises ?? l.sets ?? l.workoutSets ?? [],
          }))
          .filter((l: any) => l.workoutType === "PERSONAL")
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
      // 먼저 현재 로드된 주간 운동로그에서 찾기
      let found = findLatest(workoutLogs);

      // 주간 데이터에 없으면 전체 이력 조회
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
        applySuggestion({ date: found[0].date, sets: lastEx?.sets ?? [] });
      } else {
        applySuggestion(null);
      }
    } catch (e) {
      console.log("이전 기록 조회 오류:", e);
      applySuggestion(null);
    }
  };

  const resetPersonalForm = (clear = false) => {
    setShowAddModal(false);
    setEditingWorkoutId(null);

    if (clear) {
      setExercises([{ name: "", sets: [{ weight: "", reps: "" }] }]);
      setSuggestions({});
    }
  };

  const startEditPersonalLog = (log: any) => {
    setEditingWorkoutId(log.workoutId ?? log.workout_id ?? log.id ?? null);
    setExercises(
      (log.exercises ?? []).map((ex: any) => ({
        name: ex.name ?? "",
        sets: (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
        })),
      })),
    );
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
        exercises: valid.map((ex) => ({
          name: ex.name,
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
              : "저장 실패")
        );
      }

      resetPersonalForm(true);
      await fetchLogs(null, weekOffset);
      Alert.alert(
        "완료",
        editingWorkoutId
          ? "개인 운동이 수정됐어요!"
          : "개인 운동이 등록됐어요! 💪",
      );
    } catch (e: any) {
      Alert.alert("오류", e?.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (didFetchInitial.current) return;

    didFetchInitial.current = true;
    prevWeekOffset.current = weekOffset;

    fetchAll();
  }, []);

  useEffect(() => {
    if (!didFetchInitial.current) return;
    if (prevWeekOffset.current === weekOffset) return;

    prevWeekOffset.current = weekOffset;

    const dates = getWeekDates(weekOffset);
    const todayKey = toDateKey(new Date());
    const inThisWeek = dates.some((d) => toDateKey(d) === todayKey);

    setSelectedDate(inThisWeek ? todayKey : toDateKey(dates[0]));
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
            marginBottom: 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: "900", color: Colors.text }}>
              {title}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}>
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
    <>
      <ScrollView
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
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
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
                      width: 34,
                      height: 34,
                      borderRadius: 10,
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
              marginTop: 12,
              marginBottom: 12,
            }}
          />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
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
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                PT
              </Text>
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

        {/* 선택 날짜 + 개인운동 추가 버튼 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: Colors.textSub }}
          >
            {selectedDate} 기록
          </Text>
          {isToday && (
            <TouchableOpacity
              onPress={() => {
                if (showAddModal) resetPersonalForm();
                else setShowAddModal(true);
              }}
              style={{
                backgroundColor: showAddModal ? Colors.border : Colors.blue,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: showAddModal ? Colors.textSub : "#fff",
                }}
              >
                {showAddModal ? "접기" : "+ 개인운동"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 개인운동 인라인 입력폼 */}
        {showAddModal && isToday && (
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 4,
                    height: 18,
                    backgroundColor: Colors.blue,
                    borderRadius: 2,
                  }}
                />
                <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.text }}>
                  {editingWorkoutId ? "개인운동 수정" : "개인운동 등록"}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                {selectedDate}
              </Text>
            </View>

            {exercises.map((ex, ei) => (
              <View
                key={`exercise-${ei}`}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 10,
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
                      fetchSuggestion(v, ei);
                    }}
                    placeholder="운동명"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{
                      flex: 1,
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                      height: 38,
                      fontSize: 14,
                      fontWeight: "800",
                      color: Colors.text,
                    }}
                  />

                  {ex.name.trim().length > 0 &&
                    suggestions[ei] === null &&
                    workoutLogs.some((log: any) =>
                      (log.exercises ?? []).some((item: any) =>
                        String(item.name ?? "")
                          .replaceAll(" ", "")
                          .toLowerCase()
                          .includes(ex.name.replaceAll(" ", "").toLowerCase())
                      )
                    ) && (
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
                            workoutLogs.flatMap((log: any) =>
                              (log.exercises ?? [])
                                .map((item: any) => String(item.name ?? ""))
                                .filter((name: string) =>
                                  name
                                    .replaceAll(" ", "")
                                    .toLowerCase()
                                    .includes(ex.name.replaceAll(" ", "").toLowerCase())
                                )
                            )
                          )
                        )
                          .slice(0, 4)
                          .map((name: string) => (
                            <TouchableOpacity
                              key={name}
                              onPress={() => {
                                const u = [...exercises];
                                u[ei].name = name;
                                setExercises(u);
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
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        backgroundColor: Colors.bgSub,
                        justifyContent: "center",
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 20, color: Colors.textMuted }}>×</Text>
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
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        backgroundColor: Colors.blue,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "900", color: "#fff" }}>
                        {si + 1}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        height: 34,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: Colors.bgSub,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        paddingHorizontal: 10,
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
                          height: 34,
                          fontSize: 14,
                          color: Colors.text,
                          paddingVertical: 0,
                        }}
                      />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>kg</Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                        height: 34,
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: Colors.bgSub,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        paddingHorizontal: 10,
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
                          height: 34,
                          fontSize: 14,
                          color: Colors.text,
                          paddingVertical: 0,
                        }}
                      />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>회</Text>
                    </View>

                    {ex.sets.length > 1 && (
                      <TouchableOpacity
                        onPress={() => {
                          const u = [...exercises];
                          u[ei].sets = u[ei].sets.filter((_, i) => i !== si);
                          setExercises(u);
                        }}
                        style={{
                          width: 28,
                          height: 34,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 18, color: Colors.textMuted }}>×</Text>
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
                          width: 36,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: Colors.blue,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ fontSize: 22, color: "#fff", fontWeight: "900" }}>
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

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                      {suggestions[ei]!.sets.map((prevSet: any, prevIdx: number) => (
                        <TouchableOpacity
                          key={`prev-${ei}-${prevIdx}`}
                          onPress={() => {
                            const u = [...exercises];
                            while (u[ei].sets.length <= prevIdx) {
                              u[ei].sets.push({ weight: "", reps: "" });
                            }
                            u[ei].sets[prevIdx].weight = prevSet.weight ? String(prevSet.weight) : "";
                            u[ei].sets[prevIdx].reps = prevSet.reps ? String(prevSet.reps) : "";
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
                          <Text style={{ fontSize: 11, color: Colors.blue, fontWeight: "900" }}>
                            {prevIdx + 1}
                          </Text>
                          <Text style={{ fontSize: 11, color: Colors.text, fontWeight: "800" }}>
                            {"  "}
                            {prevSet.weight ? `${prevSet.weight}kg × ` : ""}
                            {prevSet.reps}회
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
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
                backgroundColor: Colors.blue + "12",
                borderWidth: 1,
                borderColor: Colors.blue + "33",
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 13, color: Colors.blue, fontWeight: "900" }}>
                + 운동 추가
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={savePersonalLog}
              disabled={saving}
              style={{
                backgroundColor: Colors.blue,
                borderRadius: 12,
                padding: 14,
                alignItems: "center",
                opacity: saving ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#fff" }}>
                {saving
                  ? "저장 중..."
                  : editingWorkoutId
                    ? "개인운동 수정 완료"
                    : "개인운동 등록"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PT 기록 */}
        {dayPt.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green }} />
              <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.text }}>
                PT 수업
              </Text>
            </View>

            {dayPt.map((log) =>
              renderWorkoutCard(
                log,
                Colors.green,
                "PT 수업 완료",
                () => startEditPersonalLog(log)
              )
            )}
          </View>
        )}

        {/* 개인 운동 기록 */}
        {dayFitLogs.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.blue }} />
              <Text style={{ fontSize: 15, fontWeight: "900", color: Colors.text }}>
                개인 운동
              </Text>
            </View>

            {dayFitLogs.map((log) =>
              renderWorkoutCard(
                log,
                Colors.blue,
                "개인 운동 완료",
                () => startEditPersonalLog(log)
              )
            )}
          </View>
        )}

        {dayPt.length === 0 && dayFitLogs.length === 0 && (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🏋️</Text>
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>
              이날 운동 기록이 없어요
            </Text>
            {isToday && (
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textMuted,
                  marginTop: 4,
                }}
              >
                + 개인운동 버튼으로 기록해보세요!
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}
