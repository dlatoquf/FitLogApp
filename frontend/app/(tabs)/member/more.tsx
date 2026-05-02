import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { ENDPOINTS } from "../../../constants/api";
import { apiGet, apiPut } from "../../../hooks/useApi";
import { MemberProfile } from "../../../types";

export default function MemberMoreScreen() {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ height: "", weight: "", bodyFat: "", muscleMass: "", goal: "" });
  const [saving, setSaving] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifFeedback, setNotifFeedback] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await apiGet<MemberProfile>(ENDPOINTS.member.me);
        setProfile(data);
        setEditForm({
          height: String(data.height ?? ""),
          weight: String(data.weight ?? ""),
          bodyFat: String(data.bodyFat ?? ""),
          muscleMass: String(data.muscleMass ?? ""),
          goal: data.goal ?? "",
        });
      } catch {
        const dummy: MemberProfile = {
          id: 1,
          name: "김지수",
          phone: "010-1234-5678",
          height: 165,
          weight: 60,
          bodyFat: 22,
          muscleMass: 28,
          ptRemaining: 12,
          ptTotal: 20,
          ptStartDate: "2025-03-01",
          ptExpDate: "2025-06-30",
          goal: "체지방 감량",
          trainerName: "김트레이너",
        };
        setProfile(dummy);
        setEditForm({ height: "165", weight: "60", bodyFat: "22", muscleMass: "28", goal: "체지방 감량" });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiPut(ENDPOINTS.profile.member, {
        height: editForm.height ? parseFloat(editForm.height) : undefined,
        weight: editForm.weight ? parseFloat(editForm.weight) : undefined,
        bodyFat: editForm.bodyFat ? parseFloat(editForm.bodyFat) : undefined,
        muscleMass: editForm.muscleMass ? parseFloat(editForm.muscleMass) : undefined,
        goal: editForm.goal || undefined,
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              height: editForm.height ? parseFloat(editForm.height) : prev.height,
              weight: editForm.weight ? parseFloat(editForm.weight) : prev.weight,
              bodyFat: editForm.bodyFat ? parseFloat(editForm.bodyFat) : prev.bodyFat,
              muscleMass: editForm.muscleMass ? parseFloat(editForm.muscleMass) : prev.muscleMass,
              goal: editForm.goal || prev.goal,
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
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["jwt", "pendingName"]);
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const ptPct = profile && profile.ptTotal ? (profile.ptRemaining! / profile.ptTotal) * 100 : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 20 }}>더보기</Text>

      {/* 프로필 카드 */}
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: Colors.blue, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>{profile?.name?.[0] ?? "M"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text }}>{profile?.name ?? "-"}</Text>
            {profile?.trainerName && (
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>담당: {profile.trainerName} 트레이너</Text>
            )}
            {profile?.goal && (
              <View style={{ backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6, alignSelf: "flex-start" }}>
                <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>{profile.goal}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowEditModal(true)}
            style={{ backgroundColor: Colors.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>수정</Text>
          </TouchableOpacity>
        </View>

        {/* 신체 정보 */}
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border }}>
          {[
            { label: "키", val: profile?.height, unit: "cm" },
            { label: "체중", val: profile?.weight, unit: "kg" },
            { label: "체지방", val: profile?.bodyFat, unit: "%" },
            { label: "근육", val: profile?.muscleMass, unit: "kg" },
          ].map(({ label, val, unit }) => (
            <View key={label} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{val ?? "-"}<Text style={{ fontSize: 11 }}>{val ? unit : ""}</Text></Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* PT 현황 */}
      {profile?.ptTotal && profile.ptTotal > 0 && (
        <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: Colors.textSub }}>PT 현황</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.blue }}>{profile.ptRemaining}</Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 2 }}>/ {profile.ptTotal}회</Text>
            </View>
          </View>
          <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 8, marginBottom: 8 }}>
            <View style={{ width: `${Math.min(ptPct, 100)}%` as any, height: 8, borderRadius: 99, backgroundColor: Colors.blue }} />
          </View>
          {profile.ptStartDate && (
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>
              {profile.ptStartDate} 시작{profile.ptExpDate ? ` · ${profile.ptExpDate} 만료` : ""}
            </Text>
          )}
        </View>
      )}

      {/* 알림 설정 */}
      <SectionHeader title="알림 설정" />
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: Colors.border }}>
        <SwitchRow label="푸시 알림" value={notifPush} onValueChange={setNotifPush} />
        <View style={{ height: 1, backgroundColor: Colors.border }} />
        <SwitchRow label="피드백 알림" value={notifFeedback} onValueChange={setNotifFeedback} />
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
      <TouchableOpacity
        onPress={handleLogout}
        style={{ backgroundColor: Colors.redBg, borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1, borderColor: Colors.red + "44" }}
      >
        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.red }}>로그아웃</Text>
      </TouchableOpacity>

      {/* 프로필 수정 모달 */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "80%" }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>신체 정보 수정</Text>

              <View style={{ flexDirection: "row", gap: 12, marginBottom: 0 }}>
                {[["키 (cm)", "height", "170"], ["체중 (kg)", "weight", "70"]].map(([label, key, placeholder]) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>{label}</Text>
                    <TextInput
                      value={editForm[key as keyof typeof editForm]}
                      onChangeText={(v) => setEditForm((f) => ({ ...f, [key]: v }))}
                      placeholder={placeholder}
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="decimal-pad"
                      style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: editForm[key as keyof typeof editForm] ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 12 }}
                    />
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                {[["체지방률 (%)", "bodyFat", "20"], ["골격근량 (kg)", "muscleMass", "30"]].map(([label, key, placeholder]) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>{label}</Text>
                    <TextInput
                      value={editForm[key as keyof typeof editForm]}
                      onChangeText={(v) => setEditForm((f) => ({ ...f, [key]: v }))}
                      placeholder={placeholder}
                      placeholderTextColor={Colors.textPlaceholder}
                      keyboardType="decimal-pad"
                      style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: editForm[key as keyof typeof editForm] ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 12 }}
                    />
                  </View>
                ))}
              </View>

              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>운동 목표</Text>
              <TextInput
                value={editForm.goal}
                onChangeText={(v) => setEditForm((f) => ({ ...f, goal: v }))}
                placeholder="예: 체지방 감량, 근육 증가"
                placeholderTextColor={Colors.textPlaceholder}
                style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: editForm.goal ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 20 }}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} disabled={saving} style={{ flex: 2, backgroundColor: Colors.blue, borderRadius: 12, padding: 14, alignItems: "center" }}>
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
  return (
    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textMuted, marginBottom: 8, marginTop: 4 }}>
      {title.toUpperCase()}
    </Text>
  );
}

function SwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: Colors.blue }} thumbColor="#fff" />
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
