import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { PRIVACY_TEXT, TERMS_TEXT } from "../../../constants/terms";
import { apiGet } from "../../../hooks/useApi";
import { TrainerProfile } from "../../../types";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 30분 단위 시간 옵션 (05:00 ~ 24:00)
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 24) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

export default function TrainerMoreScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    gymName: "",
    workDays: [] as number[],
    startTime: "09:00",
    endTime: "22:00",
    affiliateCode: "",
    verifiedGymName: "",
  });
  const [affiliateVerifying, setAffiliateVerifying] = useState(false);
  const [isAffiliated, setIsAffiliated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifWorkout, setNotifWorkout] = useState(true);
  const [notifDiet, setNotifDiet] = useState(true);
  const [notifNewMember, setNotifNewMember] = useState(true);
  const [notifBirthday, setNotifBirthday] = useState(true);
  const [notifMissionDone, setNotifMissionDone] = useState(true);
  const [notifPersonalWorkout, setNotifPersonalWorkout] = useState(true);
  const [plan, setPlan] = useState<"FREE" | "PRO">("FREE");
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);

  // 이용약관 / 개인정보처리방침 모달
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsContent, setTermsContent] = useState({ title: "", text: "" });

  // 사용가이드 열기
  const openGuide = () => {
    router.push("/(tabs)/trainer/guide" as any);
  };


  // 문의하기
  const [inquiryVisible, setInquiryVisible] = useState(false);
  const [inquiryTab, setInquiryTab] = useState<"write" | "list">("write");
  const [inquiryTitle, setInquiryTitle] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inquiries, setInquiries] = useState<any[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      // 알림 설정 불러오기
      const pairs = await AsyncStorage.multiGet([
        "notif_push",
        "notif_workout",
        "notif_diet",
        "notif_new_member",
      ]);
      if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
      if (pairs[1][1] !== null) setNotifWorkout(pairs[1][1] === "true");
      if (pairs[2][1] !== null) setNotifDiet(pairs[2][1] === "true");
      if (pairs[3][1] !== null) setNotifNewMember(pairs[3][1] === "true");

      // 생일 알림은 서버에서 불러옴
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const notifRes = await fetch(`${API_URL}/api/trainer/notif-settings`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (notifRes.ok) {
          const notifData = await notifRes.json();
          setNotifBirthday(notifData.notifBirthday !== false);
          setNotifMissionDone(notifData.notifMissionDone !== false);

          if (typeof notifData.notifWorkout === "boolean") {
            setNotifWorkout(notifData.notifWorkout);
            await AsyncStorage.setItem(
              "notif_workout",
              String(notifData.notifWorkout),
            );
          }
          if (typeof notifData.notifPersonalWorkout === "boolean") {
            setNotifPersonalWorkout(notifData.notifPersonalWorkout);
          }
          if (typeof notifData.notifDiet === "boolean") {
            setNotifDiet(notifData.notifDiet);
            await AsyncStorage.setItem(
              "notif_diet",
              String(notifData.notifDiet),
            );
          }
          if (typeof notifData.notifNewMember === "boolean") {
            setNotifNewMember(notifData.notifNewMember);
            await AsyncStorage.setItem(
              "notif_new_member",
              String(notifData.notifNewMember),
            );
          }
        }
      } catch {}

      // RevenueCat 구독 상태 확인
      try {
        if (Purchases && typeof Purchases.getCustomerInfo === "function") {
          const info = await Purchases.getCustomerInfo();
          const isPro =
            typeof info.entitlements.active["FitLogApp Pro"] !== "undefined";
          if (isPro) setPlan("PRO");
        }
      } catch (e) {
        console.log("RevenueCat 상태 확인 실패:", e);
      }

      // 백엔드 plan도 확인 (RevenueCat 미인식 시 대비)
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const homeRes = await fetch(`${API_URL}/api/trainer/home`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (homeRes.ok) {
          const homeData = await homeRes.json();
          if ((homeData.plan ?? "").toUpperCase() === "PRO") setPlan("PRO");
          setTrialEndDate(homeData.trialEndDate ?? null);
        }
      } catch {}

      try {
        const data = await apiGet<TrainerProfile>(ENDPOINTS.profile.trainer);
        setProfile(data);
        setIsAffiliated(data.gymAffiliated ?? false);
        const workDayIndices = (data.workDays || "")
          .split(",")
          .map((d) => DAYS.indexOf(d.trim()))
          .filter((i) => i >= 0);
        setEditForm({
          gymName: data.gymName,
          workDays: workDayIndices,
          startTime: data.startTime,
          endTime: data.endTime,
          affiliateCode: "",
          verifiedGymName: data.affiliatedGymName ?? "",
        });
      } catch {
        setProfile({
          id: 1,
          name: "트레이너",
          gymName: "",
          workDays: "월,화,수,목,금",
          startTime: "09:00",
          endTime: "22:00",
          trainerCode: "---",
        });
        setEditForm({
          gymName: "",
          workDays: [0, 1, 2, 3, 4],
          startTime: "09:00",
          endTime: "22:00",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // 알림 설정 서버 저장 헬퍼
  const patchNotifSettings = async (body: Record<string, boolean>) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      await fetch(`${API_URL}/api/trainer/notif-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      console.log("알림 설정 서버 저장 실패:", e);
    }
  };

  // 알림 설정 저장
  const handleNotifPush = async (v: boolean) => {
    setNotifPush(v);
    AsyncStorage.setItem("notif_push", String(v));
    if (!v) {
      // 전체 알림 끄면 세부 항목도 모두 끔
      setNotifWorkout(false);
      setNotifDiet(false);
      setNotifNewMember(false);
      setNotifPersonalWorkout(false);
      AsyncStorage.multiSet([
        ["notif_workout", "false"],
        ["notif_diet", "false"],
        ["notif_new_member", "false"],
      ]);
      await patchNotifSettings({
        notifWorkout: false,
        notifDiet: false,
        notifNewMember: false,
        notifPersonalWorkout: false,
      });
      handleNotifBirthday(false, false);
      handleNotifMissionDone(false, false);
    } else {
      // 전체 알림 켜면 세부 항목도 모두 켬
      setNotifWorkout(true);
      setNotifDiet(true);
      setNotifNewMember(true);
      setNotifPersonalWorkout(true);
      AsyncStorage.multiSet([
        ["notif_workout", "true"],
        ["notif_diet", "true"],
        ["notif_new_member", "true"],
      ]);
      await patchNotifSettings({
        notifWorkout: true,
        notifDiet: true,
        notifNewMember: true,
        notifPersonalWorkout: true,
      });
      handleNotifBirthday(true, false);
      handleNotifMissionDone(true, false);
    }
  };
  const handleNotifWorkout = async (v: boolean) => {
    setNotifWorkout(v);
    await AsyncStorage.setItem("notif_workout", String(v));
    await patchNotifSettings({ notifWorkout: v });
    if (v && !notifPush) handleNotifPush(true);
  };
  const handleNotifDiet = async (v: boolean) => {
    setNotifDiet(v);
    await AsyncStorage.setItem("notif_diet", String(v));
    await patchNotifSettings({ notifDiet: v });
    if (v && !notifPush) handleNotifPush(true);
  };
  const handleNotifNewMember = async (v: boolean) => {
    setNotifNewMember(v);
    await AsyncStorage.setItem("notif_new_member", String(v));
    await patchNotifSettings({ notifNewMember: v });
    if (v && !notifPush) handleNotifPush(true);
  };
  const handleNotifBirthday = async (v: boolean, turnOnPush = true) => {
    setNotifBirthday(v);
    if (v && turnOnPush && !notifPush) handleNotifPush(true);
    await patchNotifSettings({ notifBirthday: v });
  };
  const handleNotifMissionDone = async (v: boolean, turnOnPush = true) => {
    setNotifMissionDone(v);
    if (v && turnOnPush && !notifPush) handleNotifPush(true);
    await patchNotifSettings({ notifMissionDone: v });
  };
  const handleNotifPersonalWorkout = async (v: boolean) => {
    setNotifPersonalWorkout(v);
    await patchNotifSettings({ notifPersonalWorkout: v });
    if (v && !notifPush) handleNotifPush(true);
  };

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
          // 새로 확인된 코드가 있으면 전송, 없으면 null (기존 유지)
          affiliateCode: editForm.verifiedGymName && editForm.affiliateCode
            ? editForm.affiliateCode.trim().toUpperCase()
            : null,
        }),
      });

      if (!res.ok) throw new Error("프로필 수정 실패");

      const newAffiliated = !!(editForm.verifiedGymName && editForm.affiliateCode);
      setIsAffiliated(newAffiliated || isAffiliated);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              gymName: editForm.gymName,
              workDays: editForm.workDays.map((i) => DAYS[i]).join(","),
              startTime: editForm.startTime,
              endTime: editForm.endTime,
              gymAffiliated: newAffiliated || isAffiliated,
              affiliatedGymName: editForm.verifiedGymName || prev.affiliatedGymName,
            }
          : prev,
      );

      setShowEditModal(false);
      Alert.alert("완료", "프로필이 수정됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchInquiries = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/inquiry`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) setInquiries(await res.json());
    } catch {}
  };

  const submitInquiry = async () => {
    if (!inquiryTitle.trim()) {
      Alert.alert("오류", "제목을 입력해주세요.");
      return;
    }
    if (!inquiryContent.trim()) {
      Alert.alert("오류", "내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          title: inquiryTitle.trim(),
          content: inquiryContent.trim(),
        }),
      });
      if (!res.ok) throw new Error("문의 등록 실패");
      setInquiryTitle("");
      setInquiryContent("");
      await fetchInquiries();
      setInquiryTab("list");
      Alert.alert(
        "접수 완료 ✓",
        "문의가 접수됐어요.\n순서대로 답변해드릴게요!",
      );
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "다시 시도해주세요.");
    } finally {
      setSubmitting(false);
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

  const copyCode = () => {
    Clipboard.setString(profile?.trainerCode ?? "");
    Alert.alert("복사 완료", `트레이너 코드 ${profile?.trainerCode}가 복사됐어요.`);
  };

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
          paddingBottom: 36,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            marginBottom: 16,
          }}
        >
          더보기
        </Text>

        {/* 프로필 카드 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 16,
            padding: 14,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: Colors.green,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>
                {profile?.name?.[0] ?? "T"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "900",
                    color: Colors.text,
                  }}
                >
                  {profile?.name ?? "-"}
                </Text>
                {plan === "PRO" &&
                  (trialEndDate ? (
                    <View
                      style={{
                        backgroundColor: "#FEF3C7",
                        borderWidth: 1,
                        borderColor: "#FCD34D",
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: "#D97706",
                        }}
                      >
                        무료체험
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        backgroundColor: Colors.green,
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: "#fff",
                        }}
                      >
                        PRO
                      </Text>
                    </View>
                  ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  {profile?.gymName ?? "-"}
                </Text>
                {isAffiliated && (
                  <View style={{ backgroundColor: Colors.green + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.green }}>제휴</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: Colors.border,
                paddingHorizontal: 13,
                paddingVertical: 7,
                borderRadius: 10,
              }}
            >
              <Text
                style={{
                  color: Colors.textSub,
                  fontSize: 12,
                  fontWeight: "800",
                }}
              >
                수정
              </Text>
            </TouchableOpacity>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {(profile?.workDays || "").split(",").map((d) => (
              <View
                key={d}
                style={{
                  backgroundColor: Colors.greenLight,
                  borderWidth: 1,
                  borderColor: Colors.green + "44",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 7,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.green,
                    fontWeight: "700",
                  }}
                >
                  {d.trim()}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            {profile?.startTime} ~ {profile?.endTime}
          </Text>
        </View>
        {/* 트레이너 코드 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: Colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: Colors.textMuted,
                marginBottom: 3,
              }}
            >
              내 트레이너 코드
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "900",
                color: Colors.text,
                letterSpacing: 2,
              }}
            >
              {profile?.trainerCode ?? "---"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={copyCode}
            style={{
              backgroundColor: Colors.green,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 9,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
              복사
            </Text>
          </TouchableOpacity>
        </View>

        {/* 플랜 섹션 */}
        <SectionHeader title="플랜" />
        {plan === "PRO" && !trialEndDate ? (
          // 정식 구독 PRO
          <View
            style={{
              backgroundColor: Colors.greenLight,
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: Colors.green + "44",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <View
              style={{
                backgroundColor: Colors.green,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: "900", color: "#fff" }}>
                PRO
              </Text>
            </View>
            <Text
              style={{ fontSize: 13, fontWeight: "700", color: Colors.green, flex: 1 }}
            >
              PRO 플랜 구독 중 · 회원 무제한
            </Text>
            <TouchableOpacity
              onPress={() =>
                Alert.alert(
                  "구독 관리",
                  "구독을 취소하면 현재 결제 기간 만료 후 무료 플랜(회원 5명)으로 전환돼요.",
                  [
                    { text: "닫기", style: "cancel" },
                    {
                      text: "구독 취소하기",
                      style: "destructive",
                      onPress: () => {
                        const url = Platform.OS === "ios"
                          ? "https://apps.apple.com/account/subscriptions"
                          : "https://play.google.com/store/account/subscriptions";
                        Linking.openURL(url);
                      },
                    },
                  ]
                )
              }
            >
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>구독 취소</Text>
            </TouchableOpacity>
          </View>
        ) : plan === "PRO" && trialEndDate ? (
          // 무료 체험 중
          (() => {
            const ended = new Date(trialEndDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            ended.setHours(0, 0, 0, 0);
            const daysLeft = Math.max(
              0,
              Math.ceil(
                (ended.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
              ),
            );
            return (
              <View
                style={{
                  backgroundColor: "#FFFBEB",
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: "#FCD34D",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        backgroundColor: "#F59E0B",
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{ fontSize: 10, fontWeight: "900", color: "#fff" }}
                      >
                        무료체험
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#92400E",
                      }}
                    >
                      {daysLeft}일 남았어요 · 회원 무제한 이용 중
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setPaymentVisible(true)}
                    style={{
                      backgroundColor: "#F59E0B",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>
                      PRO 구독
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 11, color: "#B45309" }}>
                  체험 종료 후 무료 플랜(회원 5명)으로 전환돼요.{"\n"}구독하면
                  계속 무제한으로 사용할 수 있어요.
                </Text>
              </View>
            );
          })()
        ) : (
          <View
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 14,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: Colors.border,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  PRO 플랜
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  회원 무제한 · 월 14,900원 · 첫 가입 1개월 무료
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentVisible(true)}
                style={{
                  backgroundColor: Colors.green,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}
                >
                  PRO 구독
                </Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 1, backgroundColor: Colors.border }} />
            <Text
              style={{
                fontSize: 11,
                color: Colors.textMuted,
                paddingHorizontal: 14,
                paddingVertical: 9,
              }}
            >
              현재 무료 플랜 · 회원 최대 5명
            </Text>
          </View>
        )}

        {/* 알림 설정 */}
        <SectionHeader title="알림 설정" />
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 5,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <SwitchRow
            label="전체 푸시 알림"
            value={notifPush}
            onValueChange={handleNotifPush}
            color={Colors.green}
            bold
          />
        </View>
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
            opacity: notifPush ? 1 : 0.4,
          }}
        >
          <SwitchRow
            label="개인 운동 기록"
            desc="회원이 개인 운동을 기록하면 트레이너에게 알림"
            value={notifPersonalWorkout}
            onValueChange={handleNotifPersonalWorkout}
            color={Colors.green}
            disabled={!notifPush}
          />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <SwitchRow
            label="식단 사진"
            desc="회원이 식단 사진을 올리면 알림"
            value={notifDiet}
            onValueChange={handleNotifDiet}
            color={Colors.green}
            disabled={!notifPush}
          />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <SwitchRow
            label="신규 회원 연결"
            desc="새 회원이 코드로 연결되면 알림"
            value={notifNewMember}
            onValueChange={handleNotifNewMember}
            color={Colors.green}
            disabled={!notifPush}
          />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <SwitchRow
            label="회원 생일 알림"
            desc="생일 당일·7일 전 트레이너에게 알림"
            value={notifBirthday}
            onValueChange={(v) => handleNotifBirthday(v)}
            color={Colors.green}
            disabled={!notifPush}
          />
          <SwitchRow
            label="챌린지 완료 알림"
            desc="회원이 챌린지를 완료하면 알림"
            value={notifMissionDone}
            onValueChange={(v) => handleNotifMissionDone(v)}
            color={Colors.green}
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
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <InfoRow label="버전" value="1.0.0" />
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <TouchableOpacity
            onPress={openGuide}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, color: Colors.text }}>사용가이드</Text>
            <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <TouchableOpacity
            onPress={() => Linking.openURL("https://dlatoquf.github.io/FitLogApp/terms.html")}
          >
            <InfoRow label="이용약관" />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <TouchableOpacity
            onPress={() => Linking.openURL("https://dlatoquf.github.io/FitLogApp/privacy.html")}
          >
            <InfoRow label="개인정보처리방침" />
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: Colors.border }} />
          <TouchableOpacity
            onPress={() => {
              setInquiryTab("write");
              setInquiryVisible(true);
              fetchInquiries();
            }}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
            }}
          >
            <Text style={{ fontSize: 14, color: Colors.text }}>문의하기</Text>
            <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
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
                      const res = await fetch(`${API_URL}/api/trainer/me`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${jwt}` },
                      });
                      if (!res.ok) throw new Error("계정 삭제 실패");
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
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowEditModal(false)}
            />
            <GestureDetector
              gesture={Gesture.Pan().onEnd((e) => {
                if (e.translationY > 60) setShowEditModal(false);
              })}
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
                    marginBottom: 16,
                  }}
                >
                  프로필 수정
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  헬스장명
                </Text>
                <TextInput
                  value={editForm.gymName}
                  onChangeText={(v) =>
                    setEditForm((f) => ({ ...f, gymName: v }))
                  }
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 14,
                  }}
                />

                {/* 제휴 코드 */}
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>
                  제휴 코드 {profile?.gymAffiliated ? "(변경 시 입력)" : "(선택)"}
                </Text>
                {profile?.gymAffiliated && !editForm.verifiedGymName && (
                  <View style={{ backgroundColor: Colors.greenLight, borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.green + "44" }}>
                    <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "600" }}>
                      현재 제휴: {profile.affiliatedGymName}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: editForm.verifiedGymName ? 6 : 14 }}>
                  <TextInput
                    value={editForm.affiliateCode}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, affiliateCode: v, verifiedGymName: "" }))}
                    placeholder={profile?.gymAffiliated ? "새 코드 입력" : "제휴 코드 입력"}
                    autoCapitalize="characters"
                    style={{
                      flex: 1,
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: editForm.verifiedGymName ? Colors.green : Colors.border,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                      color: Colors.text,
                    }}
                  />
                  <TouchableOpacity
                    onPress={async () => {
                      if (!editForm.affiliateCode.trim()) return;
                      setAffiliateVerifying(true);
                      try {
                        const jwt = await AsyncStorage.getItem("jwt");
                        const res = await fetch(`${API_URL}/api/gym/verify?code=${encodeURIComponent(editForm.affiliateCode.trim().toUpperCase())}`, {
                          headers: { Authorization: `Bearer ${jwt}` },
                        });
                        const data = await res.json();
                        if (data.valid) {
                          setEditForm((f) => ({ ...f, verifiedGymName: data.gymName }));
                        } else {
                          Alert.alert("확인 실패", data.message ?? "유효하지 않은 제휴 코드예요.");
                          setEditForm((f) => ({ ...f, verifiedGymName: "" }));
                        }
                      } catch {
                        Alert.alert("오류", "제휴 코드 확인 중 오류가 발생했어요.");
                      } finally {
                        setAffiliateVerifying(false);
                      }
                    }}
                    disabled={!editForm.affiliateCode.trim() || affiliateVerifying}
                    style={{
                      backgroundColor: editForm.verifiedGymName ? Colors.green : Colors.bgSub,
                      borderWidth: 1,
                      borderColor: editForm.verifiedGymName ? Colors.green : Colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: editForm.verifiedGymName ? "#fff" : Colors.textMuted }}>
                      {affiliateVerifying ? "..." : editForm.verifiedGymName ? "✓" : "확인"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {editForm.verifiedGymName ? (
                  <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "600", marginBottom: 14 }}>
                    제휴 헬스장: {editForm.verifiedGymName}
                  </Text>
                ) : null}

                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  근무 요일
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}
                >
                  {DAYS.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() =>
                        setEditForm((f) => ({
                          ...f,
                          workDays: f.workDays.includes(i)
                            ? f.workDays.filter((x) => x !== i)
                            : [...f.workDays, i],
                        }))
                      }
                      style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: editForm.workDays.includes(i)
                          ? Colors.green
                          : Colors.bgSub,
                        borderWidth: 1,
                        borderColor: editForm.workDays.includes(i)
                          ? Colors.green
                          : Colors.border,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: editForm.workDays.includes(i)
                            ? "#fff"
                            : Colors.textMuted,
                        }}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}
                >
                  {(["startTime", "endTime"] as const).map((key) => (
                    <View key={key} style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: Colors.textMuted,
                          marginBottom: 6,
                        }}
                      >
                        {key === "startTime" ? "출근" : "퇴근"}
                      </Text>
                      <ScrollView
                        style={{
                          height: 120,
                          backgroundColor: Colors.bgSub,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          borderRadius: 10,
                        }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {TIME_OPTIONS.map((t) => (
                          <TouchableOpacity
                            key={t}
                            onPress={() =>
                              setEditForm((f) => ({ ...f, [key]: t }))
                            }
                            style={{
                              padding: 10,
                              backgroundColor:
                                editForm[key] === t
                                  ? Colors.green
                                  : "transparent",
                              borderRadius: 8,
                              marginHorizontal: 4,
                              marginVertical: 2,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: editForm[key] === t ? "700" : "400",
                                color:
                                  editForm[key] === t ? "#fff" : Colors.text,
                              }}
                            >
                              {t}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
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
                      backgroundColor: Colors.green,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
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
            </GestureDetector>
          </KeyboardAvoidingView>
        </Modal>

        {/* 업그레이드 바텀시트 */}
        <Modal
          visible={paymentVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setPaymentVisible(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            activeOpacity={1}
            onPress={() => setPaymentVisible(false)}
          >
            <GestureDetector
              gesture={Gesture.Pan().onEnd((e) => {
                if (e.translationY > 80) setPaymentVisible(false);
              })}
            >
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 28,
                  paddingBottom: Math.max(insets.bottom, 28),
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                    alignSelf: "center",
                    marginBottom: 20,
                  }}
                />

                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: "800",
                    color: Colors.text,
                    marginBottom: 4,
                  }}
                >
                  PRO 플랜으로 업그레이드
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginBottom: 20,
                    lineHeight: 20,
                  }}
                >
                  무료 플랜은 회원을 최대 5명까지 등록할 수 있어요.{"\n"}PRO로
                  업그레이드하면 회원 수 제한이 없어져요.
                  {isAffiliated ? "\n제휴 헬스장 회원 특별가가 적용됐어요." : ""}
                </Text>

                {/* PRO 단일 카드 */}
                <View
                  style={{
                    borderRadius: 16,
                    padding: 20,
                    borderWidth: 1.5,
                    borderColor: Colors.green + "55",
                    backgroundColor: Colors.greenLight,
                    marginBottom: 20,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: Colors.green,
                      }}
                    >
                      PRO
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "flex-end",
                        gap: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 26,
                          fontWeight: "900",
                          color: Colors.green,
                        }}
                      >
                        {isAffiliated ? "11,900" : "14,900"}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.green,
                          marginBottom: 3,
                        }}
                      >
                        원/월
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      color: Colors.textSub,
                      lineHeight: 22,
                    }}
                  >
                    ✓ 회원 무제한{"\n"}(무료 플랜: 최대 5명)
                  </Text>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        if (
                          !Purchases ||
                          typeof Purchases.getOfferings !== "function"
                        ) {
                          Alert.alert("오류", "결제 모듈을 불러오지 못했어요.");
                          return;
                        }
                        const offerings = await Purchases.getOfferings();
                        const pkg = isAffiliated
                          ? offerings.current?.availablePackages.find(
                              (p: any) => p.identifier === "pro_monthly_affiliate",
                            ) ?? offerings.current?.monthly
                          : offerings.current?.monthly ??
                            offerings.current?.availablePackages[0];
                        if (!pkg) {
                          Alert.alert("오류", "구독 상품을 불러오지 못했어요.");
                          return;
                        }
                        await Purchases.purchasePackage(pkg);
                        setPlan("PRO");
                        setPaymentVisible(false);
                        Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                        setTimeout(() => fetchProfile(), 3000);
                      } catch (e: any) {
                        if (!e.userCancelled)
                          Alert.alert(
                            "결제 실패",
                            e.message ?? "다시 시도해주세요.",
                          );
                      }
                    }}
                    style={{
                      marginTop: 16,
                      backgroundColor: Colors.green,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}
                    >
                      시작하기
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const customerInfo = await Purchases.restorePurchases();
                      if (customerInfo.entitlements.active["FitLogApp Pro"]) {
                        setPlan("PRO");
                        setPaymentVisible(false);
                        Alert.alert("복원 완료", "구독이 복원됐어요.");
                        setTimeout(() => fetchProfile(), 2000);
                      } else {
                        Alert.alert("복원 없음", "복원할 구독이 없어요.");
                      }
                    } catch (e: any) {
                      Alert.alert("오류", e?.message ?? "복원에 실패했어요.");
                    }
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: 14,
                      color: Colors.textMuted,
                    }}
                  >
                    구독 복원하기
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginTop: 12 }}
                  onPress={() => setPaymentVisible(false)}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: 14,
                      color: Colors.textMuted,
                    }}
                  >
                    나중에 할게요
                  </Text>
                </TouchableOpacity>
              </View>
            </GestureDetector>
          </TouchableOpacity>
        </Modal>
        {/* ── 문의하기 모달 ───────────────────────────────────────────────────── */}
        <Modal
          visible={inquiryVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setInquiryVisible(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setInquiryVisible(false)}
            />
            <GestureDetector
              gesture={Gesture.Pan().onEnd((e) => {
                if (e.translationY > 60) setInquiryVisible(false);
              })}
            >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
                maxHeight: "90%",
              }}
            >
              <View style={{ alignItems: "center", paddingBottom: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                  }}
                />
              </View>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 16,
                }}
              >
                문의하기
              </Text>

              {/* 탭 */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: Colors.bgSub,
                  borderRadius: 10,
                  padding: 3,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                {(
                  [
                    { key: "write", label: "문의 작성" },
                    { key: "list", label: "내 문의" },
                  ] as const
                ).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => {
                      setInquiryTab(tab.key);
                      if (tab.key === "list") fetchInquiries();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor:
                        inquiryTab === tab.key ? "#fff" : "transparent",
                      alignItems: "center",
                      elevation: inquiryTab === tab.key ? 2 : 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color:
                          inquiryTab === tab.key
                            ? Colors.text
                            : Colors.textMuted,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {inquiryTab === "write" ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    제목
                  </Text>
                  <TextInput
                    value={inquiryTitle}
                    onChangeText={setInquiryTitle}
                    placeholder="문의 제목을 입력해주세요"
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: Colors.text,
                      marginBottom: 14,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    내용
                  </Text>
                  <TextInput
                    value={inquiryContent}
                    onChangeText={setInquiryContent}
                    placeholder="문의 내용을 자세히 입력해주세요"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: Colors.text,
                      minHeight: 140,
                      marginBottom: 20,
                    }}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setInquiryVisible(false)}
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
                      onPress={submitInquiry}
                      disabled={submitting}
                      style={{
                        flex: 2,
                        backgroundColor: Colors.green,
                        borderRadius: 12,
                        padding: 14,
                        alignItems: "center",
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#fff",
                        }}
                      >
                        {submitting ? "접수 중..." : "문의 접수"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {inquiries.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 40 }}>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                        아직 문의 내역이 없어요
                      </Text>
                    </View>
                  ) : (
                    inquiries.map((inq) => (
                      <View
                        key={inq.id}
                        style={{
                          backgroundColor: Colors.bgSub,
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: Colors.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "800",
                              color: Colors.text,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {inq.title}
                          </Text>
                          <View
                            style={{
                              backgroundColor:
                                inq.status === "ANSWERED"
                                  ? Colors.green
                                  : "#F59E0B",
                              borderRadius: 6,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              marginLeft: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: "#fff",
                              }}
                            >
                              {inq.status === "ANSWERED"
                                ? "답변완료"
                                : "검토중"}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            fontSize: 12,
                            color: Colors.textMuted,
                            marginBottom: 6,
                          }}
                        >
                          {inq.createdAt}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: Colors.textSub,
                            lineHeight: 20,
                          }}
                          numberOfLines={3}
                        >
                          {inq.content}
                        </Text>
                        {inq.status === "ANSWERED" && inq.answer && (
                          <View
                            style={{
                              marginTop: 10,
                              backgroundColor: Colors.greenLight,
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: Colors.green,
                                marginBottom: 4,
                              }}
                            >
                              답변
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                color: Colors.text,
                                lineHeight: 19,
                              }}
                            >
                              {inq.answer}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                  <TouchableOpacity
                    onPress={() => setInquiryVisible(false)}
                    style={{ marginTop: 8, alignItems: "center", padding: 14 }}
                  >
                    <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                      닫기
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
            </GestureDetector>
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
        fontSize: 13,
        fontWeight: "800",
        color: Colors.textSub,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {title}
    </Text>
  );
}

function SwitchRow({
  label,
  desc,
  value,
  onValueChange,
  color,
  bold,
  disabled,
}: {
  label: string;
  desc?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  color: string;
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
        paddingVertical: desc ? 12 : 16,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text
          style={{
            fontSize: 14,
            color: Colors.text,
            fontWeight: bold ? "700" : "400",
          }}
        >
          {label}
        </Text>
        {desc && (
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
            {desc}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={disabled ? undefined : onValueChange}
        trackColor={{ true: color }}
        thumbColor="#fff"
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>
      {value ? (
        <Text style={{ fontSize: 13, color: Colors.textMuted }}>{value}</Text>
      ) : (
        <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
      )}
    </View>
  );
}
