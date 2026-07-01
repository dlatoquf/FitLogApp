import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";
import { getWeekDates, toDateKey } from "../../../hooks/useApi";

interface ThisWeekSchedule {
  scheduleId: number;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
}
interface MemberHomeData {
  member: {
    id: number;
    name: string;
    trainerName?: string;
    trainerPlan?: string;
    ptExpDate?: string;
    goal?: string;
    weight?: number;
    muscleMass?: number;
  };
  ptRemaining: number;
  ptTotal: number;
  nextSchedule: string | null;
  dDay: number | null;
}

interface Noti {
  notificationId: number;
  type: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const NOTI_ICON: Record<string, string> = {
  WORKOUT_LOG: "💪",
  SCHEDULE: "📅",
  FEEDBACK: "💬",
  PT_EXPIRY: "⏰",
  GENERAL: "🔔",
};

const formatTime = (time?: string) => {
  if (!time) return "";
  return String(time).slice(0, 5);
};

export default function MemberHomeScreen() {
  const [data, setData] = useState<MemberHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTrainerConnect, setShowTrainerConnect] = useState(false);
  const [trainerCode, setTrainerCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [thisWeek, setThisWeek] = useState<ThisWeekSchedule[]>([]);
  const [notifications, setNotifications] = useState<Noti[]>([]);
  const [weekWorkoutDates, setWeekWorkoutDates] = useState<Set<string>>(
    new Set(),
  );
  const [bodyLogs, setBodyLogs] = useState<
    {
      date: string;
      weight: number | null;
      bodyFat: number | null;
      muscleMass: number | null;
    }[]
  >([]);
  const [latestFeedback, setLatestFeedback] = useState<{
    trainerName: string;
    content: string;
    date: string;
  } | null>(null);
  const [latestNotice, setLatestNotice] = useState<{
    id: number;
    content: string;
    createdAt: string;
  } | null>(null);
  const [latestWorkoutFeedback, setLatestWorkoutFeedback] = useState<{
    content: string;
    date: string;
    trainerName: string;
  } | null>(null);
  const [missions, setMissions] = useState<
    { id: number; content: string; isDone: boolean; trainerName: string }[]
  >([]);
  const [activeTab, setActiveTab] = useState<"공지" | "식단" | "운동">("공지");

  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };
      const [homeRes, weekRes, notiRes] = await Promise.all([
        fetch(`${API_URL}/api/member/home`, { headers }),
        fetch(`${API_URL}/api/member/schedule/this-week`, { headers }),
        fetch(`${API_URL}/api/notifications`, { headers }),
      ]);
      if (!homeRes.ok) {
        const errText = await homeRes.text().catch(() => "");
        throw new Error(
          `서버 오류 (${homeRes.status})${errText ? ": " + errText.slice(0, 120) : ""}`,
        );
      }
      const homeData = await homeRes.json();
      setData(homeData);

