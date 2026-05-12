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

export default function TrainerScheduleScreen() {
  const [tab, setTab]               = useState<"THIS" | "NEXT">("THIS");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots]           = useState<any[]>([]);
  const [members, setMembers]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [trainerProfile, setTrainerProfile] = useState<any>(null);

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

  const fetchRequests = async (slot: any) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/schedule/requests/${slot.id}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error("fetchRequests server error:", res.status, errText);
        throw new Error(`서버 오류 ${res.status}: ${errText}`);
      }
      setSelectedSlot({ ...slot, requests: await res.json() });
    } catch (e: any) {
      console.error("fetchRequests error:", e);
      Alert.alert("오류", e.message || "신청자 목록을 불러오지 못했어요.");
    }
    setRequestModal(true);
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

      if (addingSlot.status === "VIRTUAL") {
        // 가상 슬롯: 슬롯 생성 + 확정 한번에
        const res = await fetch(`${API_URL}/api/schedule/create-and-confirm`, {
          method: "POST", headers,
          body: JSON.stringify({
            date: addingSlot.date,
            startTime: addingSlot.startTime.slice(0, 5),
            memberId,
          }),
        });
        if (!res.ok) throw new Error("추가 실패");
      } else {
        // 실제 슬롯: 기존 confirm API
        const res = await fetch(`${API_URL}/api/schedule/confirm/${addingSlot.id}`, {
          method: "POST", headers,
          body: JSON.stringify({ memberId }),
        });
        if (!res.ok) throw new Error("추가 실패");
      }

      setAddModal(false);
      fetchCalendar(false, tab);
      Alert.alert("완료 ✓", `${memberName}님 수업이 추가됐어요!`);
    } catch (e: any) { Alert.alert("오류", e.message); }
    finally { setAddingMember(false); }
  };

  const openNextWeek = async () => {
    Alert.alert(
      "🔔 다음 주 오픈",
      "다음 주 수업 슬롯을 오픈할까요?\n연결된 모든 회원에게 알림이 전송돼요.",
      [
        { text: "취소", style: "cancel" },
        { text: "오픈 + 알림 전송", onPress: async () => {
          setGenerating(true);
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/schedule/generate`, {
              method: "POST", headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) {
              const message = await res.text();
            
              if (message.includes("이미 다음 주 일정이 오픈되어 있습니다")) {
                throw new Error("이미 다음 주 일정이 오픈되어 있어요.");
              }
            
              throw new Error(message || "생성 실패");
            }            Alert.alert("완료 🎉", "다음 주 슬롯이 오픈됐어요!\n회원들에게 알림이 전송됐어요.");
            setTab("NEXT");
            setSelectedDate(nextWeekDates[0]);
          } catch (e: any) { Alert.alert("오류", e.message); }
          finally { setGenerating(false); }
        }},
      ]
    );
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
    if (s.status === "REQUESTED" && !dotDates[s.date].includes(Colors.gold)) dotDates[s.date].push(Colors.gold);
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
            style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, opacity: generating ? 0.6 : 1 }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              {generating ? "처리 중..." : "🔔 다음 주 오픈"}
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
          {tab === "THIS" ? " · 전체 슬롯" : " · 전체 슬롯"}
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
            // 이번 주/다음 주 모두: 실제 슬롯 + 없는 시간대 가상 슬롯 합치기
            const displaySlots = [...daySlots, ...generateVirtualSlots()]
              .sort((a, b) => a.startTime.localeCompare(b.startTime));

            if (displaySlots.length === 0) return (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>📭</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>이날 슬롯이 없어요</Text>
              </View>
            );

            return displaySlots.map((slot, idx) => {
              const isConfirmed = slot.status === "CONFIRMED";
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
                    borderRadius: 12, padding: 14, marginBottom: 8,
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
                      <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green }}>
                        ✓ {slot.memberName}
                      </Text>
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
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                        {tab === "NEXT" ? "신청자 없음" : "비어있음"}
                      </Text>
                    )}
                  </View>

                  {/* 확정된 수업 취소 버튼 */}
                  {isConfirmed && slot.id && (
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
                {selectedSlot?.requests?.map((req: any) => (
                  <TouchableOpacity
                    key={req.id}
                    onPress={() => confirmMember(selectedSlot.id, req.member.id, req.member.user.name)}
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
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{req.member.user.name[0]}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text, textAlign: "center" }}>{req.member.user.name}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>잔여 {req.member.ptRemaining}회</Text>
                    <View style={{ backgroundColor: Colors.green, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{confirming ? "..." : "확정"}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
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
    </View>
  );
}