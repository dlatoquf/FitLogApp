import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { apiGet, apiPut } from "../../../hooks/useApi";
import { MemberProfile } from "../../../types";

interface MemberProfileWithTrainerCode extends MemberProfile {
  trainerCode?: string;
  gymName?: string;
}

interface BodyLog {
  date?: string;
  logDate?: string;
  createdAt?: string;
  weight?: number;
  bodyFat?: number;
  bodyFatMass?: number;
  muscleMass?: number;
}

export default function MemberMoreScreen() {
  const [profile, setProfile] = useState<MemberProfileWithTrainerCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", height: "" });
  const [saving, setSaving] = useState(false);
  const [showTrainerCodeModal, setShowTrainerCodeModal] = useState(false);
  const [trainerCodeForm, setTrainerCodeForm] = useState("");
  const [connectingTrainer, setConnectingTrainer] = useState(false);
  const [verifiedTrainer, setVerifiedTrainer] = useState<{ trainerName: string; gymName: string } | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [ptContracts, setPtContracts] = useState<{ contractId: number; sessions: number; amount: number; memo?: string; date: string }[]>([]);

  const fetchProfile = async () => {
    try {
      const data = await apiGet<MemberProfile>(ENDPOINTS.member.me);

      let latestBodyLog: BodyLog | null = null;
      try {
        const bodyLogs = await apiGet<BodyLog[]>(ENDPOINTS.bodylog.me);
        latestBodyLog = [...bodyLogs]
          .filter((log) => log.createdAt || log.logDate || log.date)
          .sort((a, b) => String(b.createdAt ?? b.logDate ?? b.date).localeCompare(String(a.createdAt ?? a.logDate ?? a.date)))[0] ?? null;
      } catch {}

      const latestProfile: MemberProfileWithTrainerCode = {
        ...data,
        weight: latestBodyLog?.weight ?? data.weight,
        bodyFat: latestBodyLog?.bodyFat ??
          (latestBodyLog?.bodyFatMass && latestBodyLog?.weight
            ? Math.round((latestBodyLog.bodyFatMass / latestBodyLog.weight) * 1000) / 10
            : data.bodyFat),
        muscleMass: latestBodyLog?.muscleMass ?? data.muscleMass,
      };

      setProfile(latestProfile);
      setEditForm({ name: latestProfile.name ?? "", phone: latestProfile.phone ?? "", height: String(latestProfile.height ?? "") });

      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const contractsRes = await fetch(`${API_URL}/api/member/pt/contracts`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (contractsRes.ok) setPtContracts(await contractsRes.json());
      } catch {}
    } catch {
      setProfile({ id: 1, name: "회원", phone: "", height: 0, ptRemaining: 0, ptTotal: 0 });
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await apiPut("/api/member/me", {
        name: editForm.name || undefined,
        phone: editForm.phone || undefined,
        height: editForm.height ? parseFloat(editForm.height) : undefined,
      });
      setProfile((prev) => prev ? {
        ...prev,
        name: editForm.name || prev.name,
        phone: editForm.phone || prev.phone,
        height: editForm.height ? parseFloat(editForm.height) : prev.height,
      } : prev);
      setShowEditModal(false);
      Alert.alert("완료", "프로필이 수정됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "프로필 수정 중 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyCode = async () => {
    const code = trainerCodeForm.trim().toUpperCase();
    if (!code) { Alert.alert("입력 오류", "트레이너 코드를 입력해주세요."); return; }
    setVerifyingCode(true);
    setVerifiedTrainer(null);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/verify-trainer-code?code=${code}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (!res.ok) {
        const msg: string = data.message ?? "";
        if (msg.includes("무료 플랜") || msg.includes("가득")) {
          Alert.alert("연결 불가", "이 트레이너는 현재 회원이 가득 찼어요.");
        } else {
          Alert.alert("확인 실패", msg || "유효하지 않은 코드예요.");
        }
        return;
      }
      setVerifiedTrainer({ trainerName: data.trainerName, gymName: data.gymName });
    } catch {
      Alert.alert("오류", "코드 확인 중 오류가 발생했어요.");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleDisconnectTrainer = () => {
    Alert.alert("트레이너 연결 해제", "정말 연결을 해제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "해제", style: "destructive",
        onPress: async () => {
          setDisconnecting(true);
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/member/disconnect-trainer`, {
              method: "POST", headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error("해제 실패");
            setProfile((prev) => prev ? { ...prev, trainerName: undefined, trainerCode: undefined } : prev);
            setShowTrainerCodeModal(false);
            Alert.alert("완료", "트레이너 연결이 해제됐어요.");
          } catch {
            Alert.alert("오류", "연결 해제 중 오류가 발생했어요.");
          } finally {
            setDisconnecting(false);
          }
        },
      },
    ]);
  };

  const handleConnectTrainer = async () => {
    const code = trainerCodeForm.trim().toUpperCase();
    if (!code) { Alert.alert("입력 오류", "트레이너 코드를 입력해주세요."); return; }
    setConnectingTrainer(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/connect-trainer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ trainerCode: code }),
      });
      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
      if (!res.ok) {
        const message = data.message ?? "트레이너 연결에 실패했어요.";
        if (message.includes("무료 플랜") || message.includes("가득")) {
          Alert.alert("연결 불가", "이 트레이너는 현재 회원이 가득 찼어요.");
          return;
        }
        Alert.alert("오류", message); return;
      }
      setProfile((prev) => prev ? { ...prev, trainerName: data.trainerName ?? prev.trainerName, trainerCode: code } : prev);
      setTrainerCodeForm(""); setShowTrainerCodeModal(false);
      Alert.alert("연결 완료", `${data.trainerName ?? "트레이너"}와 연결됐어요.`);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "트레이너 연결 중 오류가 발생했어요.");
    } finally {
      setConnectingTrainer(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃", style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["jwt", "pendingName"]);
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert("계정 삭제", "정말 계정을 삭제할까요?\n삭제 후 복구는 불가능해요.", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/member/me`, {
              method: "DELETE", headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
            await AsyncStorage.multiRemove(["jwt", "pendingName"]);
            router.replace("/auth/login");
          } catch (e: any) {
            Alert.alert("오류", e.message ?? "계정 삭제 중 오류가 발생했어요.");
          }
        },
      },
    ]);
  };

  const ptPct = profile?.ptTotal ? (profile.ptRemaining! / profile.ptTotal) * 100 : 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 14, color: Colors.textMuted }}>불러오는 중...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: "#fff" }} contentContainerStyle={{ paddingTop: 56, paddingBottom: 48 }}>
        {/* 헤더 */}
        <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.text, paddingHorizontal: 20, marginBottom: 20 }}>
          내정보
        </Text>

        {/* 프로필 카드 */}
        <View style={{
          marginHorizontal: 16, marginBottom: 24,
          backgroundColor: "#fff", borderRadius: 18,
          borderWidth: 1, borderColor: Colors.border, overflow: "hidden",
        }}>
          {/* 상단: 아바타 + 이름 + 수정 */}
          <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}>
            <View style={{
              width: 54, height: 54, borderRadius: 27,
              backgroundColor: Colors.blue,
              justifyContent: "center", alignItems: "center",
            }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>
                {profile?.name?.[0] ?? "M"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>
                {profile?.name ?? "-"}
              </Text>
              {profile?.phone ? (
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>{profile.phone}</Text>
              ) : null}
              {profile?.goal ? (
                <View style={{
                  backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44",
                  paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 5, alignSelf: "flex-start",
                }}>
                  <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>{profile.goal}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => { setEditForm({ name: profile?.name ?? "", phone: profile?.phone ?? "", height: String(profile?.height ?? "") }); setShowEditModal(true); }}
              style={{ paddingHorizontal: 14, paddingVertical: 7, backgroundColor: Colors.blue, borderRadius: 10 }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>수정</Text>
            </TouchableOpacity>
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: Colors.border }} />

          {/* 트레이너 연결 정보 */}
          <TouchableOpacity
            onPress={() => { setTrainerCodeForm(profile?.trainerCode ?? ""); setShowTrainerCodeModal(true); }}
            style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 13, color: Colors.textMuted, flex: 1 }}>
              {profile?.trainerName ? `담당 트레이너: ${profile.trainerName}` : "트레이너 미연결"}
            </Text>
            <Text style={{ fontSize: 13, color: Colors.blue, fontWeight: "600" }}>
              {profile?.trainerName ? "변경" : "연결하기"} ›
            </Text>
          </TouchableOpacity>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: Colors.border }} />

          {/* 신체 정보 */}
          <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 14 }}>
            {[
              { label: "키", val: profile?.height, unit: "cm" },
              { label: "체중", val: profile?.weight, unit: "kg" },
              { label: "체지방", val: profile?.bodyFat, unit: "%" },
              { label: "근육", val: profile?.muscleMass, unit: "kg" },
            ].map(({ label, val, unit }) => (
              <View key={label} style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>
                  {val ?? "-"}<Text style={{ fontSize: 11 }}>{val ? unit : ""}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* PT 현황 */}
        {profile?.ptTotal && profile.ptTotal > 0 ? (
          <>
            <FlatSectionHeader title="PT 현황" />
            <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border, marginBottom: 24 }}>
              <View style={{ paddingHorizontal: 20, paddingVertical: 14 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Text style={{ fontSize: 14, color: Colors.textSub, fontWeight: "600" }}>잔여 PT</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3 }}>
                    <Text style={{ fontSize: 24, fontWeight: "900", color: Colors.blue }}>{profile.ptRemaining}</Text>
                    <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 2 }}>/ {profile.ptTotal}회</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 6, marginBottom: 8 }}>
                  <View style={{ width: `${Math.min(ptPct, 100)}%` as any, height: 6, borderRadius: 99, backgroundColor: Colors.blue }} />
                </View>
                {profile.ptStartDate ? (
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    {profile.ptStartDate} 시작{profile.ptExpDate ? ` · ${profile.ptExpDate} 만료` : ""}
                  </Text>
                ) : null}
              </View>

              {/* 결제 내역 */}
              {ptContracts.length > 0 && (
                <>
                  <View style={{ height: 1, backgroundColor: Colors.border }} />
                  {ptContracts.map((c, idx) => (
                    <View key={c.contractId} style={{
                      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                      paddingHorizontal: 20, paddingVertical: 12,
                      borderBottomWidth: idx < ptContracts.length - 1 ? 1 : 0,
                      borderBottomColor: Colors.border,
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text }}>{c.sessions}회 등록</Text>
                        {c.memo ? <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }}>{c.memo}</Text> : null}
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.blue }}>
                          {c.amount > 0 ? c.amount.toLocaleString() + "원" : "-"}
                        </Text>
                        <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 1 }}>{c.date}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          </>
        ) : null}

        {/* 앱 정보 */}
        <FlatSectionHeader title="앱 정보" />
        <View style={{ borderTopWidth: 1, borderColor: Colors.border }}>
          <FlatRow label="버전" right="1.0.5" last={false} />
          <FlatRow label="이용약관" onPress={() => Linking.openURL("https://dlatoquf.github.io/FitLogApp/docs/terms.html")} showArrow last={false} />
          <FlatRow label="개인정보처리방침" onPress={() => Linking.openURL("https://dlatoquf.github.io/FitLogApp/docs/privacy.html")} showArrow last />
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ paddingVertical: 16, marginTop: 8 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.red, textAlign: "center" }}>
            로그아웃
          </Text>
        </TouchableOpacity>

        {/* 계정 삭제 */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          style={{ alignItems: "center", marginTop: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>계정삭제</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 프로필 수정 모달 */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "80%" }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>프로필 수정</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 20 }}>
                이름, 전화번호, 키만 수정할 수 있어요. 체중/체지방/근육량은 바디로그 최신값으로 표시돼요.
              </Text>

              {[
                { label: "이름", key: "name" as const, placeholder: "이름", keyboardType: "default" as const },
                { label: "전화번호", key: "phone" as const, placeholder: "010-0000-0000", keyboardType: "phone-pad" as const },
                { label: "키 (cm)", key: "height" as const, placeholder: "170", keyboardType: "decimal-pad" as const },
              ].map(({ label, key, placeholder, keyboardType }) => (
                <View key={key}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>{label}</Text>
                  <TextInput
                    value={editForm[key]}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, [key]: v }))}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textPlaceholder}
                    keyboardType={keyboardType}
                    style={{
                      backgroundColor: Colors.bgSub, borderWidth: 1,
                      borderColor: editForm[key] ? Colors.blue : Colors.border,
                      borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 12,
                    }}
                  />
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
                >
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveProfile} disabled={saving}
                  style={{ flex: 2, backgroundColor: Colors.blue, borderRadius: 12, padding: 14, alignItems: "center", opacity: saving ? 0.7 : 1 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{saving ? "저장 중..." : "저장"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 트레이너 연결 모달 */}
      <Modal visible={showTrainerCodeModal} transparent animationType="slide" onRequestClose={() => setShowTrainerCodeModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>트레이너 연결</Text>

            {profile?.trainerName && (
              <View style={{ backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.textMuted, marginBottom: 6 }}>현재 연결된 트레이너</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>{profile.trainerName} 트레이너</Text>
                    {profile.gymName ? <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>{profile.gymName}</Text> : null}
                  </View>
                  <TouchableOpacity
                    onPress={handleDisconnectTrainer} disabled={disconnecting}
                    style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.red }}>
                      {disconnecting ? "해제 중..." : "연결 해제"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>
              {profile?.trainerName ? "다른 트레이너로 변경" : "트레이너 코드 입력"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <TextInput
                value={trainerCodeForm}
                onChangeText={(v) => { setTrainerCodeForm(v.toUpperCase()); setVerifiedTrainer(null); }}
                placeholder="예: ABC123"
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="characters"
                style={{
                  flex: 1, backgroundColor: Colors.bgSub, borderWidth: 1,
                  borderColor: trainerCodeForm ? Colors.blue : Colors.border,
                  borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text,
                }}
              />
              <TouchableOpacity
                onPress={handleVerifyCode} disabled={verifyingCode || !trainerCodeForm.trim()}
                style={{ backgroundColor: trainerCodeForm.trim() ? Colors.blue : Colors.border, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center", opacity: verifyingCode ? 0.7 : 1 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{verifyingCode ? "확인 중" : "코드 확인"}</Text>
              </TouchableOpacity>
            </View>

            {verifiedTrainer && (
              <View style={{ backgroundColor: Colors.greenLight, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: Colors.green + "44", flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 18 }}>✅</Text>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.text }}>{verifiedTrainer.trainerName} 트레이너</Text>
                  {verifiedTrainer.gymName ? <Text style={{ fontSize: 12, color: Colors.textMuted }}>{verifiedTrainer.gymName}</Text> : null}
                </View>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowTrainerCodeModal(false); setVerifiedTrainer(null); setTrainerCodeForm(""); }}
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConnectTrainer} disabled={connectingTrainer || !verifiedTrainer}
                style={{ flex: 2, backgroundColor: verifiedTrainer ? Colors.green : Colors.border, borderRadius: 12, padding: 14, alignItems: "center", opacity: connectingTrainer ? 0.7 : 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: verifiedTrainer ? "#fff" : Colors.textMuted }}>
                  {connectingTrainer ? "연결 중..." : "이 트레이너로 연결"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ── 공통 컴포넌트 ─────────────────────────────────────────────────────────────

function FlatSectionHeader({ title }: { title: string }) {
  return (
    <Text style={{
      fontSize: 11, fontWeight: "700", color: Colors.textMuted,
      paddingHorizontal: 20, marginBottom: 6, letterSpacing: 0.5,
    }}>
      {title.toUpperCase()}
    </Text>
  );
}

function FlatRow({
  label, sublabel, right, onPress, showArrow, last, labelColor,
}: {
  label: string;
  sublabel?: string;
  right?: string;
  onPress?: () => void;
  showArrow?: boolean;
  last?: boolean;
  labelColor?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
      style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: labelColor ?? Colors.text, fontWeight: "500" }}>{label}</Text>
        {sublabel ? <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>{sublabel}</Text> : null}
      </View>
      {right ? <Text style={{ fontSize: 14, color: Colors.textMuted }}>{right}</Text> : null}
      {showArrow ? <Text style={{ fontSize: 18, color: Colors.textMuted, marginLeft: 4 }}>›</Text> : null}
    </TouchableOpacity>
  );
}
