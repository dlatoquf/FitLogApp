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
import { Slot, SlotStatus } from "../../../types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const STATUS_COLOR: Record<SlotStatus, string> = {
  OPEN: Colors.border,
  REQUESTED: Colors.gold,
  CONFIRMED: Colors.green,
  MINE: Colors.blue,
};

const STATUS_LABEL: Record<SlotStatus, string> = {
  OPEN: "빈 슬롯",
  REQUESTED: "신청자 있음",
  CONFIRMED: "확정",
  MINE: "내 슬롯",
};

export default function TrainerScheduleScreen() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirming, setConfirming] = useState(false);

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
      setSlots([
        { id: 1, date: todayKey, startTime: "10:00:00", endTime: "11:00:00", status: "CONFIRMED", memberName: "김지수" },
        { id: 2, date: todayKey, startTime: "14:00:00", endTime: "15:00:00", status: "REQUESTED" },
        { id: 3, date: todayKey, startTime: "17:00:00", endTime: "18:00:00", status: "OPEN" },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRequests = async (slot: Slot) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/schedule/requests/${slot.id}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error("신청자 조회 실패");
      const data = await res.json();
      setSelectedSlot({ ...slot, requests: data });
      setModalVisible(true);
    } catch {
      // 더미 신청자
      setSelectedSlot({
        ...slot,
        requests: [
          { id: 1, member: { id: 1, user: { id: 1, name: "김지수" } } },
          { id: 2, member: { id: 2, user: { id: 2, name: "이준호" } } },
        ],
      });
      setModalVisible(true);
    }
  };

  const confirmMember = async (scheduleId: number, memberId: number) => {
    setConfirming(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/schedule/confirm/${scheduleId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error("확정 실패");
      setModalVisible(false);
      fetchCalendar();
      Alert.alert("완료", "수업이 확정됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setConfirming(false);
    }
  };

  const generateSlots = async () => {
    Alert.alert("다음 주 슬롯 생성", "다음 주 수업 슬롯을 생성할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "생성",
        onPress: async () => {
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/schedule/generate`, {
              method: "POST",
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error("슬롯 생성 실패");
            Alert.alert("완료", "다음 주 슬롯이 생성됐어요!");
            fetchCalendar();
          } catch (e: any) {
            Alert.alert("오류", e.message);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    fetchCalendar();
  }, [weekOffset]);

  // 날짜별 도트 색상
  const dotDates: { [key: string]: string[] } = {};
  slots.forEach((s) => {
    if (!dotDates[s.date]) dotDates[s.date] = [];
    if (s.status === "CONFIRMED" && !dotDates[s.date].includes(Colors.green)) {
      dotDates[s.date].push(Colors.green);
    }
    if (s.status === "REQUESTED" && !dotDates[s.date].includes(Colors.gold)) {
      dotDates[s.date].push(Colors.gold);
    }
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
        {/* 헤더 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>일정</Text>
          <TouchableOpacity
            onPress={generateSlots}
            style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+ 다음주 오픈</Text>
          </TouchableOpacity>
        </View>

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
          {(["OPEN", "REQUESTED", "CONFIRMED"] as SlotStatus[]).map((s) => (
            <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: STATUS_COLOR[s] }} />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{STATUS_LABEL[s]}</Text>
            </View>
          ))}
        </View>

        {/* 슬롯 목록 */}
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : daySlots.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>이날은 슬롯이 없어요</Text>
            <TouchableOpacity
              onPress={generateSlots}
              style={{ marginTop: 16, backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}
            >
              <Text style={{ fontSize: 13, color: Colors.green, fontWeight: "700" }}>슬롯 생성하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          daySlots.map((slot) => (
            <TouchableOpacity
              key={slot.id}
              onPress={() => slot.status === "REQUESTED" && fetchRequests(slot)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderRadius: 14,
                padding: 16,
                marginBottom: 10,
                backgroundColor: Colors.bgSub,
                borderLeftWidth: 4,
                borderLeftColor: STATUS_COLOR[slot.status],
                borderWidth: 1,
                borderColor: Colors.border,
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
                {slot.status === "OPEN" && <Text style={{ fontSize: 13, color: Colors.textPlaceholder }}>빈 슬롯</Text>}
                {slot.status === "REQUESTED" && (
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.gold }}>신청자 확인하기 →</Text>
                )}
                {slot.status === "CONFIRMED" && (
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>
                    {slot.memberName ? `${slot.memberName} · ` : ""}확정 완료
                  </Text>
                )}
              </View>
              <View style={{ backgroundColor: STATUS_COLOR[slot.status], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, color: slot.status === "OPEN" ? Colors.textMuted : "#fff", fontWeight: "700" }}>
                  {STATUS_LABEL[slot.status]}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 신청자 모달 */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
              {selectedSlot?.startTime?.slice(0, 5)} 신청자 목록
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 20 }}>
              확정할 회원을 선택하세요
            </Text>
            {selectedSlot?.requests?.map((req) => (
              <TouchableOpacity
                key={req.id}
                onPress={() => confirmMember(selectedSlot.id, req.member.id)}
                disabled={confirming}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{req.member.user.name[0]}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: Colors.text }}>
                  {req.member.user.name}
                </Text>
                <View style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                    {confirming ? "..." : "확정"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{ marginTop: 8, alignItems: "center", padding: 14 }}
            >
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
