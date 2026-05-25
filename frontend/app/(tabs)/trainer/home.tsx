import AsyncStorage from "@react-native-async-storage/async-storage";
import KakaoShare from "@react-native-kakao/share";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Purchases from "react-native-purchases";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

interface TodayPt {
  memberId: number;
  memberName: string;
  time: string;
  ptRemaining: number;
  completed?: boolean;
}

interface HomeData {
  trainerId: number;
  trainerName: string;
  totalMembers: number;
  todaySchedules: number;
  todayPtList: TodayPt[];
  trainerCode: string;
  plan: string;
  goalSessions: number | null;
  goalRevenue: number | null;
  monthSessions: number;
  monthRevenue: number;
  monthRevenueDetails: { memberName: string; sessions: number; amount: number; memo?: string }[];
  noShowCount: number;
}

interface Member {
  id: number;
  user: { name: string };
  ptRemaining: number;
}

interface Noti {
  notificationId: number;
  type: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const NOTI_ICON: Record<string, string> = {
  WORKOUT_LOG: "💪",
  SCHEDULE: "📅",
  FEEDBACK: "💬",
  PT_EXPIRY: "⏰",
  GENERAL: "🔔",
};

export default function TrainerHomeScreen() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [notifications, setNotifications] = useState<Noti[]>([]);
  const [paymentVisible, setPaymentVisible] = useState(false);

  // 목표 설정 모달
  const [goalModal, setGoalModal] = useState(false);
  const [goalSessionsInput, setGoalSessionsInput] = useState("");
  const [goalRevenueInput, setGoalRevenueInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);

