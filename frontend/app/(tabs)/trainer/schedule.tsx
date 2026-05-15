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

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

type DayTime = {
  day: string;
  start: string;
  end: string;
  enabled: boolean;
  useDefault: boolean;
  defaultStart: string;
  defaultEnd: string;
};

// 30분 단위 시간 옵션 (05:00 ~ 24:00)
// 주의: 백엔드 LocalTime.parse는 24:00을 바로 처리하지 못할 수 있어 아래 검증에서 막아둠
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 24) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}


export default function TrainerScheduleScreen() {
  const [tab, setTab]               = useState<"THIS" | "NEXT">("THIS");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots]           = useState<any[]>([]);
  const [members, setMembers]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [trainerProfile, setTrainerProfile] = useState<any>(null);

  // 다음 주 오픈 모달
  const [openModal, setOpenModal] = useState(false);
  const [dayTimes, setDayTimes] = useState<DayTime[]>([]);

  // 신청자 확정 모달
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [requestModal, setRequestModal] = useState(false);
  const [confirming, setConfirming]     = useState(false);

  // 회원 추가 모달 (이번 주 빈 슬롯)
  const [addModal, setAddModal]         = useState(false);
  const [addingSlot, setAddingSlot]     = useState<any | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  const thisWeekDates = getWeekDates(0);
  const nextWeekDates = getWeekDates(1);
  const weekDates     = tab === "THIS" ? thisWeekDates : nextWeekDates;
  const dateKey       = toDateKey(selectedDate);

  // 이번 주/다음 주 모두: DB 슬롯 전체 + 없는 시간은 가상 슬롯으로 채우기
  const daySlots = slots
    .filter(s => s.date === dateKey)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 트레이너 근무시간 기반 가상 슬롯 생성 (DB에 없는 시간만 채우기)
  const generateVirtualSlots = () => {
    if (!trainerProfile) return [];
  
    const startH = parseInt(trainerProfile.startTime?.split(":")[0] ?? "9");
    const endH = parseInt(trainerProfile.endTime?.split(":")[0] ?? "18");
  
    const existingTimes = new Set(
      daySlots.map((s) => s.startTime.slice(0, 5))
    );
  
    const result = [];
  
    for (let h = startH; h < endH; h++) {
      const time = `${String(h).padStart(2, "0")}:00`;
  
      if (existingTimes.has(time)) continue;
  
      result.push({
        id: null,
        date: dateKey,
        startTime: `${time}:00`,
        endTime: `${String(h + 1).padStart(2, "0")}:00:00`,
        status: "VIRTUAL",
      });
    }
  
    return result;
  };

  const fetchCalendar = async (isRefresh = false, forTab?: "THIS" | "NEXT") => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };
      const currentTab = forTab ?? tab;
      const dates = currentTab === "THIS" ? thisWeekDates : nextWeekDates;
      const weekStart = toDateKey(dates[0]);
      const [calRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/api/schedule/calendar?weekStart=${weekStart}`, { headers }),
        !trainerProfile ? fetch(`${API_URL}/api/profile/trainer`, { headers }) : Promise.resolve(null),
      ]);
      if (!calRes.ok) throw new Error();
      setSlots(await calRes.json());
      if (profileRes?.ok) setTrainerProfile(await profileRes.json());
    } catch (e: any) {
      console.error("fetchCalendar error:", e);
      Alert.alert("오류", "일정을 불러오지 못했어요.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  const fetchMembers = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/members`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error();
      setMembers(await res.json());
    } catch (e: any) {
      console.error("fetchMembers error:", e);
      Alert.alert("오류", "회원 목록을 불러오지 못했어요.");
    }
  };

  const getScheduleId = (slot: any) => {
    return slot?.id ?? slot?.scheduleId ?? slot?.schedule_id;
  };

  const fetchRequests = async (slot: any) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const slotId = getScheduleId(slot);

      if (!slotId) {
        console.log("slot id 없음:", slot);
        Alert.alert("오류", "슬롯 ID가 없어요. 백엔드 응답을 확인해주세요.");
        return;
      }

      const res = await fetch(`${API_URL}/api/schedule/requests/${slotId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("fetchRequests server error:", res.status, errText);
        throw new Error(`서버 오류 ${res.status}: ${errText}`);
      }

      setSelectedSlot({
        ...slot,
        id: slotId,
        requests: await res.json(),
      });

      setRequestModal(true);
    } catch (e: any) {
      console.error("fetchRequests error:", e);
      Alert.alert("오류", e.message || "신청자 목록을 불러오지 못했어요.");
    }
  };

  const confirmMember = async (scheduleId: number, memberId: number, memberName: string) => {
    Alert.alert("확정", `${memberName}님으로 확정할까요?\n나머지 신청자는 자동 거절돼요.`, [
      { text: "취소", style: "cancel" },
      { text: "확정", onPress: async () => {
        setConfirming(true);
        try {
          const jwt = await AsyncStorage.getItem("jwt");
          const res = await fetch(`${API_URL}/api/schedule/confirm/${scheduleId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ memberId }),
          });
          if (!res.ok) throw new Error("확정 실패");

          // 전체 캘린더 재조회 없이 해당 슬롯만 상태 변경
          setSlots(prev =>
            prev.map(s =>
              s.id === scheduleId
                ? {
                    ...s,
                    status: "CONFIRMED",
                    memberName,
                    requestorNames: [],
                  }
                : s
            )
          );

          setRequestModal(false);
          setSelectedSlot(null);
          Alert.alert("완료 ✓", `${memberName}님 수업이 확정됐어요!\n회원에게 알림이 전송됩니다.`);
        } catch (e: any) { Alert.alert("오류", e.message); }
        finally { setConfirming(false); }
      }},
    ]);
  };

  const addMemberToSlot = async (memberId: number, memberName: string) => {
    if (!addingSlot) return;
    setAddingMember(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` };

      if (addingSlot.status === "VIRTUAL" || addingSlot.status === "OPEN") {
        // 가상 슬롯 + OPEN 슬롯: create-and-confirm으로 처리
        const res = await fetch(`${API_URL}/api/schedule/create-and-confirm`, {
          method: "POST", headers,
          body: JSON.stringify({
            date: addingSlot.date,
            startTime: addingSlot.startTime.slice(0, 5),
            memberId,
          }),
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "추가 실패");
        }
      } else {
        // REQUESTED 슬롯: 신청자 있으므로 confirm API 사용
        const res = await fetch(`${API_URL}/api/schedule/confirm/${addingSlot.id}`, {
          method: "POST", headers,
          body: JSON.stringify({ memberId }),
        });
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "추가 실패");
        }
      }

      setAddModal(false);
      fetchCalendar(false, tab);
      Alert.alert("완료 ✓", `${memberName}님 수업이 추가됐어요!`);
    } catch (e: any) { Alert.alert("오류", e.message); }
    finally { setAddingMember(false); }
  };

  const buildDefaultDayTimesFromProfile = (targetProfile: any): DayTime[] => {
    const workDayList = (targetProfile?.workDays || "월,화,수,목,금")
      .split(",")
      .map((d: string) => d.trim());

    const startTime = (targetProfile?.startTime || "09:00").slice(0, 5);
    const endTime = (targetProfile?.endTime || "18:00").slice(0, 5);

    return DAYS.map(day => ({
      day,
      start: startTime,
      end: endTime,
      enabled: workDayList.includes(day),
      useDefault: true,
      defaultStart: startTime,
      defaultEnd: endTime,
    }));
  };

  const buildDefaultDayTimes = (): DayTime[] => {
    return buildDefaultDayTimesFromProfile(trainerProfile);
  };

  const openNextWeek = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };

      const nextWeekStart = toDateKey(nextWeekDates[0]);

      const [profileRes, nextWeekRes] = await Promise.all([
        fetch(`${API_URL}/api/profile/trainer`, { headers }),
        fetch(`${API_URL}/api/schedule/calendar?weekStart=${nextWeekStart}`, { headers }),
      ]);

      let latestProfile = trainerProfile;

      if (profileRes.ok) {
        latestProfile = await profileRes.json();
        setTrainerProfile(latestProfile);
      }

      if (nextWeekRes.ok) {
        const nextWeekSlots = await nextWeekRes.json();

        if (Array.isArray(nextWeekSlots) && nextWeekSlots.length > 0) {
          Alert.alert(
            "이미 오픈됐어요",
            "다음 주 일정은 이미 오픈되어 있어요.\n일정 탭에서 다음 주를 선택해서 확인해주세요.",
            [
              {
                text: "다음 주 보기",
                onPress: () => {
                  setTab("NEXT");
                  setSelectedDate(nextWeekDates[0]);
                  setSlots(nextWeekSlots);
                },
              },
              { text: "확인" },
            ],
          );
          return;
        }
      }

      setDayTimes(buildDefaultDayTimesFromProfile(latestProfile));
      setOpenModal(true);
    } catch (e) {
      console.log("openNextWeek error:", e);
      setDayTimes(buildDefaultDayTimes());
      setOpenModal(true);
    }
  };

  const validateDayTimes = (targetDayTimes: DayTime[]) => {
    for (const d of targetDayTimes.filter(item => item.enabled)) {
      if (d.start === "24:00" || d.end === "24:00") {
        Alert.alert("시간 확인", "24:00은 백엔드에서 오류가 날 수 있어요. 우선 23:30 이하로 선택해주세요.");
        return false;
      }

      const [startH, startM] = d.start.split(":").map(Number);
      const [endH, endM] = d.end.split(":").map(Number);
      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;

      if (endTotal <= startTotal) {
        Alert.alert("시간 확인", `${d.day}요일 끝나는 시간이 시작 시간보다 늦어야 해요.`);
        return false;
      }

      if (endTotal - startTotal < 60) {
        Alert.alert("시간 확인", `${d.day}요일은 최소 1시간 이상이어야 해요.`);
        return false;
      }
    }

    return true;
  };


  const openNextWeekByDayTimes = async (targetDayTimes: DayTime[]) => {
    const normalizedDayTimes = targetDayTimes.map(d => ({
      ...d,
      start: d.useDefault ? d.defaultStart : d.start,
      end: d.useDefault ? d.defaultEnd : d.end,
    }));

    const enabledDays = normalizedDayTimes.filter(d => d.enabled);

    if (enabledDays.length === 0) {
      Alert.alert("알림", "최소 하나의 요일을 선택해주세요.");
      return;
    }

    if (!validateDayTimes(normalizedDayTimes)) return;

    setOpenModal(false);
    setGenerating(true);

    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/schedule/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ dayTimes: enabledDays }),
      });

      if (!res.ok) {
        const message = await res.text();
        if (message.includes("이미 다음 주 일정이 오픈되어 있습니다")) {
          throw new Error("이미 다음 주 일정이 오픈되어 있어요.");
        }
        throw new Error(message || "생성 실패");
      }

      Alert.alert("완료", "다음 주 일정이 오픈됐어요!\n회원들에게 알림이 전송됐어요.");
      setTab("NEXT");
      setSelectedDate(nextWeekDates[0]);
      fetchCalendar(false, "NEXT");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setGenerating(false);
    }
  };

  const confirmOpenNextWeek = async () => {
    await openNextWeekByDayTimes(dayTimes);
  };

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    fetchCalendar(false, "THIS");
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    fetchCalendar(false, tab);
  }, [tab]);

  // 회원 목록은 모달 열 때 lazy 로딩 (아직 없을 때만)

  // 날짜 변경 시 해당 주로 리셋
  const handleTabChange = (t: "THIS" | "NEXT") => {
    setTab(t);
    setSelectedDate(t === "THIS" ? new Date() : nextWeekDates[0]);
  };

  // 도트
  const dotDates: { [key: string]: string[] } = {};
  slots.forEach(s => {
    if (!dotDates[s.date]) dotDates[s.date] = [];
    if (s.status === "CONFIRMED" && !dotDates[s.date].includes(Colors.green)) dotDates[s.date].push(Colors.green);
    if (s.status === "REQUESTED" && !dotDates[s.date].includes("#F59E0B")) dotDates[s.date].push(Colors.gold);
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCalendar(true)} tintColor={Colors.green} />}
      >
        {/* 헤더 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>일정</Text>
          <TouchableOpacity
            onPress={openNextWeek}
            disabled={generating}
            style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, opacity: generating ? 0.6 : 1 }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              {generating ? "처리 중..." : "다음 주 오픈"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 이번 주 / 다음 주 탭 */}
        <View style={{ flexDirection: "row", backgroundColor: Colors.bgSub, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
          {(["THIS", "NEXT"] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => handleTabChange(t)}
              style={{ flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center", backgroundColor: tab === t ? Colors.green : "transparent" }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: tab === t ? "#fff" : Colors.textMuted }}>
                {t === "THIS" ? "이번 주" : "다음 주"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 날짜 범위 */}
        <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 12, textAlign: "center" }}>
          {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} ~ {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
        </Text>

        {/* 요일 캘린더 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          {weekDates.map((date, i) => {
            const key        = toDateKey(date);
            const isSelected = dateKey === key;
            const isToday    = toDateKey(new Date()) === key;
            const dots       = dotDates[key] || [];
            return (
              <TouchableOpacity key={i} onPress={() => setSelectedDate(date)} style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}>{DAYS[i]}</Text>
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: isSelected ? Colors.green : isToday ? Colors.greenLight : "transparent",
                  borderWidth: isToday && !isSelected ? 1.5 : 0, borderColor: Colors.green,
                  justifyContent: "center", alignItems: "center",
                }}>
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
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green }} />
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>확정</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" }} />
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>대기 중</Text>
          </View>
        </View>

        {/* 날짜 헤더 */}
        <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 12 }}>
          {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 스케줄
        </Text>

        {/* 슬롯 목록 */}
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : (
          (() => {
            // 이번 주는 가상 슬롯까지 표시, 다음 주는 DB에 실제 오픈된 슬롯만 표시
            const displaySlots = [
              ...daySlots,
              ...(tab === "THIS" ? generateVirtualSlots() : []),
            ].sort((a, b) => a.startTime.localeCompare(b.startTime));

            if (displaySlots.length === 0) return (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>이날 슬롯이 없어요</Text>
              </View>
            );

            return displaySlots.map((slot, idx) => {
              const isConfirmed = slot.status === "CONFIRMED" || slot.status === "COMPLETED";
              const isRequested = slot.status === "REQUESTED";
              const isOpen      = slot.status === "OPEN";
              const isVirtual   = slot.status === "VIRTUAL";
              return (
                <TouchableOpacity
                  key={slot.id ?? `${slot.date}-${slot.startTime}-${idx}`}
                  onPress={() => isRequested && fetchRequests(slot)}
                  activeOpacity={isRequested ? 0.7 : 1}
                  style={{
                    flexDirection: "row", alignItems: "center",
                    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 6,
                    backgroundColor: isConfirmed ? Colors.greenLight : isRequested ? Colors.goldBg ?? "#FFFBEB" : "#fff",
                    borderWidth: 1,
                    borderColor: isConfirmed ? Colors.green + "44" : isRequested ? "#F59E0B44" : Colors.border,
                  }}
                >
                  {/* 시간 */}
                  <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.text, width: 50 }}>
                    {slot.startTime.slice(0, 5)}
                  </Text>

                  {/* 구분선 */}
                  <View style={{ width: 1, height: 28, backgroundColor: Colors.border, marginHorizontal: 12 }} />

                  {/* 내용 */}
                  <View style={{ flex: 1 }}>
                    {isConfirmed && (
                      <View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "800",
                            color: Colors.text,
                          }}
                        >
                          {slot.memberName}
                        </Text>
                        {slot.status === "COMPLETED" && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 2,
                              fontWeight: "700",
                            }}
                          >
                            수업 완료
                          </Text>
                        )}
                      </View>
                    )}
                    {isRequested && (
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 2 }}>
                          {(slot.requestorNames ?? []).map((name: string, ni: number) => (
                            <View key={ni} style={{ backgroundColor: "#FEF3C7", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#F59E0B44" }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>{name}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#F59E0B" }}>
                          탭하여 확정하기 →
                        </Text>
                      </View>
                    )}
                    {(isOpen || isVirtual) && (
                      <Text style={{ fontSize: 12, color: Colors.textMuted, opacity: 0.7 }}>
                        {tab === "NEXT" ? "신청자 없음" : "비어있음"}
                      </Text>
                    )}
                  </View>

                  {/* 확정된 수업 취소 버튼 */}
                    {slot.status === "CONFIRMED" && slot.id && (
                      <TouchableOpacity
                      onPress={() => {
                        Alert.alert("수업 취소", `${slot.memberName}님 수업을 취소할까요?`, [
                          { text: "아니요", style: "cancel" },
                          { text: "취소", style: "destructive", onPress: async () => {
                            try {
                              const jwt = await AsyncStorage.getItem("jwt");
                              const res = await fetch(`${API_URL}/api/schedule/confirm/${slot.id}`, {
                                method: "DELETE",
                                headers: { Authorization: `Bearer ${jwt}` },
                              });
                              if (!res.ok) throw new Error("취소 실패");

                              // 전체 캘린더 재조회 없이 해당 슬롯만 상태 변경
                              setSlots(prev =>
                                prev.map(s =>
                                  s.id === slot.id
                                    ? {
                                        ...s,
                                        status: "OPEN",
                                        memberName: null,
                                      }
                                    : s
                                )
                              );

                              Alert.alert("완료", "수업이 취소됐어요.");
                            } catch (e: any) { Alert.alert("오류", e.message); }
                          }},
                        ]);
                      }}
                      style={{ backgroundColor: Colors.redBg, borderWidth: 1, borderColor: Colors.red + "44", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    >
                      <Text style={{ fontSize: 12, color: Colors.red, fontWeight: "700" }}>취소</Text>
                    </TouchableOpacity>
                  )}

                  {/* 추가 버튼 (이번 주 빈/가상 슬롯) */}
                  {(isOpen || isVirtual) && tab === "THIS" && (
                    <TouchableOpacity
                      onPress={async () => {
                        if (members.length === 0) await fetchMembers();
                        setAddingSlot(slot);
                        setAddModal(true);
                      }}
                      style={{ backgroundColor: Colors.green, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                    >
                      <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>+ 추가</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            });
          })()
        )}
      </ScrollView>

      {/* 신청자 확정 모달 */}
      <Modal visible={requestModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "70%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
              {selectedSlot?.startTime?.slice(0, 5)} 신청자 목록
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 16 }}>
              확정할 회원을 선택하세요. 나머지는 자동 거절돼요.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {(selectedSlot?.requests ?? []).map((req: any) => {
                  const member = req.member ?? req;
                  const user = member.user ?? {};
                  const memberId = member.id ?? req.memberId;
                  const memberName = user.name ?? member.name ?? req.memberName ?? "이름 없음";
                  const ptRemaining = member.ptRemaining ?? req.ptRemaining ?? 0;

                  return (
                  <TouchableOpacity
                    key={req.id ?? memberId}
                    onPress={() => confirmMember(selectedSlot.id, memberId, memberName)}
                    disabled={confirming}
                    style={{
                      width: "30%",
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12, padding: 12,
                      alignItems: "center", gap: 6,
                      borderWidth: 1, borderColor: Colors.border,
                      opacity: confirming ? 0.5 : 1,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{memberName[0]}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text, textAlign: "center" }}>{memberName}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>잔여 {ptRemaining}회</Text>
                    <View style={{ backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{confirming ? "..." : "확정"}</Text>
                    </View>
                  </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={() => setRequestModal(false)} style={{ marginTop: 16, alignItems: "center", padding: 14 }}>
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 회원 추가 모달 (이번 주 빈 슬롯) */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "70%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
              {addingSlot?.startTime?.slice(0, 5)} 회원 추가
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 16 }}>
              이 시간에 추가할 회원을 선택하세요
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {members.map((m: any) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => addMemberToSlot(m.id, m.user.name)}
                    disabled={addingMember}
                    style={{
                      width: "30%",
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12, padding: 12,
                      alignItems: "center", gap: 6,
                      borderWidth: 1, borderColor: Colors.border,
                      opacity: addingMember ? 0.5 : 1,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{m.user.name[0]}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text, textAlign: "center" }}>{m.user.name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>잔여 {m.ptRemaining}회</Text>
                    <View style={{ backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{addingMember ? "..." : "추가"}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity onPress={() => setAddModal(false)} style={{ marginTop: 16, alignItems: "center", padding: 14 }}>
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* 다음 주 오픈 모달 */}
      <Modal visible={openModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "85%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.text, marginBottom: 6 }}>다음 주 일정 오픈</Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 18, lineHeight: 20 }}>
              근무 요일과 시간을 확인한 뒤 다음 주 신청 슬롯을 열 수 있어요.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {dayTimes.map((item, idx) => {
                const usingDefault = item.useDefault;
                const selectedStart = usingDefault ? item.defaultStart : item.start;
                const selectedEnd = usingDefault ? item.defaultEnd : item.end;

                return (
                  <View key={item.day} style={{
                    marginBottom: 12,
                    backgroundColor: item.enabled ? Colors.bgSub : "#f5f5f5",
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: item.enabled ? Colors.green + "44" : Colors.border,
                    opacity: item.enabled ? 1 : 0.5,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                      {/* 요일 토글 */}
                      <TouchableOpacity
                        onPress={() => setDayTimes(prev => prev.map((d, i) => i === idx ? { ...d, enabled: !d.enabled } : d))}
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          backgroundColor: item.enabled ? Colors.green : Colors.border,
                          justifyContent: "center", alignItems: "center", marginRight: 10,
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{item.day}</Text>
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.text }}>
                          {item.day}요일
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                          기본 {item.defaultStart}~{item.defaultEnd}
                        </Text>
                      </View>

                      {/* 요일별 기본/직접수정 선택 */}
                      <View style={{ flexDirection: "row", backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: Colors.border, padding: 3 }}>
                        <TouchableOpacity
                          disabled={!item.enabled}
                          onPress={() => setDayTimes(prev => prev.map((d, i) => i === idx ? { ...d, useDefault: true, start: d.defaultStart, end: d.defaultEnd } : d))}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: usingDefault ? Colors.green : "transparent",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "800", color: usingDefault ? "#fff" : Colors.textMuted }}>
                            기본
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          disabled={!item.enabled}
                          onPress={() => setDayTimes(prev => prev.map((d, i) => i === idx ? { ...d, useDefault: false } : d))}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                            backgroundColor: !usingDefault ? Colors.green : "transparent",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "800", color: !usingDefault ? "#fff" : Colors.textMuted }}>
                            직접수정
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* 시간 선택 */}
                    <View style={{ gap: 10 }}>
                      <View>
                        <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 4 }}>
                          시작 {usingDefault ? "(기본 사용 중)" : ""}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            {TIME_OPTIONS.map((time) => {
                              const selected = selectedStart === time;
                              return (
                                <TouchableOpacity
                                  key={`start-${item.day}-${time}`}
                                  disabled={!item.enabled || usingDefault}
                                  onPress={() => setDayTimes(prev => prev.map((d, i) => i === idx ? { ...d, useDefault: false, start: time } : d))}
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    backgroundColor: selected ? Colors.green : "#fff",
                                    borderWidth: 1,
                                    borderColor: selected ? Colors.green : Colors.border,
                                    opacity: usingDefault && !selected ? 0.45 : 1,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#fff" : Colors.text }}>
                                    {time}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>

                      <View>
                        <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 4 }}>
                          끝나는 시간 {usingDefault ? "(기본 사용 중)" : ""}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            {TIME_OPTIONS.map((time) => {
                              const selected = selectedEnd === time;
                              return (
                                <TouchableOpacity
                                  key={`end-${item.day}-${time}`}
                                  disabled={!item.enabled || usingDefault}
                                  onPress={() => setDayTimes(prev => prev.map((d, i) => i === idx ? { ...d, useDefault: false, end: time } : d))}
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    backgroundColor: selected ? Colors.green : "#fff",
                                    borderWidth: 1,
                                    borderColor: selected ? Colors.green : Colors.border,
                                    opacity: usingDefault && !selected ? 0.45 : 1,
                                  }}
                                >
                                  <Text style={{ fontSize: 12, fontWeight: "700", color: selected ? "#fff" : Colors.text }}>
                                    {time}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            {/* 확인 멘트 */}
            <View style={{ backgroundColor: Colors.greenLight, borderRadius: 12, padding: 12, marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: Colors.green + "44" }}>
              <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "800", marginBottom: 6 }}>오픈될 일정</Text>
              {dayTimes.filter(d => d.enabled).map(d => {
                const start = d.useDefault ? d.defaultStart : d.start;
                const end = d.useDefault ? d.defaultEnd : d.end;
                const startH = parseInt(start.split(":")[0]);
                const startM = parseInt(start.split(":")[1] || "0");
                const endH = parseInt(end.split(":")[0]);
                const endM = parseInt(end.split(":")[1] || "0");
                const totalMins = (endH * 60 + endM) - (startH * 60 + startM);
                const count = Math.floor(totalMins / 60);
                return (
                  <Text key={d.day} style={{ fontSize: 12, color: Colors.text, marginBottom: 2 }}>
                    {d.day}요일 · {start}~{end} · {d.useDefault ? "기본" : "직접수정"} ({count > 0 ? `${count}개 수업` : "시간 확인 필요"})
                  </Text>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => setOpenModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmOpenNextWeek} style={{ flex: 2, backgroundColor: Colors.green, borderRadius: 12, padding: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>오픈하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}