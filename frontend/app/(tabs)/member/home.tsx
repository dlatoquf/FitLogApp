import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

interface ThisWeekSchedule {
  scheduleId: number; date: string; startTime: string; endTime: string;
}
interface NextWeekSlot {
  id: number; date: string; startTime: string; endTime: string;
  status: "OPEN" | "REQUESTED" | "MINE" | "FULL";
}
interface MemberHomeData {
  member: {
    id: number;
    name: string;
    trainerName?: string;
    ptExpDate?: string;
    goal?: string;
    weight?: number;
    muscleMass?: number;
  };
  ptRemaining: number;
  ptTotal: number;
  todayDietCalories: number;
  todayProtein: number;
  goalCalories: number;
  nextSchedule: string | null;
  dDay: number | null;
  unreadFeedbackCount: number;
}

interface Noti {
  notificationId: number;
  type: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const NOTI_ICON: Record<string, string> = {
  WORKOUT_LOG: "💪", SCHEDULE: "📅", FEEDBACK: "💬", PT_EXPIRY: "⏰", GENERAL: "🔔",
};

export default function MemberHomeScreen() {
  const params = useLocalSearchParams<{ openSchedule?: string }>();
  const didOpenScheduleFromNoti = useRef(false);
  const [data, setData]                         = useState<MemberHomeData | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [showSchedule, setShowSchedule]         = useState(false);
  const [showTrainerConnect, setShowTrainerConnect] = useState(false);
  const [trainerCode, setTrainerCode]           = useState("");
  const [connecting, setConnecting]             = useState(false);
  const [thisWeek, setThisWeek]                 = useState<ThisWeekSchedule[]>([]);
  const [nextWeekSlots, setNextWeekSlots]       = useState<NextWeekSlot[]>([]);
  const [slotsLoading, setSlotsLoading]         = useState(false);
  const [requesting, setRequesting]             = useState<number | null>(null);
  const [notifications, setNotifications]       = useState<Noti[]>([]);
  const didFetch = useRef(false);
  const [selectedDate, setSelectedDate]         = useState(() => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day));
    return d;
  });

  const weekDates = getWeekDates(1);
  const dateKey   = toDateKey(selectedDate);
  const daySlots  = nextWeekSlots.filter(s => s.date === dateKey);
  const myDates   = new Set(nextWeekSlots.filter(s => s.status === "MINE" || s.status === "REQUESTED").map(s => s.date));

  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };
      const [homeRes, weekRes, notiRes] = await Promise.all([
        fetch(`${API_URL}/api/member/home`, { headers }),
        fetch(`${API_URL}/api/member/schedule/this-week`, { headers }),
        fetch(`${API_URL}/api/notifications`, { headers }),
      ]);
      if (!homeRes.ok) throw new Error();
      setData(await homeRes.json());
      if (weekRes.ok) setThisWeek(await weekRes.json());
      if (notiRes.ok) setNotifications((await notiRes.json()).slice(0, 10));
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "데이터를 불러오지 못했어요.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  const fetchNextWeekSlots = async () => {
    setSlotsLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/schedule/next-week-slots`, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!res.ok) throw new Error();
      setNextWeekSlots(await res.json());
    } catch {
      const mk = toDateKey(weekDates[0]);
      const tk = toDateKey(weekDates[1]);
      setNextWeekSlots([
        { id: 1, date: mk, startTime: "09:00", endTime: "10:00", status: "MINE" },
        { id: 2, date: mk, startTime: "10:00", endTime: "11:00", status: "OPEN" },
        { id: 3, date: mk, startTime: "11:00", endTime: "12:00", status: "OPEN" },
        { id: 4, date: mk, startTime: "14:00", endTime: "15:00", status: "REQUESTED" },
        { id: 5, date: tk, startTime: "09:00", endTime: "10:00", status: "OPEN" },
        { id: 6, date: tk, startTime: "10:00", endTime: "11:00", status: "FULL" },
      ]);
    } finally { setSlotsLoading(false); }
  };

  const connectTrainer = async () => {
    if (!trainerCode.trim()) { Alert.alert("오류", "트레이너 코드를 입력해주세요."); return; }
    setConnecting(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/connect-trainer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ trainerCode: trainerCode.trim().toUpperCase() }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "연결 실패");
      setTrainerCode("");
      setShowTrainerConnect(false);
      await fetchHome();
      Alert.alert("연결 완료! 🎉", `${result.trainerName} 트레이너와 연결됐어요!`);
    } catch (e: any) { Alert.alert("오류", e.message); }
    finally { setConnecting(false); }
  };

  const requestSlot = async (slotId: number) => {
    Alert.alert("수업 신청", "이 시간에 수업을 신청할까요?\n중복 신청도 가능해요!", [
      { text: "취소", style: "cancel" },
      { text: "신청", onPress: async () => {
        setRequesting(slotId);
        try {
          const jwt = await AsyncStorage.getItem("jwt");
          const res = await fetch(`${API_URL}/api/schedule/request/${slotId}`, {
            method: "POST", headers: { Authorization: `Bearer ${jwt}` },
          });
          if (!res.ok) throw new Error("신청 실패");
          await fetchNextWeekSlots();
          Alert.alert("완료", "수업 신청이 완료됐어요!\n트레이너 확정 후 알림을 드릴게요.");
        } catch (e: any) { Alert.alert("오류", e.message); }
        finally { setRequesting(null); }
      }},
    ]);
  };

  useEffect(() => { if (didFetch.current) return;
    didFetch.current = true;
    fetchHome();
  }, []);

  // 알림에서 "다음 주 수업 오픈"을 눌러 들어온 경우,
  // 홈 화면의 다음 주 수업 신청 모달을 바로 열어준다.
  useEffect(() => {
    if (params.openSchedule !== "true") return;
    if (didOpenScheduleFromNoti.current) return;

    didOpenScheduleFromNoti.current = true;
    setShowSchedule(true);
    fetchNextWeekSlots();
  }, [params.openSchedule]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const ptPct   = data && data.ptTotal > 0 ? Math.min((data.ptRemaining / data.ptTotal) * 100, 100) : 0;
  const dietPct = data ? Math.min((data.todayDietCalories / data.goalCalories) * 100, 100) : 0;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHome(true)} tintColor={Colors.green} />}
      >
        {/* 인사 + 알림 버튼 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <View>
            <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}>안녕하세요 👋</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>{data?.member.name}님</Text>
            {data?.member.trainerName && (
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>담당: {data.member.trainerName} 트레이너</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/member/notifications")}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: notifications.filter(n => !n.isRead).length > 0 ? "#EFF6FF" : Colors.bgSub,
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1, borderColor: notifications.filter(n => !n.isRead).length > 0 ? Colors.blue + "44" : Colors.border,
              marginTop: 6,
            }}
          >
            <View style={{ width: 18, height: 18, justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: 12, height: 10, backgroundColor: notifications.filter(n => !n.isRead).length > 0 ? Colors.blue : Colors.textMuted, borderRadius: 6, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
              <View style={{ width: 14, height: 3, backgroundColor: notifications.filter(n => !n.isRead).length > 0 ? Colors.blue : Colors.textMuted, borderRadius: 1 }} />
              <View style={{ width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, borderColor: notifications.filter(n => !n.isRead).length > 0 ? Colors.blue : Colors.textMuted, marginTop: 1 }} />
            </View>
            {notifications.filter(n => !n.isRead).length > 0 ? (
              <View style={{ backgroundColor: Colors.blue, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{notifications.filter(n => !n.isRead).length}</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: "600" }}>알림</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 트레이너 미연결 시 연결 버튼 */}
        {!data?.member.trainerName && (
          <TouchableOpacity
            onPress={() => setShowTrainerConnect(true)}
            style={{ backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <View style={{ width: 40, height: 40, backgroundColor: Colors.green, borderRadius: 10, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 20 }}>🔑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.green }}>트레이너 연결하기</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>트레이너 코드를 입력해 연결해요</Text>
            </View>
            <Text style={{ fontSize: 16, color: Colors.green }}>›</Text>
          </TouchableOpacity>
        )}

        {/* PT 잔여 */}
        <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: Colors.textSub }}>PT 잔여 횟수</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.blue }}>{data?.ptRemaining ?? 0}</Text>
              <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 4 }}>/ {data?.ptTotal ?? 0}회</Text>
            </View>
          </View>
          <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 8 }}>
            <View style={{ width: `${ptPct}%` as any, height: 8, borderRadius: 99, backgroundColor: Colors.blue }} />
          </View>
          {data?.member.ptExpDate && (
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>만료일: {data.member.ptExpDate}</Text>
          )}
        </View>

        {/* 오늘 통계 */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/member/diet")}
            style={{ flex: 2, backgroundColor: Colors.bgSub, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border }}
          >
            <Text style={{ fontSize: 12, color: Colors.textSub, marginBottom: 4 }}>오늘 칼로리</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.gold }}>
              {data?.todayDietCalories.toLocaleString() ?? 0}
              <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: "400" }}> kcal</Text>
            </Text>
            <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 5, marginTop: 8 }}>
              <View style={{ width: `${dietPct}%` as any, height: 5, borderRadius: 99, backgroundColor: Colors.gold }} />
            </View>
            <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 4 }}>목표 {data?.goalCalories.toLocaleString()}kcal</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ fontSize: 11, color: Colors.textSub }}>체중</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.text }}> {data?.member?.weight ?? "-"}<Text style={{ fontSize: 11 }}>kg</Text></Text>
            </View>
            <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
              <Text style={{ fontSize: 11, color: Colors.textSub }}>단백질</Text>
              <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.green }}>{Math.round(data?.todayProtein ?? 0)}<Text style={{ fontSize: 11 }}>g</Text></Text>           
              </View>
          </View>
        </View>

        {/* 이번 주 내 수업 */}
        <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>📅 이번 주 내 수업</Text>
            <TouchableOpacity onPress={() => {
              if (!data?.member.trainerName) {
                Alert.alert("트레이너 연결 필요", "수업 신청을 하려면 먼저 트레이너를 연결해야 해요!", [
                  { text: "취소", style: "cancel" },
                  { text: "연결하기", onPress: () => setShowTrainerConnect(true) },
                ]);
                return;
              }
              setShowSchedule(true);
              fetchNextWeekSlots();
            }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>다음 주 신청 →</Text>
            </TouchableOpacity>
          </View>
          {thisWeek.length === 0 ? (
            <Text style={{ fontSize: 13, color: Colors.textMuted, textAlign: "center", paddingVertical: 8 }}>
              이번 주 확정된 수업이 없어요
            </Text>
          ) : (
            thisWeek.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.blueBg, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.blue + "44" }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.blue, marginRight: 10 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text, flex: 1 }}>{s.date}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.blue }}>{s.startTime}</Text>
              </View>
            ))
          )}
        </View>

        {/* 피드백 배너 */}
        {(data?.unreadFeedbackCount ?? 0) > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/member/diet")}
            style={{ backgroundColor: Colors.blueBg, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.blue + "44", flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}
          >
            <View style={{ backgroundColor: Colors.red, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>{data?.unreadFeedbackCount}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.blue }}>트레이너 피드백이 도착했어요!</Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>탭하여 확인하기</Text>
            </View>
            <Text style={{ fontSize: 16, color: Colors.blue }}>›</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* 트레이너 코드 입력 모달 */}
      <Modal visible={showTrainerConnect} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 6 }}>트레이너 연결</Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 20 }}>트레이너에게 받은 6자리 코드를 입력해주세요</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textSub, marginBottom: 8 }}>트레이너 코드</Text>
            <TextInput
              value={trainerCode}
              onChangeText={v => setTrainerCode(v.toUpperCase())}
              placeholder="예: A1B2C3"
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="characters"
              maxLength={6}
              style={{
                backgroundColor: Colors.bgSub, borderWidth: 2,
                borderColor: trainerCode.length === 6 ? Colors.green : Colors.border,
                borderRadius: 12, padding: 16, fontSize: 22, fontWeight: "800",
                color: Colors.text, textAlign: "center", letterSpacing: 6, marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowTrainerConnect(false); setTrainerCode(""); }}
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={connectTrainer}
                disabled={connecting || trainerCode.length < 4}
                style={{ flex: 2, backgroundColor: trainerCode.length >= 4 ? Colors.green : Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: trainerCode.length >= 4 ? "#fff" : Colors.textMuted }}>
                  {connecting ? "연결 중..." : "연결하기"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 다음 주 수업 신청 모달 */}
      <Modal visible={showSchedule} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, height: "75%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>다음 주 수업 신청</Text>
              <TouchableOpacity onPress={() => setShowSchedule(false)}>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>닫기</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 4 }}>
              {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
            </Text>
            <View style={{ backgroundColor: Colors.greenLight, borderRadius: 8, padding: 8, marginBottom: 14 }}>
              <Text style={{ fontSize: 12, color: Colors.green }}>💡 여러 시간대에 중복 신청 가능해요. 트레이너가 한 곳을 확정해드려요!</Text>
            </View>

            {/* 요일 선택 */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              {weekDates.map((date, i) => {
                const key        = toDateKey(date);
                const isSelected = dateKey === key;
                const isMine     = myDates.has(key);
                return (
                  <TouchableOpacity key={i} onPress={() => setSelectedDate(date)} style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}>{DAYS[i]}</Text>
                    <View style={{
                      width: 34, height: 34, borderRadius: 10,
                      backgroundColor: isSelected ? Colors.green : "transparent",
                      borderWidth: isMine && !isSelected ? 2 : 0, borderColor: Colors.blue,
                      justifyContent: "center", alignItems: "center",
                    }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? "#fff" : Colors.text }}>{date.getDate()}</Text>
                    </View>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isMine ? Colors.blue : "transparent" }} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 슬롯 목록 */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {slotsLoading ? (
                <ActivityIndicator color={Colors.green} style={{ marginTop: 20 }} />
              ) : daySlots.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>이날은 수업이 없어요</Text>
                </View>
              ) : (
                daySlots.map(slot => {
                  const isMine      = slot.status === "MINE";
                  const isRequested = slot.status === "REQUESTED";
                  const isFull      = slot.status === "FULL";
                  const isOpen      = slot.status === "OPEN";
                  return (
                    <View key={slot.id} style={{
                      flexDirection: "row", alignItems: "center",
                      backgroundColor: isMine ? Colors.blueBg : isRequested ? Colors.goldBg : Colors.bgSub,
                      borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1,
                      borderColor: isMine ? Colors.blue + "44" : isRequested ? Colors.gold + "44" : Colors.border,
                      opacity: isFull ? 0.4 : 1,
                    }}>
                      <View style={{ width: 55 }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>{slot.startTime}</Text>
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>~{slot.endTime}</Text>
                      </View>
                      <View style={{ width: 1, height: 32, backgroundColor: Colors.border, marginHorizontal: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: isMine ? Colors.blue : isRequested ? Colors.gold : isFull ? Colors.textMuted : Colors.green }}>
                          {isMine ? "내 수업 확정됨 ✓" : isRequested ? "신청 완료 (대기 중)" : isFull ? "마감" : "신청 가능"}
                        </Text>
                      </View>
                      {isOpen && (
                        <TouchableOpacity
                          onPress={() => requestSlot(slot.id)}
                          disabled={requesting === slot.id}
                          style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
                        >
                          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                            {requesting === slot.id ? "..." : "신청"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}