  // 결제 추가 모달
  const [payAddModal, setPayAddModal] = useState(false);
  const [payMembers, setPayMembers] = useState<Member[]>([]);
  const [payMembersLoading, setPayMembersLoading] = useState(false);
  const [paySelectedMember, setPaySelectedMember] = useState<Member | null>(null);
  const [paySessionsInput, setPaySessionsInput] = useState("");
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payMemoInput, setPayMemoInput] = useState("");
  const [addingPay, setAddingPay] = useState(false);

  // ── 초대 버튼 핸들러 ──────────────────────────────────────────────────────
  const handleInvitePress = () => {
    const limit = 3; // FREE 플랜 3명까지 가능
    const plan = (data?.plan ?? "FREE").toUpperCase();

    // PRO는 회원 수 제한 없이 바로 초대 가능
    if (plan === "PRO") {
      setInviteVisible(true);
      return;
    }

    // FREE만 제한 도달 시 업그레이드 바텀시트 오픈
    if ((data?.totalMembers ?? 0) >= limit) {
      setPaymentVisible(true);
    } else {
      setInviteVisible(true);
    }
  };

  const inviteDragGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationY > 60) {
        setInviteVisible(false);
      }
    });

  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };
      const [homeRes, notiRes] = await Promise.all([
        fetch(`${API_URL}/api/trainer/home`, { headers }),
        fetch(`${API_URL}/api/notifications`, { headers }),
      ]);
      if (!homeRes.ok) throw new Error("홈 데이터 조회 실패");
      const homeData = await homeRes.json();
      setData(homeData);

      // 결제 추가용 회원 목록 미리 로드
      try {
        const membersRes = await fetch(`${API_URL}/api/trainer/members`, { headers });
        if (membersRes.ok) setPayMembers(await membersRes.json());
      } catch {}

      // RevenueCat 초기화 + 트레이너 userId 연결
      try {
        if (Purchases && typeof Purchases.configure === "function") {
          const revenueCatKey = Platform.OS === "ios"
            ? "appl_vMgKlaKdscTldAQsfRPuZuXlXLT"
            : "goog_ANDROID_KEY_HERE"; // TODO: RevenueCat 대시보드에서 Android 키 발급 후 교체
          await Purchases.configure({
            apiKey: revenueCatKey,
          });
          const jwt = await AsyncStorage.getItem("jwt");
          if (jwt) {
            const payload = JSON.parse(atob(jwt.split(".")[1]));
            const userId = String(payload.sub ?? payload.userId ?? payload.id);
            await Purchases.logIn(userId);
          }
        }
      } catch (e) {
        console.log("RevenueCat 초기화 실패:", e);
      }
      if (notiRes.ok) setNotifications((await notiRes.json()).slice(0, 10));
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveGoals = async () => {
    setSavingGoal(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/goals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          goalSessions: goalSessionsInput ? parseInt(goalSessionsInput) : null,
          goalRevenue: goalRevenueInput ? parseInt(goalRevenueInput.replace(/,/g, "")) : null,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setGoalModal(false);
      fetchHome();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSavingGoal(false);
    }
  };

  const openPayModal = async () => {
    setPaySelectedMember(null);
    setPaySessionsInput("");
    setPayAmountInput("");
    setPayMemoInput("");
    setPayMembers([]);
    setPayMembersLoading(true);
    setPayAddModal(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/members`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) setPayMembers(await res.json());
    } catch {}
    finally { setPayMembersLoading(false); }
  };

  const addPayment = async () => {
    if (!paySelectedMember) { Alert.alert("알림", "회원을 선택해주세요."); return; }
    if (!paySessionsInput) { Alert.alert("알림", "수업 수를 입력해주세요."); return; }
    if (!payAmountInput) { Alert.alert("알림", "금액을 입력해주세요."); return; }
    setAddingPay(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/members/${paySelectedMember.id}/pt/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          sessions: parseInt(paySessionsInput),
          amount: parseInt(payAmountInput.replace(/,/g, "")),
          memo: payMemoInput.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("결제 추가 실패");
      setPayAddModal(false);
      setPaySelectedMember(null);
      setPaySessionsInput("");
      setPayAmountInput("");
      setPayMemoInput("");
      fetchHome();
      Alert.alert("완료", `${paySelectedMember.user.name}님 결제가 추가됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAddingPay(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchHome(); }, []));

  const handleCopy = () => {
    const code = data?.trainerCode ?? "";
    Clipboard.setString(code);
    Alert.alert("복사됐어요!", `트레이너 코드 ${code} 가 복사됐어요.`);
  };

  const handleKakaoShare = async () => {
    const code = data?.trainerCode ?? "";
    const trainerName = data?.trainerName ?? "트레이너";
    try {
      await KakaoShare.shareTextTemplate({
        template: {
          text: `안녕하세요! ${trainerName} 트레이너입니다 💪\n\nFitlog 앱에서 아래 코드를 입력하면 바로 연결돼요!\n\n트레이너 코드: ${code}`,
          link: {
            mobileWebUrl: "https://fitlog.app",
            webUrl: "https://fitlog.app",
          },
        },
      });
    } catch {
      Alert.alert("카카오톡 공유 실패", "코드를 복사해서 공유해주세요.", [
        { text: "코드 복사", onPress: handleCopy },
        { text: "닫기" },
      ]);
    }
  };

  const markAllRead = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

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
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchHome(true)}
            tintColor={Colors.green}
          />
        }
      >
        {/* 인사 + 알림 버튼 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <View>
            <Text
              style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}
            >
              안녕하세요 👋
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}
              >
                {data?.trainerName ?? "-"}님
              </Text>
              {(data?.plan ?? "FREE").toUpperCase() === "PRO" && (
                <View
                  style={{
                    backgroundColor: Colors.greenLight,
                    borderWidth: 1,
                    borderColor: Colors.green + "44",
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "900",
                      color: Colors.green,
                    }}
                  >
                    PRO
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/trainer/notifications")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor:
                unreadCount > 0 ? Colors.greenLight : Colors.bgSub,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor:
                unreadCount > 0 ? Colors.green + "44" : Colors.border,
              marginTop: 6,
            }}
          >
            {/* 커스텀 종 아이콘 */}
            <View
              style={{
                width: 18,
                height: 18,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 10,
                  backgroundColor:
                    unreadCount > 0 ? Colors.green : Colors.textMuted,
                  borderRadius: 6,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              />
              <View
                style={{
                  width: 14,
                  height: 3,
                  backgroundColor:
                    unreadCount > 0 ? Colors.green : Colors.textMuted,
                  borderRadius: 1,
                }}
              />
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  borderWidth: 1.5,
                  borderColor:
                    unreadCount > 0 ? Colors.green : Colors.textMuted,
                  marginTop: 1,
                }}
              />
            </View>
            {unreadCount > 0 ? (
              <View
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 5,
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}
                >
                  {unreadCount}
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  fontWeight: "600",
                }}
              >
                알림
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 회원 초대 버튼 */}
        <TouchableOpacity
          onPress={handleInvitePress}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: Colors.green,
            borderRadius: 12,
            paddingVertical: 12,
            marginBottom: 20,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
            🔗 회원 초대하기
          </Text>
        </TouchableOpacity>

        {/* 상단 요약: 총 회원 + 오늘 PT + 노쇼 */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.green }}>{data?.totalMembers ?? 0}</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>총 회원</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.blue }}>{data?.todaySchedules ?? 0}</Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>오늘 PT</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: (data?.noShowCount ?? 0) > 0 ? "#FEF2F2" : Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: (data?.noShowCount ?? 0) > 0 ? "#FECACA" : Colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 22, fontWeight: "900", color: (data?.noShowCount ?? 0) > 0 ? Colors.red : Colors.textMuted }}>{data?.noShowCount ?? 0}</Text>
            <Text style={{ fontSize: 12, color: (data?.noShowCount ?? 0) > 0 ? Colors.red : Colors.textMuted, marginTop: 2 }}>노쇼</Text>
          </View>
        </View>

        {/* 목표 미설정 시 입력 유도 */}
        {(data?.goalSessions == null && data?.goalRevenue == null) ? (
          <>
            <TouchableOpacity
              onPress={() => {
                setGoalSessionsInput("");
                setGoalRevenueInput("");
                setGoalModal(true);
              }}
              style={{ backgroundColor: Colors.greenLight, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.green + "55", borderStyle: "dashed", padding: 18, alignItems: "center", marginBottom: 10 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.green, marginBottom: 4 }}>이번 달 목표를 설정해주세요</Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>목표 수업 수와 목표 매출을 입력하면 진행률을 볼 수 있어요</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { openPayModal(); }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingVertical: 12, marginBottom: 16, backgroundColor: Colors.bgSub }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub }}>+ 결제 추가</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* 이번 달 수업 수 */}
            <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>이번 달 수업</Text>
                <TouchableOpacity onPress={() => { setGoalSessionsInput(String(data?.goalSessions ?? "")); setGoalRevenueInput((data?.goalRevenue ?? 0) > 0 ? (data!.goalRevenue!).toLocaleString() : ""); setGoalModal(true); }}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>목표 수정</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.green }}>{data?.monthSessions ?? 0}</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>/ {data?.goalSessions ?? "-"}회</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green, marginLeft: "auto" }}>
                  {data?.goalSessions ? Math.round(((data?.monthSessions ?? 0) / data.goalSessions) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar pct={data?.goalSessions ? Math.round(((data?.monthSessions ?? 0) / data.goalSessions) * 100) : 0} color={Colors.green} />
            </View>

            {/* 이번 달 매출 */}
            <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>이번 달 매출</Text>
                <TouchableOpacity
                  onPress={() => { openPayModal(); }}
                  style={{ backgroundColor: Colors.green, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>+ 결제 추가</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
                <Text style={{ fontSize: 24, fontWeight: "900", color: "#F59E0B" }}>
                  {(data?.monthRevenue ?? 0).toLocaleString()}원
                </Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                  / {data?.goalRevenue ? `${data.goalRevenue.toLocaleString()}원` : "-"}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#F59E0B", marginLeft: "auto" }}>
                  {data?.goalRevenue ? Math.round(((data?.monthRevenue ?? 0) / data.goalRevenue) * 100) : 0}%
                </Text>
              </View>
              <ProgressBar pct={data?.goalRevenue ? Math.round(((data?.monthRevenue ?? 0) / data.goalRevenue) * 100) : 0} color="#F59E0B" />
              {(data?.monthRevenueDetails ?? []).length > 0 && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 }}>
                  <ScrollView
                    style={{ maxHeight: 140 }}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {(data?.monthRevenueDetails ?? []).map((d, i) => (
                      <View key={i} style={{
                        paddingVertical: 6,
                        borderBottomWidth: i < (data?.monthRevenueDetails ?? []).length - 1 ? 1 : 0,
                        borderBottomColor: Colors.border + "55",
                      }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 13, color: Colors.textSub, fontWeight: "600" }}>{d.memberName}</Text>
                          <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                            {d.sessions}회{"  "}{d.amount.toLocaleString()}원
                          </Text>
                        </View>
                        {d.memo ? (
                          <Text style={{ fontSize: 12, color: Colors.textMuted, fontStyle: "italic", marginTop: 3 }}>
                            {d.memo}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </ScrollView>
                  {(data?.monthRevenueDetails ?? []).length > 3 && (
                    <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: "center", marginTop: 4 }}>스크롤해서 더 보기</Text>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {/* 오늘 PT 일정 */}
        <SectionTitle title="오늘 PT 일정" />
        {data?.todayPtList && data.todayPtList.length > 0 ? (
          [...data.todayPtList]
            .sort((a, b) => {
              const now = new Date();
              const [ah, am] = a.time.split(":").map(Number);
              const [bh, bm] = b.time.split(":").map(Number);

              // 시작 시간
              const aStartTime = new Date();
              aStartTime.setHours(ah, am, 0, 0);
              const bStartTime = new Date();
              bStartTime.setHours(bh, bm, 0, 0);

              // 종료 시간: PT 시작 + 1시간
              // 예: 14:00 수업은 15:00이 지나야 지난 일정으로 내려감
              const aEndTime = new Date();
              aEndTime.setHours(ah + 1, am, 0, 0);
              const bEndTime = new Date();
              bEndTime.setHours(bh + 1, bm, 0, 0);

              const aPast = a.completed || now > aEndTime;
              const bPast = b.completed || now > bEndTime;

              // 지난 일정은 아래로
              if (aPast && !bPast) return 1;
              if (!aPast && bPast) return -1;

              // 같은 그룹 안에서는 시작 시간순
              return aStartTime.getTime() - bStartTime.getTime();
            })
            .map((item) => (
              <TouchableOpacity
                key={`${item.memberId}-${item.time}`}
                onPress={() =>
                  router.push(
                    `/(tabs)/trainer/member-detail?id=${item.memberId}`,
                  )
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 10,
                  borderLeftWidth: 3,
                  borderLeftColor: Colors.green,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: Colors.green,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <Text
                    style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}
                  >
                    {item.memberName[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: Colors.text,
                    }}
                  >
                    {item.memberName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textMuted,
                      marginTop: 1,
                    }}
                  >
                    PT 수업 · 잔여 {item.ptRemaining}회
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: Colors.textSub,
                    }}
                  >
                    {item.time}
                  </Text>
                  <View
                    style={{
                      backgroundColor: item.completed
                        ? Colors.green
                        : Colors.blue + "22",
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: item.completed ? "#fff" : Colors.blue,
                      }}
                    >
                      {item.completed ? "완료" : "확정"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
        ) : (
          <View
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 12,
              padding: 20,
              alignItems: "center",
              borderWidth: 1,
              borderColor: Colors.border,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>
              오늘 예정된 PT가 없어요
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── 목표 설정 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={goalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setGoalModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setGoalModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <TouchableOpacity activeOpacity={1}>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 28,
                  paddingBottom: Platform.OS === "ios" ? 44 : 28,
                }}
              >
                {/* 핸들 바 */}
                <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />

                <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
                  이번 달 목표 설정
                </Text>
                <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 24 }}>
                  목표 수업 수와 목표 매출을 입력해주세요
                </Text>

                {/* 목표 수업 수 */}
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>목표 수업 수 (회)</Text>
                <TextInput
                  value={goalSessionsInput}
                  onChangeText={setGoalSessionsInput}
                  keyboardType="number-pad"
                  placeholder="예: 80"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 14,
                    fontSize: 16,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />

                {/* 목표 매출 */}
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>목표 매출 (원)</Text>
                <TextInput
                  value={goalRevenueInput}
                  onChangeText={(text) => {
                    const digits = text.replace(/[^0-9]/g, "");
                    setGoalRevenueInput(digits ? Number(digits).toLocaleString() : "");
                  }}
                  keyboardType="number-pad"
                  placeholder="예: 3,000,000"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 14,
                    fontSize: 16,
                    color: Colors.text,
                    marginBottom: 24,
                  }}
                />

                <TouchableOpacity
                  onPress={saveGoals}
                  disabled={savingGoal}
                  style={{
                    backgroundColor: Colors.green,
                    borderRadius: 12,
                    paddingVertical: 15,
                    alignItems: "center",
                    opacity: savingGoal ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                    {savingGoal ? "저장 중..." : "저장하기"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── 결제 추가 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={payAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPayAddModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setPayAddModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <TouchableOpacity activeOpacity={1}>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingTop: 20,
                  maxHeight: "90%",
                }}
              >
                {/* 핸들 바 */}
                <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingHorizontal: 28,
                    paddingBottom: Platform.OS === "ios" ? 44 : 28,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>결제 추가</Text>
                  <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 12 }}>회원을 선택하고 PT 수업 수와 금액을 입력해주세요</Text>

                  {/* 신규 회원 안내 */}
                  <TouchableOpacity
                    onPress={() => { setPayAddModal(false); router.push("/(tabs)/trainer/members"); }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: "#FFFBEB",
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#FCD34D",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      marginBottom: 20,
                    }}
                  >
                    <Text style={{ fontSize: 15 }}>⚠️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#92400E" }}>신규 회원이라면?</Text>
                      <Text style={{ fontSize: 11, color: "#B45309", marginTop: 1 }}>회원관리에서 먼저 추가한 뒤 결제를 등록해주세요 →</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 회원 선택 */}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 10 }}>회원 선택</Text>
                  {payMembersLoading ? (
                    <View style={{ height: 80, justifyContent: "center", alignItems: "center", marginBottom: 20 }}>
                      <ActivityIndicator size="small" color={Colors.green} />
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      style={{ height: 90, marginBottom: 20 }}
                      contentContainerStyle={{ gap: 8, paddingRight: 4, alignItems: "center" }}
                    >
                      {payMembers.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          onPress={() => setPaySelectedMember(m)}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: paySelectedMember?.id === m.id ? Colors.green : Colors.border,
                            backgroundColor: paySelectedMember?.id === m.id ? Colors.greenLight : Colors.bgSub,
                            alignItems: "center",
                            minWidth: 68,
                          }}
                        >
                          <View style={{
                            width: 34, height: 34, borderRadius: 10,
                            backgroundColor: paySelectedMember?.id === m.id ? Colors.green : "#D1D5DB",
                            justifyContent: "center", alignItems: "center", marginBottom: 4,
                          }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{m.user.name[0]}</Text>
                          </View>
                          <Text style={{
                            fontSize: 12, fontWeight: "700",
                            color: paySelectedMember?.id === m.id ? Colors.green : Colors.text,
                          }}>{m.user.name}</Text>
                        </TouchableOpacity>
                      ))}
                      {payMembers.length === 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setPayAddModal(false);
                            router.push("/(tabs)/trainer/members");
                          }}
                          style={{
                            backgroundColor: Colors.bgSub,
                            borderRadius: 12,
                            borderWidth: 1.5,
                            borderColor: Colors.border,
                            borderStyle: "dashed",
                            paddingHorizontal: 20,
                            paddingVertical: 14,
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text }}>등록된 회원이 없어요</Text>
                          <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: "center" }}>
                            회원 관리에서 회원을 먼저 추가해주세요
                          </Text>
                          <View style={{ marginTop: 6, backgroundColor: Colors.green, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>회원 관리로 이동 →</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </ScrollView>
                  )}

                  {/* 수업 수 */}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>PT 수업 수 (회)</Text>
                  <TextInput
                    value={paySessionsInput}
                    onChangeText={setPaySessionsInput}
                    keyboardType="number-pad"
                    placeholder="예: 20"
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: 14,
                      fontSize: 16,
                      color: Colors.text,
                      marginBottom: 16,
                    }}
                  />

                  {/* 금액 */}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>결제 금액 (원)</Text>
                  <TextInput
                    value={payAmountInput}
                    onChangeText={(text) => {
                      const digits = text.replace(/[^0-9]/g, "");
                      setPayAmountInput(digits ? Number(digits).toLocaleString() : "");
                    }}
                    keyboardType="number-pad"
                    placeholder="예: 600,000"
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: 14,
                      fontSize: 16,
                      color: Colors.text,
                      marginBottom: 16,
                    }}
                  />

                  {/* 메모 */}
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>메모 (선택)</Text>
                  <TextInput
                    value={payMemoInput}
                    onChangeText={setPayMemoInput}
                    placeholder="결제 관련 메모를 입력해주세요"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: 14,
                      fontSize: 14,
                      color: Colors.text,
                      marginBottom: 24,
                      minHeight: 66,
                      textAlignVertical: "top",
                    }}
                  />

                  <TouchableOpacity
                    onPress={addPayment}
                    disabled={addingPay}
                    style={{
                      backgroundColor: Colors.green,
                      borderRadius: 12,
                      paddingVertical: 15,
                      alignItems: "center",
                      opacity: addingPay ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                      {addingPay ? "추가 중..." : "결제 추가하기"}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* 초대 모달 */}
      <Modal
        visible={inviteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setInviteVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 28,
                paddingBottom: Platform.OS === "ios" ? 40 : 28,
              }}
            >
              <GestureDetector gesture={inviteDragGesture}>
                <TouchableOpacity
                  onPress={() => setInviteVisible(false)}
                  activeOpacity={0.8}
                  style={{
                    alignItems: "center",
                    paddingBottom: 12,
                    marginTop: -8,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      backgroundColor: Colors.border,
                      borderRadius: 99,
                    }}
                  />
                </TouchableOpacity>
              </GestureDetector>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 6,
                }}
              >
                회원 초대하기 🔗
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textMuted,
                  marginBottom: 24,
                }}
              >
                아래 코드를 회원에게 공유하면 자동으로 연결돼요
              </Text>
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  padding: 20,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  🔑 내 트레이너 코드
                </Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: Colors.green,
                    letterSpacing: 4,
                  }}
                >
                  {data?.trainerCode ?? "-"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleKakaoShare}
                style={{
                  backgroundColor: "#FEE500",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#3C1E1E" }}
                >
                  카카오톡으로 공유하기
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.text,
                  }}
                >
                  코드 복사하기
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* ── 결제 바텀시트 ──────────────────────────────────────────────────────
          TODO: 실제 결제 연동 시 각 버튼 onPress에 아래 연동 추가
          - 애플 인앱결제: react-native-iap 라이브러리 사용
          - 카카오페이: 카카오페이 SDK 또는 웹뷰 연동
          - 토스페이먼츠: 토스페이먼츠 SDK 연동
          현재는 UI만 구현된 상태 (Alert으로 준비 중 표시)
      ──────────────────────────────────────────────────────────────────────── */}
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
                paddingBottom: Platform.OS === "ios" ? 44 : 28,
              }}
            >
              {/* 핸들 바 */}
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

              <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
                PRO 플랜으로 업그레이드
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 20, lineHeight: 20 }}>
                무료 플랜은 회원 3명까지 연결할 수 있어요.
              </Text>

              <View style={{ borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: Colors.green + "55", backgroundColor: Colors.greenLight, marginBottom: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.green }}>PRO</Text>
                  <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                    <Text style={{ fontSize: 26, fontWeight: "900", color: Colors.green }}>7,900</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.green, marginBottom: 3 }}>원/월</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: Colors.textSub, lineHeight: 22 }}>
                  ✓ 회원 무제한{"\n"}✓ 사진/영상 첨부{"\n"}✓ 운동 기록 전체 조회{"\n"}✓ 데이터 분석
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      if (!Purchases || typeof Purchases.getOfferings !== "function") { Alert.alert("오류", "결제 모듈을 불러오지 못했어요."); return; }
                      const offerings = await Purchases.getOfferings();
                      const pkg = offerings.current?.availablePackages.find((p: any) => p.identifier === "pro_monthly") ?? offerings.current?.availablePackages[0];
                      if (!pkg) { Alert.alert("오류", "구독 상품을 불러오지 못했어요."); return; }
                      await Purchases.purchasePackage(pkg);
                      setPaymentVisible(false); fetchHome();
                      Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                    } catch (e: any) { if (!e.userCancelled) Alert.alert("결제 실패", e.message ?? "다시 시도해주세요."); }
                  }}
                  style={{ marginTop: 16, backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>시작하기</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setPaymentVisible(false)}>
                <Text style={{ textAlign: "center", fontSize: 14, color: Colors.textMuted }}>나중에 할게요</Text>
              </TouchableOpacity>
            </View>
          </GestureDetector>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function SummaryCard({
  value,
  label,
  color,
  pct,
}: {
  value: string;
  label: string;
  color: string;
  pct: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color, marginBottom: 2 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 8 }}>
        {label}
      </Text>
      <ProgressBar pct={pct} color={color} />
    </View>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View
      style={{ backgroundColor: Colors.border, borderRadius: 99, height: 5 }}
    >
      <View
        style={{
          width: `${Math.min(pct, 100)}%` as any,
          height: 5,
          backgroundColor: color,
          borderRadius: 99,
        }}
      />
    </View>
  );
}

