import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";
import { getWeekDates, toDateKey } from "../../../hooks/useApi";
import { Slot } from "../../../types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const STATUS_CONFIG = {
  OPEN:      { label: "신청 가능", color: Colors.green,  bg: Colors.greenLight, borderColor: Colors.green + "44" },
  REQUESTED: { label: "신청 완료", color: Colors.gold,   bg: Colors.goldBg,     borderColor: Colors.gold + "44" },
  CONFIRMED: { label: "확정됨",   color: Colors.blue,   bg: Colors.blueBg,     borderColor: Colors.blue + "44" },
  MINE:      { label: "내 수업",  color: Colors.blue,   bg: Colors.blueBg,     borderColor: Colors.blue + "44" },
};

export default function MemberScheduleScreen() {
  // 다음 주 고정 (이번 주 신청 불가)
  const [weekOffset, setWeekOffset] = useState(1); // 1 = 다음 주
  const [selectedDate, setSelectedDate] = useState(() => {
    // 기본 선택: 다음 주 월요일
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    return d;
  });
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState<number | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const dateKey   = toDateKey(selectedDate);
  const daySlots  = slots.filter(s => s.date === dateKey);

  // 내가 신청/확정된 날짜 집합
  const myDates = new Set(
    slots.filter(s => s.status === "MINE" || s.status === "REQUESTED").map(s => s.date)
  );

  const fetchCalendar = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const weekStart = toDateKey(weekDates[0]);
      const res = await fetch(`${API_URL}/api/schedule/calendar?weekStart=${weekStart}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error("일정 조회 실패");
      const data: Slot[] = await res.json();
      setSlots(data);
    } catch {
      // 더미
      const nextMonday = new Date();
      const day = nextMonday.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      nextMonday.setDate(nextMonday.getDate() + diff);
      const mk = toDateKey(nextMonday);
      const tue = new Date(nextMonday); tue.setDate(tue.getDate() + 1);
      const tk = toDateKey(tue);
      setSlots([
        { id: 1, date: mk, startTime: "10:00:00", endTime: "11:00:00", status: "MINE" },
        { id: 2, date: mk, startTime: "14:00:00", endTime: "15:00:00", status: "OPEN" },
        { id: 3, date: mk, startTime: "17:00:00", endTime: "18:00:00", status: "OPEN" },
        { id: 4, date: tk, startTime: "09:00:00", endTime: "10:00:00", status: "OPEN" },
        { id: 5, date: tk, startTime: "11:00:00", endTime: "12:00:00", status: "REQUESTED" },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const requestSlot = async (slotId: number) => {
    Alert.alert("수업 신청", "이 시간에 수업을 신청할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "신청",
        onPress: async () => {
          setRequesting(slotId);
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/schedule/request/${slotId}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error("신청 실패");
            fetchCalendar();
            Alert.alert("완료", "수업 신청이 완료됐어요! 트레이너 확정 후 알림을 드릴게요.");
          } catch (e: any) {
            Alert.alert("오류", e.message);
          } finally {
            setRequesting(null);
          }
        },
      },
    ]);
  };

  useEffect(() => { fetchCalendar(); }, [weekOffset]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCalendar(true)} tintColor={Colors.green} />}
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>수업 신청</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 16 }}>다음 주 수업을 신청해요</Text>

        {/* 주간 이동 - 다음 주만 */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => { setWeekOffset(w => Math.max(w - 1, 1)); }}
            style={{ padding: 8, opacity: weekOffset <= 1 ? 0.3 : 1 }}
            disabled={weekOffset <= 1}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub }}>
            {weekOffset === 1 ? "다음 주" : `+${weekOffset}주`}{"  "}
            {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekOffset(w => Math.min(w + 1, 2))}
            style={{ padding: 8, opacity: weekOffset >= 2 ? 0.3 : 1 }}
            disabled={weekOffset >= 2}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 요일 캘린더 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
          {weekDates.map((date, i) => {
            const key        = toDateKey(date);
            const isSelected = toDateKey(selectedDate) === key;
            const isMine     = myDates.has(key);
            return (
              <TouchableOpacity key={i} onPress={() => setSelectedDate(date)} style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}>{DAYS[i]}</Text>
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: isSelected ? Colors.green : "transparent",
                  borderWidth: isMine && !isSelected ? 2 : 0,
                  borderColor: Colors.blue,
                  justifyContent: "center", alignItems: "center",
                }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: isSelected ? "#fff" : Colors.text }}>
                    {date.getDate()}
                  </Text>
                </View>
                {/* 내가 신청/확정한 날 파란 도트 */}
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isMine ? Colors.blue : "transparent" }} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 범례 */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {(["OPEN", "REQUESTED", "MINE"] as const).map(s => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: STATUS_CONFIG[s].color }} />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{STATUS_CONFIG[s].label}</Text>
            </View>
          ))}
        </View>

        {/* 슬롯 목록 */}
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : daySlots.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>이날은 신청 가능한 수업이 없어요</Text>
          </View>
        ) : (
          daySlots.map(slot => {
            const config = STATUS_CONFIG[slot.status];
            const isOpen = slot.status === "OPEN";
            return (
              <View key={slot.id} style={{
                flexDirection: "row", alignItems: "center",
                borderRadius: 14, padding: 16, marginBottom: 10,
                backgroundColor: config.bg, borderWidth: 1, borderColor: config.borderColor,
              }}>
                <View style={{ width: 60 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>
                    {slot.startTime.slice(0, 5)}
                  </Text>
                  <Text style={{ fontSize: 10, color: Colors.textMuted }}>~{slot.endTime.slice(0, 5)}</Text>
                </View>
                <View style={{ width: 1, height: 36, backgroundColor: Colors.border, marginHorizontal: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: config.color }}>{config.label}</Text>
                  {slot.status === "MINE" && (
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>내 수업 확정됨 ✓</Text>
                  )}
                  {slot.status === "REQUESTED" && (
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>트레이너 확정 대기 중</Text>
                  )}
                </View>
                {isOpen && (
                  <TouchableOpacity
                    onPress={() => requestSlot(slot.id)}
                    disabled={requesting === slot.id}
                    style={{ backgroundColor: Colors.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                      {requesting === slot.id ? "..." : "신청"}
                    </Text>
                  </TouchableOpacity>
                )}
                {slot.status === "REQUESTED" && (
                  <TouchableOpacity
                    onPress={() => {
                      Alert.alert("신청 취소", "수업 신청을 취소할까요?", [
                        { text: "아니요", style: "cancel" },
                        { text: "취소", style: "destructive", onPress: async () => {
                          setRequesting(slot.id);
                          try {
                            const jwt = await AsyncStorage.getItem("jwt");
                            const res = await fetch(`${API_URL}/api/schedule/request/${slot.id}`, {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${jwt}` },
                            });
                            if (!res.ok) throw new Error("취소 실패");
                            fetchCalendar();
                            Alert.alert("완료", "신청이 취소됐어요.");
                          } catch (e: any) { Alert.alert("오류", e.message); }
                          finally { setRequesting(null); }
                        }},
                      ]);
                    }}
                    disabled={requesting === slot.id}
                    style={{ backgroundColor: Colors.redBg, borderWidth: 1, borderColor: Colors.red + "44", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: Colors.red, fontSize: 13, fontWeight: "700" }}>
                      {requesting === slot.id ? "..." : "취소"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}