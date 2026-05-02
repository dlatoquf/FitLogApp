import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  OPEN: { label: "신청 가능", color: Colors.green, bg: Colors.greenLight, borderColor: Colors.green + "44" },
  REQUESTED: { label: "신청 완료", color: Colors.gold, bg: Colors.goldBg, borderColor: Colors.gold + "44" },
  CONFIRMED: { label: "확정됨", color: Colors.blue, bg: Colors.blueBg, borderColor: Colors.blue + "44" },
  MINE: { label: "내 수업", color: Colors.blue, bg: Colors.blueBg, borderColor: Colors.blue + "44" },
};

export default function MemberScheduleScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState<number | null>(null);

  const weekDates = getWeekDates(weekOffset);
  const dateKey = toDateKey(selectedDate);
  const daySlots = slots.filter((s) => s.date === dateKey);

  const fetchCalendar = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const weekStart = toDateKey(weekDates[0]);
      const res = await fetch(
        `${API_URL}/api/schedule/calendar?weekStart=${weekStart}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (!res.ok) throw new Error("일정 조회 실패");
      const data: Slot[] = await res.json();
      setSlots(data);
    } catch {
      // 더미 데이터
      const today = new Date();
      const todayKey = toDateKey(today);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowKey = toDateKey(tomorrow);

      setSlots([
        { id: 1, date: todayKey, startTime: "10:00:00", endTime: "11:00:00", status: "MINE" },
        { id: 2, date: todayKey, startTime: "14:00:00", endTime: "15:00:00", status: "OPEN" },
        { id: 3, date: todayKey, startTime: "17:00:00", endTime: "18:00:00", status: "OPEN" },
        { id: 4, date: tomorrowKey, startTime: "09:00:00", endTime: "10:00:00", status: "OPEN" },
        { id: 5, date: tomorrowKey, startTime: "11:00:00", endTime: "12:00:00", status: "REQUESTED" },
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

  useEffect(() => {
    fetchCalendar();
  }, [weekOffset]);

  // 날짜별 도트
  const dotDates: { [key: string]: string[] } = {};
  slots.forEach((s) => {
    if (!dotDates[s.date]) dotDates[s.date] = [];
    if (s.status === "MINE" && !dotDates[s.date].includes(Colors.blue)) dotDates[s.date].push(Colors.blue);
    else if (s.status === "OPEN" && !dotDates[s.date].includes(Colors.green)) dotDates[s.date].push(Colors.green);
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchCalendar(true)}
            tintColor={Colors.green}
          />
        }
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>수업 일정</Text>

        {/* 주간 이동 */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => Math.max(w - 1, 0))}
            style={{ padding: 8, opacity: weekOffset === 0 ? 0.3 : 1 }}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub }}>
            {weekOffset === 0 ? "이번 주" : `+${weekOffset}주`}{"  "}
            {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => Math.min(w + 1, 4))}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 요일 캘린더 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
          {weekDates.map((date, i) => {
            const key = toDateKey(date);
            const isSelected = toDateKey(selectedDate) === key;
            const isToday = toDateKey(new Date()) === key;
            const dots = dotDates[key] || [];
            return (
              <TouchableOpacity
                key={i}
                onPress={() => setSelectedDate(date)}
                style={{ alignItems: "center", gap: 4 }}
              >
                <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}>{DAYS[i]}</Text>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: isSelected ? Colors.green : isToday ? Colors.greenLight : "transparent",
                    borderWidth: isToday && !isSelected ? 1.5 : 0,
                    borderColor: Colors.green,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: isSelected ? "#fff" : isToday ? Colors.green : Colors.text }}>
                    {date.getDate()}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 2 }}>
                  {dots.map((dotColor, di) => (
                    <View key={di} style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: dotColor }} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 범례 */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {(["OPEN", "REQUESTED", "CONFIRMED", "MINE"] as const).map((s) => (
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
          daySlots.map((slot) => {
            const config = STATUS_CONFIG[slot.status];
            const isOpen = slot.status === "OPEN";
            return (
              <View
                key={slot.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  backgroundColor: config.bg,
                  borderWidth: 1,
                  borderColor: config.borderColor,
                }}
              >
                <View style={{ width: 60 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>
                    {slot.startTime.slice(0, 5)}
                  </Text>
                  <Text style={{ fontSize: 10, color: Colors.textMuted }}>~{slot.endTime.slice(0, 5)}</Text>
                </View>
                <View style={{ width: 1, height: 36, backgroundColor: Colors.border, marginHorizontal: 14 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: config.color }}>
                    {config.label}
                  </Text>
                  {slot.status === "MINE" && (
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>내 수업 확정됨</Text>
                  )}
                </View>
                {isOpen && (
                  <TouchableOpacity
                    onPress={() => requestSlot(slot.id)}
                    disabled={requesting === slot.id}
                    style={{
                      backgroundColor: Colors.green,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
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
  );
}