      // 이번 주 운동 날짜 + 체중 로그 + 최근 피드백 병렬 조회
      const thisMonday = getWeekDates(0)[0];
      const thisSunday = getWeekDates(0)[6];
      const fromKey = toDateKey(thisMonday);
      const toKey = toDateKey(thisSunday);
      try {
        const [fitlogRes, bodylogRes, feedbackRes, missionsRes, noticeRes] =
          await Promise.all([
            fetch(`${API_URL}/api/fitlog/me?from=${fromKey}&to=${toKey}`, {
              headers,
            }),
            fetch(`${API_URL}/api/bodylog/me`, { headers }),
            fetch(`${API_URL}/api/diet/feedback/latest`, { headers }),
            fetch(`${API_URL}/api/missions/my`, { headers }),
            fetch(`${API_URL}/api/member/notices/latest`, { headers }),
          ]);
        if (fitlogRes.ok) {
          try {
            const logs: any[] = await fitlogRes.json();
            const dates = new Set(
              logs.map((l: any) =>
                String(l.date ?? l.logDate ?? "").slice(0, 10),
              ),
            );
            setWeekWorkoutDates(dates);
            // 오늘 개인운동 피드백만 표시
            const todayStr = toDateKey(new Date());
            const todayFeedback = logs.find(
              (l: any) =>
                l.feedback &&
                String(l.feedback).trim() &&
                String(l.date ?? l.logDate ?? "").slice(0, 10) === todayStr &&
                (l.workoutType === "PERSONAL" || !l.workoutType),
            );
            setLatestWorkoutFeedback(
              todayFeedback
                ? {
                    content: todayFeedback.feedback,
                    date: todayStr,
                    trainerName: todayFeedback.trainerName ?? "",
                  }
                : null,
            );
          } catch {}
        }
        if (bodylogRes.ok) {
          try {
            const logs: any[] = await bodylogRes.json();
            setBodyLogs(
              logs.map((l: any) => ({
                date: l.date,
                weight: l.weight ?? null,
                bodyFat: l.bodyFat ?? null,
                muscleMass: l.muscleMass ?? null,
              })),
            );
          } catch {}
        }
        if (feedbackRes.ok && feedbackRes.status !== 204) {
          try {
            const fb = await feedbackRes.json();
            const todayStr = toDateKey(new Date());
            setLatestFeedback(
              fb && fb.date === todayStr
                ? {
                    trainerName: fb.trainerName,
                    content: fb.content,
                    date: fb.date,
                  }
                : null,
            );
          } catch {}
        }
        if (missionsRes.ok) {
          try {
            const ms: any[] = await missionsRes.json();
            setMissions(
              ms.slice(0, 10).map((m: any) => ({
                id: m.id,
                content: m.content,
                isDone: m.isDone,
                trainerName: m.trainerName,
              })),
            );
          } catch {}
        }
        if (noticeRes.ok && noticeRes.status !== 204) {
          try {
            setLatestNotice(await noticeRes.json());
          } catch {}
        } else {
          setLatestNotice(null);
        }
      } catch {}
      if (weekRes.ok) setThisWeek(await weekRes.json());
      if (notiRes.ok) setNotifications((await notiRes.json()).slice(0, 10));
    } catch (e: any) {
      console.error("[MemberHome] fetchHome 오류:", e);
      Alert.alert("오류", e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const connectTrainer = async () => {
    if (!trainerCode.trim()) {
      Alert.alert("오류", "트레이너 코드를 입력해주세요.");
      return;
    }
    setConnecting(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/connect-trainer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ trainerCode: trainerCode.trim().toUpperCase() }),
      });
      const result = await res.json();
      if (!res.ok) {
        const msg = result.message || "연결 실패";
        if (msg.includes("무료 플랜") || msg.includes("회원 3명")) {
          Alert.alert(
            "연결 불가",
            "이 트레이너는 현재 회원이 가득 찼어요.\n트레이너에게 문의해주세요.",
          );
        } else {
          Alert.alert("오류", msg);
        }
        return;
      }
      setTrainerCode("");
      setShowTrainerConnect(false);
      await fetchHome();
      Alert.alert("연결 완료", `${result.trainerName} 트레이너와 연결됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setConnecting(false);
    }
  };

  const toggleMission = async (missionId: number) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/missions/${missionId}/done`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        setMissions((prev) =>
          prev.map((m) => (m.id === missionId ? { ...m, isDone: true } : m)),
        );
      }
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      setActiveTab("공지");
      fetchHome();
    }, []),
  );

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

  const ptPct =
    data && data.ptTotal > 0
      ? Math.min((data.ptRemaining / data.ptTotal) * 100, 100)
      : 0;
  const lastBodyLog =
    bodyLogs.length > 0 ? bodyLogs[bodyLogs.length - 1] : null;
  const prevBodyLog =
    bodyLogs.length > 1 ? bodyLogs[bodyLogs.length - 2] : null;
  const weightDiff =
    lastBodyLog?.weight != null && prevBodyLog?.weight != null
      ? Math.round((lastBodyLog.weight - prevBodyLog.weight) * 10) / 10
      : null;
  const bodyFatDiff =
    lastBodyLog?.bodyFat != null && prevBodyLog?.bodyFat != null
      ? Math.round((lastBodyLog.bodyFat - prevBodyLog.bodyFat) * 10) / 10
      : null;
  const muscleMassDiff =
    lastBodyLog?.muscleMass != null && prevBodyLog?.muscleMass != null
      ? Math.round((lastBodyLog.muscleMass - prevBodyLog.muscleMass) * 10) / 10
      : null;

  // 현재 시간이 수업 종료시간을 지나면 홈의 "이번 주 내 수업"에서 숨김
  const now = new Date();
  const activeThisWeek = thisWeek.filter((s) => {
    const end = new Date(`${s.date}T${String(s.endTime).slice(0, 5)}:00`);
    return end > now;
  });

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingTop: 56,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchHome(true)}
            tintColor={Colors.green}
          />
        }
      >
        {/* 인사 + 알림 버튼 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <View>
            <Text
              style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}
            >
              안녕하세요 👋
            </Text>
            <Text
              style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}
            >
              {data?.member.name}님
            </Text>
            {data?.member.trainerName && (
              <Text
                style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}
              >
                담당: {data.member.trainerName} 트레이너
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/member/notifications")}
            style={{
              width: 36,
              height: 36,
              justifyContent: "center",
              alignItems: "center",
              backgroundColor:
                notifications.filter((n) => !n.isRead).length > 0
                  ? "#EFF6FF"
                  : Colors.bgSub,
              borderRadius: 18,
              borderWidth: 1,
              borderColor:
                notifications.filter((n) => !n.isRead).length > 0
                  ? Colors.blue + "44"
                  : Colors.border,
            }}
          >
            {/* 종 아이콘 */}
            <View
              style={{
                width: 16,
                height: 16,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 8,
                  backgroundColor:
                    notifications.filter((n) => !n.isRead).length > 0
                      ? Colors.blue
                      : Colors.textMuted,
                  borderRadius: 5,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              />
              <View
                style={{
                  width: 12,
                  height: 2.5,
                  backgroundColor:
                    notifications.filter((n) => !n.isRead).length > 0
                      ? Colors.blue
                      : Colors.textMuted,
                  borderRadius: 1,
                }}
              />
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  borderWidth: 1.5,
                  borderColor:
                    notifications.filter((n) => !n.isRead).length > 0
                      ? Colors.blue
                      : Colors.textMuted,
                  marginTop: 1,
                }}
              />
            </View>
            {notifications.filter((n) => !n.isRead).length > 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.blue,
                }}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* 트레이너 미연결 시 연결 버튼 */}
        {!data?.member.trainerName && (
          <TouchableOpacity
            onPress={() => setShowTrainerConnect(true)}
            style={{
              backgroundColor: Colors.greenLight,
              borderWidth: 1,
              borderColor: Colors.green + "44",
              borderRadius: 14,
              padding: 16,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                backgroundColor: Colors.green,
                borderRadius: 10,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 20 }}>🔑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 14, fontWeight: "700", color: Colors.green }}
              >
                트레이너 연결하기
              </Text>
              <Text
                style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}
              >
                트레이너 코드를 입력해 연결해요
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: Colors.green }}>›</Text>
          </TouchableOpacity>
        )}

        {/* PT 잔여 */}
        <View
          style={{
            backgroundColor: "#fff",
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
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: Colors.textSub }}>잔여 PT</Text>
            <View
              style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}
            >
              <Text
                style={{ fontSize: 28, fontWeight: "900", color: Colors.blue }}
              >
                {data?.ptRemaining ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.textMuted,
                  marginBottom: 4,
                }}
              >
                / {data?.ptTotal ?? 0}회
              </Text>
            </View>
          </View>
          <View
            style={{
              backgroundColor: Colors.border,
              borderRadius: 99,
              height: 8,
            }}
          >
            <View
              style={{
                width: `${ptPct}%` as any,
                height: 8,
                borderRadius: 99,
                backgroundColor: Colors.blue,
              }}
            />
          </View>
          {data?.member.ptExpDate && (
            <Text
              style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}
            >
              만료일: {data.member.ptExpDate}
            </Text>
          )}
        </View>

        {/* 이번 주 운동 현황 */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: Colors.textSub,
              marginBottom: 12,
            }}
          >
            이번 주 운동 현황
          </Text>
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {getWeekDates(0).map((d, i) => {
              const key = toDateKey(d);
              const hasLog = weekWorkoutDates.has(key);
              const isToday = key === toDateKey(new Date());
              return (
                <View key={key} style={{ alignItems: "center", gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: isToday ? Colors.green : Colors.textMuted,
                      fontWeight: isToday ? "800" : "400",
                    }}
                  >
                    {["월", "화", "수", "목", "금", "토", "일"][i]}
                  </Text>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: hasLog
                        ? Colors.green
                        : isToday
                          ? Colors.greenLight
                          : Colors.border + "55",
                      borderWidth: isToday && !hasLog ? 1.5 : 0,
                      borderColor: Colors.green + "88",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {hasLog ? (
                      <Text style={{ fontSize: 14 }}>💪</Text>
                    ) : (
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: isToday ? Colors.green : Colors.textMuted,
                        }}
                      >
                        {d.getDate()}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <Text
            style={{
              fontSize: 11,
              color: Colors.textMuted,
              marginTop: 10,
              textAlign: "center",
            }}
          >
            이번 주 {weekWorkoutDates.size}일 운동했어요{" "}
            {weekWorkoutDates.size >= 3 ? "🔥" : ""}
          </Text>
        </View>

        {/* 이번 주 내 수업 */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 14,
            padding: 14,
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
              marginBottom: activeThisWeek.length > 0 ? 10 : 0,
            }}
          >
            <Text
              style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub }}
            >
              이번 주 내 수업
            </Text>
            {activeThisWeek.length > 0 && (
              <Text
                style={{ fontSize: 11, color: Colors.blue, fontWeight: "600" }}
              >
                {activeThisWeek.length}개
              </Text>
            )}
          </View>
          {activeThisWeek.length === 0 ? (
            <Text
              style={{ fontSize: 13, color: Colors.textMuted, marginTop: 4 }}
            >
              이번 주 확정된 수업이 없어요
            </Text>
          ) : (
            activeThisWeek.map((s) => (
              <View
                key={`${s.scheduleId}-${s.date}-${s.startTime}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  marginBottom: 5,
                  backgroundColor: Colors.blueBg,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: Colors.blue + "28",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: Colors.blue,
                  }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: Colors.text,
                    flex: 1,
                  }}
                >
                  {s.date.slice(5)}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.blue,
                    fontWeight: "700",
                  }}
                >
                  {formatTime(s.startTime)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* 탭 바: 공지 | 식단 | 운동 */}
        <View
          style={{
            flexDirection: "row",
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
            marginBottom: 14,
          }}
        >
          {(["공지", "식단", "운동"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                alignItems: "center",
                paddingBottom: 10,
                borderBottomWidth: 2,
                borderBottomColor:
                  activeTab === tab ? Colors.blue : "transparent",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: activeTab === tab ? "700" : "500",
                  color: activeTab === tab ? Colors.blue : Colors.textMuted,
                }}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 탭 콘텐츠 */}
        {activeTab === "공지" && (
          <View>
            {/* 공지사항 */}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/member/notices" as any)}
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: "#FDE68A",
                marginBottom: 10,
              }}
              activeOpacity={0.8}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "800", color: "#B45309" }}
                >
                  트레이너 공지
                </Text>
                <Text style={{ fontSize: 11, color: "#B45309" }}>더보기 →</Text>
              </View>
              {latestNotice ? (
                <>
                  <Text
                    style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}
                    numberOfLines={2}
                  >
                    {latestNotice.content}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: Colors.textPlaceholder,
                      marginTop: 4,
                    }}
                  >
                    {latestNotice.createdAt}
                  </Text>
                </>
              ) : (
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                  아직 등록된 공지가 없어요
                </Text>
              )}
            </TouchableOpacity>

            {/* 챌린지 — 컴팩트 */}
            <View
              style={{
                backgroundColor: "#fff7ed",
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderWidth: 1,
                borderColor: "#f9731633",
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: missions.length > 0 ? 8 : 0,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#f97316" }}
                >
                  챌린지
                </Text>
                {missions.length > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#f9731699",
                      marginLeft: "auto",
                    }}
                  >
                    {missions.filter((m) => m.isDone).length}/{missions.length}{" "}
                    완료
                  </Text>
                )}
              </View>
              {missions.length === 0 ? (
                <Text style={{ fontSize: 12, color: "#f9731688" }}>
                  아직 챌린지가 없어요
                </Text>
              ) : (
                missions.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 7,
                      borderBottomWidth: 1,
                      borderBottomColor: "#f9731618",
                    }}
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: m.isDone ? "#f97316" : "transparent",
                        borderWidth: 1.5,
                        borderColor: "#f97316",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      {m.isDone && (
                        <Text
                          style={{
                            fontSize: 10,
                            color: "#fff",
                            fontWeight: "700",
                          }}
                        >
                          ✓
                        </Text>
                      )}
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: m.isDone ? "#f9731688" : "#1c1c1e",
                        textDecorationLine: m.isDone ? "line-through" : "none",
                        fontWeight: "500",
                      }}
                    >
                      {m.content}
                    </Text>
                    {!m.isDone && (
                      <TouchableOpacity
                        onPress={() => toggleMission(m.id)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          backgroundColor: "#f97316",
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            color: "#fff",
                            fontWeight: "700",
                          }}
                        >
                          완료
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
              {missions.length > 0 && missions.every((m) => m.isDone) && (
                <Text
                  style={{
                    fontSize: 12,
                    color: "#f97316",
                    textAlign: "center",
                    marginTop: 8,
                    fontWeight: "700",
                  }}
                >
                  모두 완료! 🎉
                </Text>
              )}
            </View>
          </View>
        )}

        {activeTab === "식단" && (
          <View>
            {latestFeedback ? (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/member/diet")}
                style={{
                  backgroundColor: Colors.greenLight,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: Colors.green + "44",
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: Colors.green,
                    }}
                  >
                    트레이너 식단 피드백
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: Colors.textMuted,
                      marginLeft: "auto",
                    }}
                  >
                    {latestFeedback.date}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}
                  numberOfLines={3}
                >
                  {latestFeedback.content}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: Colors.text,
                    marginBottom: 4,
                  }}
                >
                  식단 피드백이 없어요
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  트레이너가 식단 피드백을 남기면 여기에 표시돼요
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/member/diet")}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textSub,
                  fontWeight: "600",
                }}
              >
                식단 전체 보기 →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "운동" && (
          <View>
            {latestWorkoutFeedback ? (
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/member/workout" as any)}
                style={{
                  backgroundColor: Colors.greenLight,
                  borderRadius: 12,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: Colors.green + "44",
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "800",
                      color: Colors.green,
                    }}
                  >
                    트레이너 운동 피드백
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: Colors.textMuted,
                      marginLeft: "auto",
                    }}
                  >
                    {latestWorkoutFeedback.date}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}
                  numberOfLines={3}
                >
                  {latestWorkoutFeedback.content}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: Colors.text,
                    marginBottom: 4,
                  }}
                >
                  운동 피드백이 없어요
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  트레이너가 운동 피드백을 남기면 여기에 표시돼요
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/member/workout" as any)}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textSub,
                  fontWeight: "600",
                }}
              >
                운동일지 전체 보기 →
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* 트레이너 코드 입력 모달 */}
      <Modal visible={showTrainerConnect} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
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
                marginBottom: 20,
              }}
            />
            <Text
              style={{
                fontSize: 20,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 6,
              }}
            >
              트레이너 연결
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textMuted,
                marginBottom: 20,
              }}
            >
              트레이너에게 받은 6자리 코드를 입력해주세요
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: Colors.textSub,
                marginBottom: 8,
              }}
            >
              트레이너 코드
            </Text>
            <TextInput
              value={trainerCode}
              onChangeText={(v) => setTrainerCode(v.toUpperCase())}
              placeholder="예: A1B2C3"
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="characters"
              maxLength={6}
              style={{
                backgroundColor: "#fff",
                borderWidth: 2,
                borderColor:
                  trainerCode.length === 6 ? Colors.green : Colors.border,
                borderRadius: 12,
                padding: 16,
                fontSize: 22,
                fontWeight: "800",
                color: Colors.text,
                textAlign: "center",
                letterSpacing: 6,
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowTrainerConnect(false);
                  setTrainerCode("");
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
                onPress={connectTrainer}
                disabled={connecting || trainerCode.length < 4}
                style={{
                  flex: 2,
                  backgroundColor:
                    trainerCode.length >= 4 ? Colors.green : Colors.border,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: trainerCode.length >= 4 ? "#fff" : Colors.textMuted,
                  }}
                >
                  {connecting ? "연결 중..." : "연결하기"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
