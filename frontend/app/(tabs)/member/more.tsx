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
  weight?: number;
  bodyFat?: number;
  bodyFatMass?: number;
  muscleMass?: number;
}

export default function MemberMoreScreen() {
  const [profile, setProfile] = useState<MemberProfileWithTrainerCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    height: "",
  });
  const [saving, setSaving] = useState(false);
  const [showTrainerCodeModal, setShowTrainerCodeModal] = useState(false);
  const [trainerCodeForm, setTrainerCodeForm] = useState("");
  const [connectingTrainer, setConnectingTrainer] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifFeedback, setNotifFeedback] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const pairs = await AsyncStorage.multiGet(["notif_push_member", "notif_feedback"]);
      if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
      if (pairs[1][1] !== null) setNotifFeedback(pairs[1][1] === "true");

      try {
        const data = await apiGet<MemberProfile>(ENDPOINTS.member.me);

        // 최신 바디로그가 있으면 더보기 카드에는 최신 체중/체지방/근육 값을 우선 표시
        let latestBodyLog: BodyLog | null = null;

        try {
          const bodyLogs = await apiGet<BodyLog[]>(ENDPOINTS.bodylog.me);

          latestBodyLog = [...bodyLogs]
            .filter((log) => log.logDate || log.date)
            .sort((a, b) =>
              String(b.logDate ?? b.date).localeCompare(String(a.logDate ?? a.date))
            )[0] ?? null;
        } catch (e) {
          console.log("최신 바디로그 조회 실패:", e);
        }

        const latestProfile: MemberProfileWithTrainerCode = {
          ...data,
          weight: latestBodyLog?.weight ?? data.weight,
          bodyFat:
            latestBodyLog?.bodyFat ??
            (latestBodyLog?.bodyFatMass && latestBodyLog?.weight
              ? Math.round((latestBodyLog.bodyFatMass / latestBodyLog.weight) * 1000) / 10
              : data.bodyFat),
          muscleMass: latestBodyLog?.muscleMass ?? data.muscleMass,
        };

        setProfile(latestProfile);
        setEditForm({
          name: latestProfile.name ?? "",
          phone: latestProfile.phone ?? "",
          height: String(latestProfile.height ?? ""),
        });
      } catch {
        const dummy: MemberProfileWithTrainerCode = {
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
        setEditForm({
          name: dummy.name ?? "",
          phone: dummy.phone ?? "",
          height: String(dummy.height ?? ""),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);

    try {
      await apiPut("/api/member/me", {
        name: editForm.name || undefined,
        phone: editForm.phone || undefined,
        height: editForm.height ? parseFloat(editForm.height) : undefined,
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: editForm.name || prev.name,
              phone: editForm.phone || prev.phone,
              height: editForm.height ? parseFloat(editForm.height) : prev.height,
            }
          : prev
      );

      setShowEditModal(false);
      Alert.alert("완료", "프로필이 수정됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "프로필 수정 중 오류가 발생했어요.");
    } finally {
      setSaving(false);
    }
  };

  const handleConnectTrainer = async () => {
    const code = trainerCodeForm.trim().toUpperCase();

    if (!code) {
      Alert.alert("입력 오류", "트레이너 코드를 입력해주세요.");
      return;
    }

    setConnectingTrainer(true);

    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/connect-trainer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ trainerCode: code }),
      });

      const raw = await res.text();
      let data: any = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { message: raw };
      }

      if (!res.ok) {
        const message = data.message ?? "트레이너 연결에 실패했어요.";

        if (message.includes("무료 플랜") || message.includes("회원 3명")) {
          Alert.alert(
            "연결 불가",
            "트레이너의 무료 플랜은 회원 3명까지 연결할 수 있어요.\n트레이너에게 PRO 업그레이드를 요청해주세요."
          );
          return;
        }

        Alert.alert("오류", message);
        return;
      }

      const trainerName = data.trainerName ? `${data.trainerName} 트레이너` : "트레이너";

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              trainerName: data.trainerName ?? prev.trainerName,
              trainerCode: code,
            }
          : prev
      );
      setTrainerCodeForm("");
      setShowTrainerCodeModal(false);

      Alert.alert("연결 완료", `${trainerName}와 연결됐어요.`);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "트레이너 연결 중 오류가 발생했어요.");
    } finally {
      setConnectingTrainer(false);
    }
  };

  const handlePushToggle = async (value: boolean) => {
    setNotifPush(value);
    await AsyncStorage.setItem("notif_push_member", String(value));
  };

  const handleFeedbackToggle = async (value: boolean) => {
    setNotifFeedback(value);
    await AsyncStorage.setItem("notif_feedback", String(value));
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
  const currentTrainerCode = profile?.trainerCode ?? "";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <Text style={{ fontSize: 14, color: Colors.textMuted }}>불러오는 중...</Text>
      </View>
    );
  }

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
            {profile?.phone && (
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>{profile.phone}</Text>
            )}
            {profile?.trainerName && (
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 2 }}>담당: {profile.trainerName} 트레이너</Text>
            )}
            {currentTrainerCode && (
              <Text style={{ fontSize: 12, color: Colors.green, marginTop: 2, fontWeight: "700" }}>트레이너 코드: {currentTrainerCode}</Text>
            )}
            {profile?.goal && (
              <View style={{ backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6, alignSelf: "flex-start" }}>
                <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>{profile.goal}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={() => {
              setEditForm({
                name: profile?.name ?? "",
                phone: profile?.phone ?? "",
                height: String(profile?.height ?? ""),
              });
              setShowEditModal(true);
            }}
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
              <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>
                {val ?? "-"}
                <Text style={{ fontSize: 11 }}>{val ? unit : ""}</Text>
              </Text>
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

      {/* 트레이너 연결 */}
      <SectionHeader title="트레이너 연결" />
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: Colors.border }}>
        <TouchableOpacity
          onPress={() => {
            setTrainerCodeForm(currentTrainerCode);
            setShowTrainerCodeModal(true);
          }}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, gap: 12 }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: Colors.text, fontWeight: "700" }}>
              {profile?.trainerName ? "담당 트레이너 변경/재연결" : "트레이너 코드 연결"}
            </Text>
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 3, lineHeight: 16 }}>
              {profile?.trainerName
                ? `현재 ${profile.trainerName} 트레이너와 연결되어 있어요.${currentTrainerCode ? ` 코드: ${currentTrainerCode}` : ""}`
                : "트레이너에게 받은 코드를 입력하면 연결할 수 있어요."}
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 알림 설정 */}
      <SectionHeader title="알림 설정" />
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden", marginBottom: 20, borderWidth: 1, borderColor: Colors.border }}>
        <SwitchRow
          label="푸시 알림"
          description="휴대폰 푸시 알림 수신 여부"
          value={notifPush}
          onValueChange={handlePushToggle}
        />
        <View style={{ height: 1, backgroundColor: Colors.border }} />
        <SwitchRow
          label="피드백 알림"
          description="트레이너 피드백 알림 표시 여부"
          value={notifFeedback}
          onValueChange={handleFeedbackToggle}
        />
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

      {/* 계정 삭제 */}
      <TouchableOpacity
        onPress={() => {
          Alert.alert("계정 삭제", "정말 계정을 삭제할까요?\n삭제 후 복구는 불가능해요.", [
            { text: "취소", style: "cancel" },
            {
              text: "삭제",
              style: "destructive",
              onPress: async () => {
                try {
                  const jwt = await AsyncStorage.getItem("jwt");
                  const res = await fetch(`${API_URL}/api/member/me`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${jwt}` },
                  });
                  if (!res.ok) throw new Error("계정 삭제 실패");
                  await AsyncStorage.multiRemove(["jwt", "pendingName"]);
                  router.replace("/auth/login");
                } catch (e: any) {
                  Alert.alert("오류", e.message ?? "계정 삭제 중 오류가 발생했어요.");
                }
              },
            },
          ]);
        }}
        style={{ alignItems: "center", marginTop: 12, paddingVertical: 8 }}
      >
        <Text style={{ fontSize: 12, color: Colors.textMuted }}>계정삭제</Text>
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
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 6 }}>프로필 수정</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 16 }}>
                이름, 전화번호, 키만 수정할 수 있어요. 체중/체지방/근육량은 바디로그 최신값으로 표시돼요.
              </Text>

              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>이름</Text>
              <TextInput
                value={editForm.name}
                onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
                placeholder="이름"
                placeholderTextColor={Colors.textPlaceholder}
                style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: editForm.name ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 12 }}
              />

              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>전화번호</Text>
              <TextInput
                value={editForm.phone}
                onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                placeholder="010-0000-0000"
                placeholderTextColor={Colors.textPlaceholder}
                keyboardType="phone-pad"
                style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: editForm.phone ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 12 }}
              />

              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>키 (cm)</Text>
              <TextInput
                value={editForm.height}
                onChangeText={(v) => setEditForm((f) => ({ ...f, height: v }))}
                placeholder="170"
                placeholderTextColor={Colors.textPlaceholder}
                keyboardType="decimal-pad"
                style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: editForm.height ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 20 }}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}>
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} disabled={saving} style={{ flex: 2, backgroundColor: Colors.blue, borderRadius: 12, padding: 14, alignItems: "center", opacity: saving ? 0.7 : 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{saving ? "저장 중..." : "저장"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 트레이너 코드 연결 모달 */}
      <Modal visible={showTrainerCodeModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 6 }}>트레이너 코드 연결</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 16, lineHeight: 18 }}>
              {currentTrainerCode
                ? `현재 연결된 코드: ${currentTrainerCode}\n새 코드로 변경하려면 아래에 입력해주세요.`
                : "트레이너에게 받은 코드를 입력해주세요. 트레이너의 무료 플랜 회원 수가 초과된 경우 연결이 제한될 수 있어요."}
            </Text>

            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>트레이너 코드</Text>
            <TextInput
              value={trainerCodeForm}
              onChangeText={(v) => setTrainerCodeForm(v.toUpperCase())}
              placeholder="예: ABC123"
              placeholderTextColor={Colors.textPlaceholder}
              autoCapitalize="characters"
              style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: trainerCodeForm ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 20 }}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowTrainerCodeModal(false)}
                disabled={connectingTrainer}
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConnectTrainer}
                disabled={connectingTrainer || !trainerCodeForm.trim()}
                style={{ flex: 2, backgroundColor: trainerCodeForm.trim() ? Colors.green : Colors.border, borderRadius: 12, padding: 14, alignItems: "center", opacity: connectingTrainer ? 0.7 : 1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: trainerCodeForm.trim() ? "#fff" : Colors.textMuted }}>
                  {connectingTrainer ? "연결 중..." : "연결하기"}
                </Text>
              </TouchableOpacity>
            </View>
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

function SwitchRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: Colors.text, fontWeight: "600" }}>{label}</Text>
        {description && (
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 3 }}>{description}</Text>
        )}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: Colors.blue }} thumbColor="#fff" />
    </View>
  );
}

function InfoRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>

      {value && (
        <Text style={{ fontSize: 13, color: Colors.textMuted }}>
          {value}
        </Text>
      )}

      {!value && (
        <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
      )}
    </TouchableOpacity>
  );
}