function AttendanceCard({ todayPtList }: { todayPtList: TodayPt[] }) {
  const now = new Date();
  const total = todayPtList.length;
  const completed = todayPtList.filter((item) => item.completed).length;
  const noShow = todayPtList.filter((item) => {
    if (item.completed) return false;
    const [h, m] = item.time.split(":").map(Number);
    const scheduleEnd = new Date();
    scheduleEnd.setHours(h + 1, m, 0, 0);
    return now > scheduleEnd;
  }).length;
  const attendancePct = total > 0 ? Math.round((completed / total) * 100) : 0;
  if (total === 0) return null;
  return (
    <View
      style={{
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 20,
        borderLeftWidth: 3,
        borderLeftColor: Colors.green,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "700" }}
        >
          하루 출석률
        </Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.green }}>
          {attendancePct}%
        </Text>
      </View>
      <ProgressBar pct={attendancePct} color={Colors.green} />
      <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: Colors.green,
            }}
          />
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            출석 {completed}명
          </Text>
        </View>
        {noShow > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#EF4444",
              }}
            />
            <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "700" }}>
              노쇼 {noShow}명
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: Colors.blue,
            }}
          />
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            전체 {total}명
          </Text>
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      <View
        style={{
          width: 3,
          height: 16,
          backgroundColor: Colors.green,
          borderRadius: 2,
        }}
      />
      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>
        {title}
      </Text>
    </View>
  );
}
