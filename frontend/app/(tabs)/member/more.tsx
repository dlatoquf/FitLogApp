import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
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
import { PRIVACY_TEXT, TERMS_TEXT } from "../../../constants/terms";
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
  const [profile, setProfile] = useState<MemberProfileWithTrainerCode | null>(
    null,
  );
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
  const [verifiedTrainer, setVerifiedTrainer] = useState<{
    trainerName: string;
    gymName: string;
  } | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifSchedule, setNotifSchedule] = useState(true);
  const [notifPtPayment, setNotifPtPayment] = useState(true);
  const [notifFeedback, setNotifFeedback] = useState(true);
  const [notifWorkout, setNotifWorkout] = useState(true);
  const [ptContracts, setPtContracts] = useState<
    {
      contractId: number;
      sessions: number;
      amount: number;
      memo?: string;
      date: string;
    }[]
  >([]);
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsContent, setTermsContent] = useState({ title: "", text: "" });

  const fetchProfile = async () => {
    const pairs = await AsyncStorage.multiGet([
      "notif_push_member",
      "notif_schedule_member",
      "notif_pt_payment",
      "notif_feedback",
      "notif_workout_member",
    ]);
    if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
    if (pairs[1][1] !== null) setNotifSchedule(pairs[1][1] === "true");
    if (pairs[2][1] !== null) setNotifPtPayment(pairs[2][1] === "true");
    if (pairs[3][1] !== null) setNotifFeedback(pairs[3][1] === "true");
    if (pairs[4][1] !== null) setNotifWorkout(pairs[4][1] === "true");

    try {
      const data = await apiGet<MemberProfile>(ENDPOINTS.member.me);

      // 최신 바디로그가 있으면 더보기 카드에는 최신 체중/체지방/근육 값을 우선 표시
      let latestBodyLog: BodyLog | null = null;

      try {
        const bodyLogs = await apiGet<BodyLog[]>(ENDPOINTS.bodylog.me);

        latestBodyLog =
          [...bodyLogs]
            .filter((log) => log.createdAt || log.logDate || log.date)
            .sort((a, b) =>
              String(b.createdAt ?? b.logDate ?? b.date).localeCompare(
                String(a.createdAt ?? a.logDate ?? a.date),
              ),
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
            ? Math.round(
                (latestBodyLog.bodyFatMass / latestBodyLog.weight) * 1000,
              ) / 10
            : data.bodyFat),
        muscleMass: latestBodyLog?.muscleMass ?? data.muscleMass,
      };

      setProfile(latestProfile);
      setEditForm({
        name: latestProfile.name ?? "",
        phone: latestProfile.phone ?? "",
        height: String(latestProfile.height ?? ""),
      });

      // 결제 내역 조회
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const contractsRes = await fetch(`${API_URL}/api/member/pt/contracts`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (contractsRes.ok) setPtContracts(await contractsRes.json());
      } catch {}
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

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, []),
  );

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
              height: editForm.height
                ? parseFloat(editForm.height)
                : prev.height,
            }
          : prev,
      );

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
    if (!code) {
      Alert.alert("입력 오류", "트레이너 코드를 입력해주세요.");
      return;
    }
    setVerifyingCode(true);
    setVerifiedTrainer(null);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/member/verify-trainer-code?code=${code}`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        },
      );
      const data = await res.json();
      if (!res.ok) {
        const msg: string = data.message ?? "";
        if (msg.includes("무료 플랜") || msg.includes("가득")) {
          Alert.alert(
            "연결 불가 😢",
            "이 트레이너는 현재 무료 플랜으로\n회원을 더 받을 수 없어요.\n\n트레이너에게 PRO 플랜 업그레이드를 요청해주세요.",
          );
        } else {
          Alert.alert("확인 실패", msg || "유효하지 않은 코드예요.");
        }
        return;
      }
      setVerifiedTrainer({
        trainerName: data.trainerName,
        gymName: data.gymName,
      });
    } catch {
      Alert.alert("오류", "코드 확인 중 오류가 발생했어요.");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleDisconnectTrainer = () => {
    Alert.alert(
      "트레이너 연결 해제",
      "정말 연결을 해제할까요?\n운동 기록은 그대로 유지돼요.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "해제",
          style: "destructive",
          onPress: async () => {
            setDisconnecting(true);
            try {
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(
                `${API_URL}/api/member/disconnect-trainer`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${jwt}` },
                },
              );
              if (!res.ok) throw new Error("해제 실패");
              setProfile((prev) =>
                prev
                  ? { ...prev, trainerName: undefined, trainerCode: undefined }
                  : prev,
              );
              setShowTrainerCodeModal(false);
              Alert.alert("완료", "트레이너 연결이 해제됐어요.");
            } catch {
              Alert.alert("오류", "연결 해제 중 오류가 발생했어요.");
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ],
    );
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

        if (message.includes("무료 플랜") || message.includes("회원 3명") || message.includes("가득")) {
          Alert.alert(
            "연결 불가 😢",
            "이 트레이너는 현재 무료 플랜으로\n회원을 더 받을 수 없어요.\n\n트레이너에게 PRO 플랜 업그레이드를 요청해주세요.",
          );
          return;
        }

        Alert.alert("오류", message);
        return;
      }

      const trainerName = data.trainerName
        ? `${data.trainerName} 트레이너`
        : "트레이너";

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              trainerName: data.trainerName ?? prev.trainerName,
              trainerCode: code,
            }
          : prev,
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
    if (!value) {
      // 전체 끄면 세부 항목도 모두 끔
      setNotifSchedule(false);
      setNotifPtPayment(false);
      setNotifFeedback(false);
      setNotifWorkout(false);
      await AsyncStorage.multiSet([
        ["notif_schedule_member", "false"],
        ["notif_pt_payment", "false"],
        ["notif_feedback", "false"],
        ["notif_workout_member", "false"],
      ]);
    } else {
      // 전체 켜면 세부 항목도 모두 켬
      setNotifSchedule(true);
      setNotifPtPayment(true);
      setNotifFeedback(true);
      setNotifWorkout(true);
      await AsyncStorage.multiSet([
        ["notif_schedule_member", "true"],
        ["notif_pt_payment", "true"],
        ["notif_feedback", "true"],
        ["notif_workout_member", "true"],
      ]);
    }
  };
  const handleWorkoutToggle = async (value: boolean) => {
    setNotifWorkout(value);
    await AsyncStorage.setItem("notif_workout_member", String(value));
    if (value && !notifPush) handlePushToggle(true);
  };
  const handleScheduleToggle = async (value: boolean) => {
    setNotifSchedule(value);
    await AsyncStorage.setItem("notif_schedule_member", String(value));
    if (value && !notifPush) handlePushToggle(true);
  };
  const handlePtPaymentToggle = async (value: boolean) => {
    setNotifPtPayment(value);
    await AsyncStorage.setItem("notif_pt_payment", String(value));
    if (value && !notifPush) handlePushToggle(true);
  };
  const handleFeedbackToggle = async (value: boolean) => {
    setNotifFeedback(value);
    await AsyncStorage.setItem("notif_feedback", String(value));
    if (value && !notifPush) handlePushToggle(true);
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

  const ptPct =
    profile && profile.ptTotal
      ? (profile.ptRemaining! / profile.ptTotal) * 100
      : 0;
  const currentTrainerCode = profile?.trainerCode ?? "";

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontSize: 14, color: Colors.textMuted }}>
          불러오는 중...
        </Text>
      </View>
    );
  }

  return (
    <>
      {/* 이용약관 / 개인정보처리방침 모달 */}
      <Modal
        visible={termsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTermsVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85%",
              paddingBottom: 32,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 18,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}
              >
                {termsContent.title}
              </Text>
              <TouchableOpacity onPress={() => setTermsVisible(false)}>
                <Text style={{ fontSize: 22, color: Colors.textMuted }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text
                style={{ fontSize: 14, color: Colors.text, lineHeight: 22 }}
              >
                {termsContent.text}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 52,
          paddingBottom: 40,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            marginBottom: 14,
          }}
        >
          내정보
        </Text>

        {/* 프로필 카드 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                backgroundColor: Colors.blue,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#fff" }}>
                {profile?.name?.[0] ?? "M"}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 20, fontWeight: "800", color: Colors.text }}
              >
                {profile?.name ?? "-"}
              </Text>
              {profile?.phone && (
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {profile.phone}
                </Text>
              )}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 4,
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                  {profile?.trainerName
                    ? `담당: ${profile.trainerName} 트레이너`
                    : "트레이너 미연결"}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setTrainerCodeForm(currentTrainerCode);
                    setShowTrainerCodeModal(true);
                  }}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textSub,
                      fontWeight: "700",
                    }}
                  >
                    {profile?.trainerName ? "변경" : "연결"}
                  </Text>
                </TouchableOpacity>
              </View>
              {profile?.goal && (
                <View
                  style={{
                    backgroundColor: Colors.greenLight,
                    borderWidth: 1,
                    borderColor: Colors.green + "44",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    marginTop: 6,
                    alignSelf: "flex-start",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.green,
                      fontWeight: "700",
                    }}
                  >
                    {profile.goal}
                  </Text>
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
              style={{
                backgroundColor: Colors.blue,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                수정
              </Text>
            </TouchableOpacity>
          </View>

          {/* 신체 정보 */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            {[
              { label: "키", val: profile?.height, unit: "cm" },
              { label: "체중", val: profile?.weight, unit: "kg" },
              { label: "체지방", val: profile?.bodyFat, unit: "%" },
              { label: "근육", val: profile?.muscleMass, unit: "kg" },
            ].map(({ label, val, unit }) => (
              <View key={label} style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  {val ?? "-"}
                  <Text style={{ fontSize: 11 }}>{val ? unit : ""}</Text>
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* PT 현황 */}
        {profile?.ptTotal && profile.ptTotal > 0 && (
          <View
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text style={{ fontSize: 14, color: Colors.textSub }}>
                PT 현황
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: "900",
                    color: Colors.blue,
                  }}
                >
                  {profile.ptRemaining}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginBottom: 2,
                  }}
                >
                  / {profile.ptTotal}회
                </Text>
              </View>
            </View>
            <View
              style={{
                backgroundColor: Colors.border,
                borderRadius: 99,
                height: 8,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  width: `${Math.min(ptPct, 100)}%` as any,
                  height: 8,
                  borderRadius: 99,
                  backgroundColor: Colors.blue,
                }}
              />
            </View>
            {profile.ptStartDate && (
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                {profile.ptStartDate} 시작
                {profile.ptExpDate ? ` · ${profile.ptExpDate} 만료` : ""}
              </Text>
            )}

            {/* 결제 내역 */}
            {ptContracts.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <View
                  style={{
                    height: 1,
                    backgroundColor: Colors.border,
                    marginBottom: 12,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  결제 내역
                </Text>
                {ptContracts.map((c) => (
                  <View
                    key={c.contractId}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 6,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.text,
                        }}
                      >
                        {c.sessions}회 등록
                      </Text>
                      {c.memo ? (
                        <Text
                          style={{
                            fontSize: 11,
                            color: Colors.textMuted,
                            marginTop: 1,
                          }}
                        >
                          {c.memo}
                        </Text>
                      ) : null}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: Colors.blue,
                        }}
                      >
                        {c.amount > 0 ? c.amount.toLocaleString() + "원" : "-"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: Colors.textMuted,
                          marginTop: 1,
                        }}
                      >
                        {c.date}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* 알림 설정 */}
        <SectionHeader title="알림 설정" />
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 6,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <SwitchRow
            label="전체 푸시 알림"
            description="휴대폰 푸시 알림 수신 여부"
            value={notifPush}
            onValueChange={handlePushToggle}
            bold
          />
        </View>
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 14,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: notifPush ? 1 : 0.4,
          }}
        >
          <SwitchRow
            label="수업 알림"
            description="수업 확정·취소·리마인더 알림"
            value={notifSchedule}
            onValueChange={handleScheduleToggle}
            disabled={!notifPush}
          />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <SwitchRow
            label="PT 결제 알림"
            description="트레이너가 PT 횟수를 추가하면 알림"
            value={notifPtPayment}
            onValueChange={handlePtPaymentToggle}
            disabled={!notifPush}
          />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <SwitchRow
            label="피드백 알림"
            description="트레이너 운동·식단 피드백 알림"
            value={notifFeedback}
            onValueChange={handleFeedbackToggle}
            disabled={!notifPush}
          />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <SwitchRow
            label="운동 기록 (PT)"
            description="트레이너가 PT 기록 등록 시 알림"
            value={notifWorkout}
            onValueChange={handleWorkoutToggle}
            disabled={!notifPush}
          />
        </View>

        {/* 앱 정보 */}
        <SectionHeader title="앱 정보" />
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 14,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <InfoRow label="버전" value="1.0.0" />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <TouchableOpacity
            onPress={() => {
              setTermsContent({ title: "이용약관", text: TERMS_TEXT });
              setTermsVisible(true);
            }}
          >
            <InfoRow label="이용약관" />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <TouchableOpacity
            onPress={() => {
              setTermsContent({
                title: "개인정보처리방침",
                text: PRIVACY_TEXT,
              });
              setTermsVisible(true);
            }}
          >
            <InfoRow label="개인정보처리방침" />
          </TouchableOpacity>
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: Colors.redBg,
            borderRadius: 14,
            padding: 16,
            alignItems: "center",
            borderWidth: 1,
            borderColor: Colors.red + "44",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.red }}>
            로그아웃
          </Text>
        </TouchableOpacity>

        {/* 계정 삭제 */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "계정 삭제",
              "정말 계정을 삭제할까요?\n삭제 후 복구는 불가능해요.",
              [
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
                      if (!res.ok) {
                        const errText = await res.text().catch(() => "");
                        throw new Error(
                          `삭제 실패 (${res.status}): ${errText}`,
                        );
                      }
                      await AsyncStorage.multiRemove(["jwt", "pendingName"]);
                      router.replace("/auth/login");
                    } catch (e: any) {
                      Alert.alert(
                        "오류",
                        e.message ?? "계정 삭제 중 오류가 발생했어요.",
                      );
                    }
                  },
                },
              ],
            );
          }}
          style={{ alignItems: "center", marginTop: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            계정삭제
          </Text>
        </TouchableOpacity>

        {/* 프로필 수정 모달 */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <KeyboardAvoidingView
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
                maxHeight: "80%",
              }}
            >
              <ScrollView keyboardShouldPersistTaps="handled">
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                    alignSelf: "center",
                    marginBottom: 16,
                  }}
                />
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: Colors.text,
                    marginBottom: 6,
                  }}
                >
                  프로필 수정
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 16,
                  }}
                >
                  이름, 전화번호, 키만 수정할 수 있어요. 체중/체지방/근육량은
                  바디로그 최신값으로 표시돼요.
                </Text>

                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  이름
                </Text>
                <TextInput
                  value={editForm.name}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
                  placeholder="이름"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: editForm.name ? Colors.green : Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 12,
                  }}
                />

                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  전화번호
                </Text>
                <TextInput
                  value={editForm.phone}
                  onChangeText={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                  placeholder="010-0000-0000"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="phone-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: editForm.phone ? Colors.green : Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 12,
                  }}
                />

                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  키 (cm)
                </Text>
                <TextInput
                  value={editForm.height}
                  onChangeText={(v) =>
                    setEditForm((f) => ({ ...f, height: v }))
                  }
                  placeholder="170"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: editForm.height ? Colors.green : Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 20,
                  }}
                />

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: Colors.textSub }}>
                      취소
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    disabled={saving}
                    style={{
                      flex: 2,
                      backgroundColor: Colors.blue,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    <Text
                      style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                    >
                      {saving ? "저장 중..." : "저장"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* 트레이너 연결/변경/해제 모달 */}
        <Modal
          visible={showTrainerCodeModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTrainerCodeModal(false)}
        >
          <KeyboardAvoidingView
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                  alignSelf: "center",
                  marginBottom: 16,
                }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 16,
                }}
              >
                트레이너 연결
              </Text>

              {/* 현재 연결된 트레이너 */}
              {profile?.trainerName && (
                <View
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: Colors.textMuted,
                      marginBottom: 4,
                    }}
                  >
                    현재 연결된 트레이너
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "800",
                          color: Colors.text,
                        }}
                      >
                        {profile.trainerName} 트레이너
                      </Text>
                      {profile.gymName && (
                        <Text
                          style={{
                            fontSize: 12,
                            color: Colors.textMuted,
                            marginTop: 2,
                          }}
                        >
                          {profile.gymName}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={handleDisconnectTrainer}
                      disabled={disconnecting}
                      style={{
                        backgroundColor: "#FEF2F2",
                        borderWidth: 1,
                        borderColor: "#FECACA",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: Colors.red,
                        }}
                      >
                        {disconnecting ? "해제 중..." : "연결 해제"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 새 트레이너 코드 입력 */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                {profile?.trainerName
                  ? "다른 트레이너로 변경"
                  : "트레이너 코드 입력"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <TextInput
                  value={trainerCodeForm}
                  onChangeText={(v) => {
                    setTrainerCodeForm(v.toUpperCase());
                    setVerifiedTrainer(null);
                  }}
                  placeholder="예: ABC123"
                  placeholderTextColor={Colors.textPlaceholder}
                  autoCapitalize="characters"
                  style={{
                    flex: 1,
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: trainerCodeForm ? Colors.blue : Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                  }}
                />
                <TouchableOpacity
                  onPress={handleVerifyCode}
                  disabled={verifyingCode || !trainerCodeForm.trim()}
                  style={{
                    backgroundColor: trainerCodeForm.trim()
                      ? Colors.blue
                      : Colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                    opacity: verifyingCode ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}
                  >
                    {verifyingCode ? "확인 중" : "코드 확인"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 코드 확인 결과 미리보기 */}
              {verifiedTrainer && (
                <View
                  style={{
                    backgroundColor: Colors.greenLight,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: Colors.green + "44",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text style={{ fontSize: 18 }}></Text>
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: Colors.text,
                      }}
                    >
                      {verifiedTrainer.trainerName} 트레이너
                    </Text>
                    {verifiedTrainer.gymName ? (
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                        {verifiedTrainer.gymName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowTrainerCodeModal(false);
                    setVerifiedTrainer(null);
                    setTrainerCodeForm("");
                  }}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>
                    취소
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleConnectTrainer}
                  disabled={connectingTrainer || !verifiedTrainer}
                  style={{
                    flex: 2,
                    backgroundColor: verifiedTrainer
                      ? Colors.green
                      : Colors.border,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                    opacity: connectingTrainer ? 0.7 : 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: verifiedTrainer ? "#fff" : Colors.textMuted,
                    }}
                  >
                    {connectingTrainer ? "연결 중..." : "이 트레이너로 연결"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: Colors.textMuted,
        marginBottom: 6,
        marginTop: 2,
      }}
    >
      {title.toUpperCase()}
    </Text>
  );
}

function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  bold,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  bold?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: description ? 12 : 16,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            color: Colors.text,
            fontWeight: bold ? "700" : "600",
          }}
        >
          {label}
        </Text>
        {description && (
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 3 }}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onValueChange}
        trackColor={{ true: Colors.blue }}
        thumbColor="#fff"
      />
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
        <Text style={{ fontSize: 13, color: Colors.textMuted }}>{value}</Text>
      )}

      {!value && (
        <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
      )}
    </TouchableOpacity>
  );
}
