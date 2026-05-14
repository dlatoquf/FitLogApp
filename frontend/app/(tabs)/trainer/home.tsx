import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases from "react-native-purchases";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import KakaoShare from "@react-native-kakao/share";
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
  trainerName: string;
  totalMembers: number;
  todaySchedules: number;
  todayPtList: TodayPt[];
  trainerCode: string;
  plan: string;
}

interface Noti {
  notificationId: number;
  type: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const NOTI_ICON: Record<string, string> = {
  WORKOUT_LOG: "💪", SCHEDULE: "📅", FEEDBACK: "💬", PT_EXPIRY: "⏰", GENERAL: "🔔",
};

export default function TrainerHomeScreen() {
  const [data, setData] = useState<HomeData | null>(null);
  const didFetch = useRef(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [notifications, setNotifications] = useState<Noti[]>([]);
  const [paymentVisible, setPaymentVisible] = useState(false); // 결제 바텀시트

  // ── 초대 버튼 핸들러 ──────────────────────────────────────────────────────
  // TODO: 실제 서비스에서는 totalMembers >= 3 으로 변경 (FREE 플랜 3명 초과 시)
  // 현재는 테스트용으로 totalMembers >= 1 (1명 있을 때 2번째부터 결제 유도)
  const handleInvitePress = () => {
    const limit = 1; // TODO: 실제 배포 시 3으로 변경
    if ((data?.totalMembers ?? 0) >= limit) {
      setPaymentVisible(true); // 결제 바텀시트 오픈
    } else {
      setInviteVisible(true); // 초대 모달 오픈
    }
  };


  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
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

      // RevenueCat 초기화 + 트레이너 userId 연결
      try {
        if (Purchases && typeof Purchases.configure === "function") {
          await Purchases.configure({ apiKey: "test_XvTfkaGFYgntevQoXLZXZHUhVZy" });
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
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => {
    if (didFetch.current) return;
  
    didFetch.current = true;
  
    console.log("🔥 TrainerHome fetchHome 실행");
  
    fetchHome();
  }, []);

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
          link: { mobileWebUrl: "https://fitlog.app", webUrl: "https://fitlog.app" },
        },
      });
    } catch {
      Alert.alert("카카오톡 공유 실패", "코드를 복사해서 공유해주세요.",
        [{ text: "코드 복사", onPress: handleCopy }, { text: "닫기" }]);
    }
  };

  const markAllRead = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT", headers: { Authorization: `Bearer ${jwt}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch {}
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchHome(true)} tintColor={Colors.green} />}
      >
        {/* 인사 + 알림 버튼 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <View>
            <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}>안녕하세요 👋</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>
              {data?.trainerName ?? "-"}님
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/trainer/notifications")}
            style={{
              flexDirection: "row", alignItems: "center", gap: 6,
              backgroundColor: unreadCount > 0 ? Colors.greenLight : Colors.bgSub,
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
              borderWidth: 1, borderColor: unreadCount > 0 ? Colors.green + "44" : Colors.border,
              marginTop: 6,
            }}
          >
            {/* 커스텀 종 아이콘 */}
            <View style={{ width: 18, height: 18, justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: 12, height: 10, backgroundColor: unreadCount > 0 ? Colors.green : Colors.textMuted, borderRadius: 6, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
              <View style={{ width: 14, height: 3, backgroundColor: unreadCount > 0 ? Colors.green : Colors.textMuted, borderRadius: 1 }} />
              <View style={{ width: 5, height: 5, borderRadius: 3, borderWidth: 1.5, borderColor: unreadCount > 0 ? Colors.green : Colors.textMuted, marginTop: 1 }} />
            </View>
            {unreadCount > 0 ? (
              <View style={{ backgroundColor: Colors.green, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>{unreadCount}</Text>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: Colors.textMuted, fontWeight: "600" }}>알림</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 회원 초대 버튼 */}
        <TouchableOpacity
          onPress={handleInvitePress}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 12, marginBottom: 20, gap: 6 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>🔗 회원 초대하기</Text>
        </TouchableOpacity>

        {/* 요약 카드 */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <SummaryCard value={String(data?.totalMembers ?? 0)} label="총 회원" color={Colors.green} pct={Math.min((data?.totalMembers ?? 0) * 5, 100)} />
          <SummaryCard value={String(data?.todaySchedules ?? 0)} label="오늘 PT" color={Colors.blue} pct={Math.min((data?.todaySchedules ?? 0) * 20, 100)} />
        </View>

        {/* 하루 출석률 카드 */}
        {(() => {
          const now = new Date();
          const list = data?.todayPtList ?? [];
          const total = list.length;
          const completed = list.filter(item => item.completed).length;
          const noShow = list.filter(item => {
            if (item.completed) return false;
            const [h, m] = item.time.split(":").map(Number);
            const scheduleEnd = new Date();
            scheduleEnd.setHours(h + 1, m, 0, 0);
            return now > scheduleEnd;
          }).length;
          const attendancePct = total > 0 ? Math.round((completed / total) * 100) : 0;
          if (total === 0) return null;
          const barColor = attendancePct >= 80 ? Colors.green : "#F59E0B";
          return (
            <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 20, borderLeftWidth: 3, borderLeftColor: barColor }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "700" }}>하루 출석률</Text>
                <Text style={{ fontSize: 22, fontWeight: "800", color: barColor }}>{attendancePct}%</Text>
              </View>
              <ProgressBar pct={attendancePct} color={barColor} />
              <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green }} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>출석 {completed}명</Text>
                </View>
                {noShow > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                    <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "700" }}>노쇼 {noShow}명</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.blue }} />
                  <Text style={{ fontSize: 12, color: Colors.textMuted }}>전체 {total}명</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* 오늘 PT 일정 */}
        <SectionTitle title="오늘 PT 일정" />
        {data?.todayPtList && data.todayPtList.length > 0 ? (
          data.todayPtList.map((item) => (
            <TouchableOpacity
              key={`${item.memberId}-${item.time}`}
              onPress={() => router.push(`/(tabs)/trainer/member-detail?id=${item.memberId}`)}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: Colors.green, borderWidth: 1, borderColor: Colors.border }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{item.memberName[0]}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{item.memberName}</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>PT 수업 · 잔여 {item.ptRemaining}회</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub }}>{item.time}</Text>
                <View style={{ backgroundColor: item.completed ? Colors.green : Colors.blue + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: item.completed ? "#fff" : Colors.blue }}>
                    {item.completed ? "완료" : "확정"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={{ backgroundColor: Colors.bgSub, borderRadius: 12, padding: 20, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>오늘 예정된 PT가 없어요</Text>
          </View>
        )}

      </ScrollView>

      {/* 초대 모달 */}
      <Modal visible={inviteVisible} transparent animationType="slide" onRequestClose={() => setInviteVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} activeOpacity={1} onPress={() => setInviteVisible(false)}>
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: Platform.OS === "ios" ? 40 : 28 }}>
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 6 }}>회원 초대하기 🔗</Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 24 }}>아래 코드를 회원에게 공유하면 자동으로 연결돼요</Text>
              <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 20, alignItems: "center", borderWidth: 1, borderColor: Colors.border, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 6 }}>🔑 내 트레이너 코드</Text>
                <Text style={{ fontSize: 32, fontWeight: "900", color: Colors.green, letterSpacing: 4 }}>{data?.trainerCode ?? "-"}</Text>
              </View>
              <TouchableOpacity onPress={handleKakaoShare} style={{ backgroundColor: "#FEE500", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#3C1E1E" }}>카카오톡으로 공유하기</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCopy} style={{ backgroundColor: Colors.bgSub, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>코드 복사하기</Text>
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
      <Modal visible={paymentVisible} transparent animationType="slide" onRequestClose={() => setPaymentVisible(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setPaymentVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: Platform.OS === "ios" ? 44 : 28 }}>
              {/* 핸들 바 */}
              <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 20 }} />

              {/* 타이틀 */}
              <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
                PRO로 업그레이드하세요 🚀
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 20, lineHeight: 20 }}>
                {/* TODO: 실제 배포 시 "무료 플랜은 회원 3명까지"로 변경 */}
                무료 플랜은 회원 3명까지 연결할 수 있어요.{"\n"}
                PRO 플랜으로 업그레이드하면 무제한으로 회원을 관리할 수 있어요.
              </Text>

              {/* 요금 안내 */}
              <View style={{ backgroundColor: Colors.greenLight, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.green + "33" }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 4 }}>PRO 플랜</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ fontSize: 30, fontWeight: "900", color: Colors.green }}>6,900</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.green, marginBottom: 4 }}>원 / 월</Text>
                </View>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>✓ 회원 무제한 · ✓ 모든 기능 이용 · ✓ 알림 기능 제공</Text>
              </View>

              {/* 결제 수단 3가지 */}
              {/* TODO: 각 버튼에 실제 결제 로직 연결 필요 */}

              {/* 애플 인앱결제 */}
              {/* TODO: react-native-iap 설치 후 productId 연결
                  npm install react-native-iap
                  productId: "com.anonymous.FitLogApp.pro_monthly"
                  App Store Connect에서 인앱 구매 상품 등록 필요 */}
              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (!Purchases || typeof Purchases.getOfferings !== "function") {
                      Alert.alert("오류", "결제 모듈을 불러오지 못했어요. 앱을 재시작해주세요.");
                      return;
                    }
                    const offerings = await Purchases.getOfferings();
                    const pkg = offerings.current?.availablePackages.find(
                      (p: any) => p.packageType === "MONTHLY"
                    ) ?? offerings.current?.availablePackages[0];

                    if (!pkg) {
                      Alert.alert("오류", "구독 상품을 불러오지 못했어요.");
                      return;
                    }

                    await Purchases.purchasePackage(pkg);
                    Alert.alert("구독 완료! 🎉", "PRO 플랜이 활성화됐어요.");
                    fetchHome(); // 홈 새로고침
                  } catch (e: any) {
                    if (!e.userCancelled) {
                      Alert.alert("결제 실패", e.message ?? "다시 시도해주세요.");
                    }
                  }
                }}
                style={{ backgroundColor: "#000", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10, flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}> Apple Pay로 구독</Text>
              </TouchableOpacity>

              {/* 카카오페이 */}
              {/* TODO: @react-native-kakao/pay SDK 연동
                  또는 웹뷰로 카카오페이 결제 URL 오픈 */}
              {/*<TouchableOpacity
                onPress={() => Alert.alert("준비 중", "카카오페이 연동 준비 중이에요.")}
                style={{ backgroundColor: "#FEE500", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10, flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#3C1E1E" }}>카카오페이로 구독</Text>
              </TouchableOpacity>8/}

              {/* 토스페이먼츠 */}
              {/* TODO: @tosspayments/tosspayments-sdk 연동
                  또는 웹뷰로 토스 결제 URL 오픈 */}
              {/*<TouchableOpacity
                onPress={() => Alert.alert("준비 중", "토스 연동 준비 중이에요.")}
                style={{ backgroundColor: "#0064FF", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 16, flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>토스로 구독</Text>
              </TouchableOpacity>*/}

              {/* 닫기 */}
              <TouchableOpacity onPress={() => setPaymentVisible(false)}>
                <Text style={{ textAlign: "center", fontSize: 14, color: Colors.textMuted }}>나중에 할게요</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function SummaryCard({ value, label, color, pct }: { value: string; label: string; color: string; pct: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: color, borderWidth: 1, borderColor: Colors.border }}>
      <Text style={{ fontSize: 28, fontWeight: "800", color, marginBottom: 2 }}>{value}</Text>
      <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 8 }}>{label}</Text>
      <ProgressBar pct={pct} color={color} />
    </View>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 5 }}>
      <View style={{ width: `${Math.min(pct, 100)}%` as any, height: 5, backgroundColor: color, borderRadius: 99 }} />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4 }}>
      <View style={{ width: 3, height: 16, backgroundColor: Colors.green, borderRadius: 2 }} />
      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{title}</Text>
    </View>
  );
}