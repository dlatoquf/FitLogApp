import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { apiGet, apiPut } from "../../../hooks/useApi";
import { TrainerProfile } from "../../../types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];


// 30분 단위 시간 옵션 (05:00 ~ 24:00)
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 24) TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`);
}

export default function TrainerMoreScreen() {
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ gymName: "", workDays: [] as number[], startTime: "09:00", endTime: "22:00" });
  const [saving, setSaving] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifSchedule, setNotifSchedule] = useState(true);
  const [plan, setPlan] = useState<"FREE" | "PRO">("FREE");

  useEffect(() => {
    const fetchProfile = async () => {
      // ✅ 알림 설정 불러오기
      const pairs = await AsyncStorage.multiGet(["notif_push", "notif_schedule"]);
      if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
      if (pairs[1][1] !== null) setNotifSchedule(pairs[1][1] === "true");

      // RevenueCat 구독 상태 확인
      try {
        if (Purchases && typeof Purchases.getCustomerInfo === "function") {
          const info = await Purchases.getCustomerInfo();
          const isPro = typeof info.entitlements.active["FitLogApp Pro"] !== "undefined";
          setPlan(isPro ? "PRO" : "FREE");
        }
      } catch (e) {
        console.log("RevenueCat 상태 확인 실패:", e);
      }

      try {
        const data = await apiGet<TrainerProfile>(ENDPOINTS.profile.trainer);
        setProfile(data);
        const workDayIndices = (data.workDays || "").split(",").map((d) => DAYS.indexOf(d.trim())).filter((i) => i >= 0);
        setEditForm({ gymName: data.gymName, workDays: workDayIndices, startTime: data.startTime, endTime: data.endTime });
      } catch {
        setProfile({ id: 1, name: "트레이너", gymName: "", workDays: "월,화,수,목,금", startTime: "09:00", endTime: "22:00", trainerCode: "---" });
        setEditForm({ gymName: "", workDays: [0, 1, 2, 3, 4], startTime: "09:00", endTime: "22:00" });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // ✅ 알림 설정 저장
  const handleNotifPush = (v: boolean) => { setNotifPush(v); AsyncStorage.setItem("notif_push", String(v)); };
  const handleNotifSchedule = (v: boolean) => { setNotifSchedule(v); AsyncStorage.setItem("notif_schedule", String(v)); };

  const handleSaveProfile = async () => {
    setSaving(true);
  
    try {
      const jwt = await AsyncStorage.getItem("jwt");
  
      const res = await fetch(`${API_URL}${ENDPOINTS.profile.trainer}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          gymName: editForm.gymName,
          workDays: editForm.workDays.map((i) => DAYS[i]).join(","),
          startTime: editForm.startTime,
          endTime: editForm.endTime,
        }),
      });
  
      if (!res.ok) throw new Error("프로필 수정 실패");
  
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              gymName: editForm.gymName,
              workDays: editForm.workDays.map((i) => DAYS[i]).join(","),
              startTime: editForm.startTime,
              endTime: editForm.endTime,
            }
          : prev
      );
  
      setShowEditModal(false);
      Alert.alert("완료", "프로필이 수정됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: async () => { await AsyncStorage.multiRemove(["jwt", "pendingName"]); router.replace("/auth/login"); } },
    ]);
  };

  const copyCode = () => Alert.alert("복사 완료", `트레이너 코드 ${profile?.trainerCode}가 복사됐어요.`);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 20 }}>더보기</Text>

      {/* 프로필 카드 */}
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: Colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>{profile?.name?.[0] ?? "T"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 19, fontWeight: "900", color: Colors.text }}>{profile?.name ?? "-"}</Text>
            <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>{profile?.gymName ?? "-"}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowEditModal(true)} style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10 }}>
            <Text style={{ color: Colors.textSub, fontSize: 12, fontWeight: "800" }}>수정</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {(profile?.workDays || "").split(",").map((d) => (
            <View key={d} style={{ backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>{d.trim()}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: Colors.textMuted }}>{profile?.startTime} ~ {profile?.endTime}</Text>
      </View>

      {/* 플랜 상태 */}
      <View
        style={{
          backgroundColor: plan === "PRO" ? Colors.greenLight : Colors.bgSub,
          borderRadius: 16,
          padding: 16,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: plan === "PRO" ? Colors.green + "44" : Colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "900",
              color: plan === "PRO" ? Colors.green : Colors.text,
              marginBottom: 4,
            }}
          >
            {plan === "PRO" ? "PRO 플랜" : "FREE 플랜"}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, lineHeight: 18 }}>
            {plan === "PRO"
              ? "회원 무제한 · 모든 기능 이용 중"
              : "무료 플랜은 회원 3명까지 가능해요"}
          </Text>
        </View>

        {plan === "FREE" && (
          <TouchableOpacity
            onPress={async () => {
              try {
                if (!Purchases || typeof Purchases.getOfferings !== "function") {
                  Alert.alert("오류", "결제 모듈을 불러오지 못했어요.");
                  return;
                }

                const offerings = await Purchases.getOfferings();
                const pkg =
                  offerings.current?.availablePackages.find(
                    (p: any) => p.packageType === "MONTHLY"
                  ) ?? offerings.current?.availablePackages[0];

                if (!pkg) {
                  Alert.alert("오류", "구독 상품을 불러오지 못했어요.");
                  return;
                }

                await Purchases.purchasePackage(pkg);
                setPlan("PRO");
                Alert.alert("구독 완료", "PRO 플랜이 활성화됐어요.");
              } catch (e: any) {
                if (!e.userCancelled) {
                  Alert.alert("결제 실패", e.message ?? "다시 시도해주세요.");
                }
              }
            }}
            style={{
              backgroundColor: Colors.green,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>
              업그레이드
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {/* 트레이너 코드 */}
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 16, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: Colors.border }}>
        <Text style={{ fontSize: 12, fontWeight: "800", color: Colors.textMuted, marginBottom: 8 }}>내 트레이너 코드</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 24, fontWeight: "900", color: Colors.text, letterSpacing: 3 }}>{profile?.trainerCode ?? "---"}</Text>
          <TouchableOpacity onPress={copyCode} style={{ backgroundColor: Colors.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>복사</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 8 }}>회원에게 이 코드를 공유하면 자동으로 연결돼요</Text>
      </View>

      {/* 알림 설정 */}
      <SectionHeader title="알림 설정" />
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: Colors.border }}>
        <SwitchRow label="푸시 알림" value={notifPush} onValueChange={handleNotifPush} color={Colors.green} />
        <View style={{ height: 1, backgroundColor: Colors.border }} />
        <SwitchRow label="일정 알림" value={notifSchedule} onValueChange={handleNotifSchedule} color={Colors.green} />
      </View>

      {/* 앱 정보 */}
      <SectionHeader title="앱 정보" />
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: Colors.border }}>
        <InfoRow label="버전" value="1.0.0" />
        <View style={{ height: 1, backgroundColor: Colors.border }} />
        <InfoRow label="이용약관" />
        <View style={{ height: 1, backgroundColor: Colors.border }} />
        <InfoRow label="개인정보처리방침" />
      </View>

      {/* 로그아웃 */}
      <TouchableOpacity onPress={handleLogout} style={{ backgroundColor: Colors.redBg, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: Colors.red + "44" }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.red }}>로그아웃</Text>
      </TouchableOpacity>

      {/* 프로필 수정 모달 */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "80%" }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>프로필 수정</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>헬스장명</Text>
              <TextInput value={editForm.gymName} onChangeText={(v) => setEditForm((f) => ({ ...f, gymName: v }))}
                style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 14 }} />
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 8 }}>근무 요일</Text>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
                {DAYS.map((d, i) => (
                  <TouchableOpacity key={d} onPress={() => setEditForm((f) => ({ ...f, workDays: f.workDays.includes(i) ? f.workDays.filter((x) => x !== i) : [...f.workDays, i] }))}
                    style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: editForm.workDays.includes(i) ? Colors.green : Colors.bgSub, borderWidth: 1, borderColor: editForm.workDays.includes(i) ? Colors.green : Colors.border, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: editForm.workDays.includes(i) ? "#fff" : Colors.textMuted }}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                {(["startTime", "endTime"] as const).map((key) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>{key === "startTime" ? "출근" : "퇴근"}</Text>
                    <ScrollView
                      style={{ height: 120, backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10 }}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {TIME_OPTIONS.map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setEditForm((f) => ({ ...f, [key]: t }))}
                          style={{
                            padding: 10,
                            backgroundColor: editForm[key] === t ? Colors.green : "transparent",
                            borderRadius: 8,
                            marginHorizontal: 4,
                            marginVertical: 2,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: editForm[key] === t ? "700" : "400", color: editForm[key] === t ? "#fff" : Colors.text }}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} disabled={saving} style={{ flex: 2, backgroundColor: Colors.green, borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{saving ? "저장 중..." : "저장"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.textSub, marginBottom: 8, marginTop: 4 }}>{title}</Text>;
}

function SwitchRow({ label, value, onValueChange, color }: { label: string; value: boolean; onValueChange: (v: boolean) => void; color: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: color }} thumbColor="#fff" />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>
      {value ? <Text style={{ fontSize: 13, color: Colors.textMuted }}>{value}</Text> : <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>}
    </View>
  );
}