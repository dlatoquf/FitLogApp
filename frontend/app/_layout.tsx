import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeKakaoSDK } from "@react-native-kakao/core";
import messaging from "@react-native-firebase/messaging";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { router, Stack, useRootNavigationState } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, AppState, Text, TouchableOpacity } from "react-native";
import { useFonts, Montserrat_900Black } from "@expo-google-fonts/montserrat";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { saveFcmToken } from "../utils/fcm";
import { API_URL, APP_STORE_URL, PLAY_STORE_URL } from "../constants/api";


async function initRevenueCat() {
  try {
    const apiKey =
      Platform.OS === "ios"
        ? "appl_vMgKlaKdscTldAQsfRPuZuXlXLT"
        : "goog_basbVZDtouCQZzqQwYIsKIlwCdx";
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    await Purchases.configure({ apiKey });
    const jwt = await AsyncStorage.getItem("jwt");
    if (jwt) {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      const userId = String(payload.sub ?? payload.userId ?? payload.id);
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.log("RevenueCat 초기화 실패:", e);
  }
}

async function initFCM() {
  try {
    await messaging().registerDeviceForRemoteMessages();
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) return;
    const token = await messaging().getToken();
    await saveFcmToken(token);
    messaging().onTokenRefresh(async (newToken) => {
      await saveFcmToken(newToken);
    });
  } catch (e: any) {
    console.log("FCM 초기화 실패", e);
  }
}

function navigateByType(type: string, date?: string, targetId?: string) {
  console.log("[Notif] navigateByType:", { type, date, targetId });
  try {
    AsyncStorage.getItem("role").then((role) => {
      const isTrainer = role === "TRAINER";
      if (type === "SCHEDULE_CONFIRM" || type === "SCHEDULE_CANCEL" || type === "PT_ADD" || type === "PT_EXPIRY") {
        router.push(isTrainer ? "/(tabs)/trainer/home" : "/(tabs)/member/home");
      } else if (type === "DIET_FEEDBACK") {
        if (isTrainer) {
          if (targetId) {
            router.push({ pathname: "/(tabs)/trainer/member-detail", params: { id: targetId, initialTab: "1", ...(date ? { date } : {}) } } as any);
          } else {
            router.push("/(tabs)/trainer/members" as any);
          }
        } else {
          router.push(date
            ? ({ pathname: "/(tabs)/member/diet", params: { date } } as any)
            : "/(tabs)/member/diet"
          );
        }
      } else if (type === "DIET_PHOTO") {
        if (targetId) {
          router.push({ pathname: "/(tabs)/trainer/member-detail", params: { id: targetId, initialTab: "1", ...(date ? { date } : {}) } } as any);
        } else {
          router.push("/(tabs)/trainer/members" as any);
        }
      } else if (type === "WORKOUT_LOG") {
        if (isTrainer) {
          if (targetId) {
            router.push({ pathname: "/(tabs)/trainer/member-detail", params: { id: targetId, initialTab: "0", ...(date ? { date } : {}) } } as any);
          } else {
            router.push("/(tabs)/trainer/members" as any);
          }
        } else {
          router.push(date
            ? ({ pathname: "/(tabs)/member/workout", params: { date } } as any)
            : "/(tabs)/member/workout"
          );
        }
      } else if (type === "FEEDBACK") {
        router.push(date
          ? ({ pathname: "/(tabs)/member/workout", params: { date } } as any)
          : "/(tabs)/member/workout"
        );
      } else if (type === "GENERAL") {
        router.push(isTrainer ? "/(tabs)/trainer/home" : "/(tabs)/member/notices" as any);
      } else if (type === "BIRTHDAY_TODAY" || type === "BIRTHDAY_WEEK") {
        router.push("/(tabs)/trainer/home");
      } else if (type === "SCHEDULE_REMINDER") {
        router.push("/(tabs)/member/home");
      } else if (type === "SCHEDULE_OPEN" || type === "SCHEDULE_REQUEST") {
        router.push(isTrainer ? "/(tabs)/trainer/schedule" : "/(tabs)/member/home");
      } else if (type === "NEW_MEMBER" || type === "MEMBER_DELETED" || type === "MEMBER_DISCONNECT" || type === "MISSION_DONE") {
        if (targetId) {
          router.push({ pathname: "/(tabs)/trainer/member-detail", params: { id: targetId } } as any);
        } else {
          router.push("/(tabs)/trainer/members" as any);
        }
      } else if (type === "INCOMPLETE_SESSION") {
        router.push(date
          ? ({ pathname: "/(tabs)/trainer/schedule", params: { date, mode: "week" } } as any)
          : "/(tabs)/trainer/schedule"
        );
      }
    });
  } catch {}
}

function InAppBanner({ title, body, type, date, targetId }: { title: string; body: string; type?: string; date?: string; targetId?: string }) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const { top } = useSafeAreaInsets();

  useEffect(() => {
    Animated.sequence([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.delay(3500),
      Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        transform: [{ translateY }],
        paddingTop: top + 8,
        paddingHorizontal: 16,
        paddingBottom: 14,
        backgroundColor: "#1a1a1a",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => type && navigateByType(type, date, targetId)}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ color: "#ccc", fontSize: 13 }} numberOfLines={2}>
          {body}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function RootLayout() {
  useFonts({ Montserrat_900Black });
  const [banner, setBanner] = useState<{ title: string; body: string; type?: string; date?: string; targetId?: string; key: number } | null>(null);
  const [initialNotif, setInitialNotif] = useState<{ type: string; date?: string; targetId?: string } | null>(null);
  const navigationState = useRootNavigationState();

  // 콜드 스타트: 라우터가 준비되면 저장해둔 알림으로 이동
  useEffect(() => {
    if (!navigationState?.key || !initialNotif) return;
    navigateByType(initialNotif.type, initialNotif.date, initialNotif.targetId);
    setInitialNotif(null);
  }, [navigationState?.key, initialNotif]);

  // JWT 만료 30일 이내면 자동 갱신
  const refreshJwtIfNeeded = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      if (!jwt) return;
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      const expiresAt = payload.exp * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (expiresAt - Date.now() < thirtyDays) {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (res.ok) {
          const data = await res.json();
          await AsyncStorage.setItem("jwt", data.token);
        }
      }
    } catch {}
  };

  // 앱 포그라운드 진입 시 뱃지를 읽지 않은 알림 수로 동기화
  useEffect(() => {
    const syncBadge = async () => {
      console.log("[Badge] syncBadge 시작");
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        if (!jwt) { console.log("[Badge] JWT 없음, 스킵"); return; }
        console.log("[Badge] unread-count API 호출");
        const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        console.log("[Badge] API 응답 상태:", res.status);
        if (res.ok) {
          const data = await res.json();
          const count = data.count ?? 0;
          console.log("[Badge] 미읽음 수:", count);
          await Notifications.setBadgeCountAsync(count);
          console.log("[Badge] setBadgeCountAsync 완료:", count);
        }
      } catch (e) {
        console.error("[Badge] 오류:", e);
      }
    };

    syncBadge();
    refreshJwtIfNeeded();
    const sub = AppState.addEventListener("change", (state) => {
      console.log("[AppState] 상태 변경:", state);
      if (state === "active") {
        syncBadge();
        refreshJwtIfNeeded();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    console.log("[Init] KakaoSDK 초기화 시작");
    initializeKakaoSDK("e889ccffb6096521a6b49b9774f4d9ab");
    console.log("[Init] FCM 초기화 시작");
    initFCM();
    console.log("[Init] RevenueCat 초기화 시작");
    initRevenueCat();

    const markAllNotificationsRead = async () => {
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        if (!jwt) return;
        await fetch(`${API_URL}/api/notifications/read-all`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${jwt}` },
        });
      } catch {}
    };

    const unsubscribeBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
      const type = remoteMessage.data?.type as string | undefined;
      const date = remoteMessage.data?.date as string | undefined;
      const targetId = remoteMessage.data?.targetId as string | undefined;
      console.log("[Notif Background]", JSON.stringify({ type, date, targetId }));
      markAllNotificationsRead();
      if (type) setInitialNotif({ type, date, targetId });
    });

    messaging().getInitialNotification().then((remoteMessage) => {
      if (!remoteMessage) return;
      const type = remoteMessage.data?.type as string | undefined;
      const date = remoteMessage.data?.date as string | undefined;
      const targetId = remoteMessage.data?.targetId as string | undefined;
      console.log("[Notif InitialNotification]", JSON.stringify({ type, date, targetId }));
      markAllNotificationsRead();
      if (type) setInitialNotif({ type, date, targetId });
    });

    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      setBanner({
        title: remoteMessage.notification?.title ?? "FitLog",
        body: remoteMessage.notification?.body ?? "",
        type: remoteMessage.data?.type as string | undefined,
        date: remoteMessage.data?.date as string | undefined,
        targetId: remoteMessage.data?.targetId as string | undefined,
        key: Date.now(),
      });
    });

    // 카카오 공유 딥링크: kakaoe889...://kakaolink?code=ABC123 or ?memberId=123
    const handleDeepLink = ({ url }: { url: string }) => {
      try {
        if (!url.includes("kakaolink")) return;
        const query = url.split("?")[1] ?? "";
        const params = new URLSearchParams(query);
        const code = params.get("code");
        const memberId = params.get("memberId");
        const memberType = params.get("memberType");

        console.log("[DeepLink] url:", url, "memberId:", memberId, "code:", code);

        AsyncStorage.multiGet(["jwt", "role"]).then(([jwtEntry, roleEntry]) => {
          const jwt = jwtEntry[1];
          const role = roleEntry[1];

          if (!memberId && !code) {
            // params 없음 = 다운로드 버튼 클릭 → 스토어로 이동
            Linking.openURL(Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL);
          } else if (memberId) {
            // 운동로그 공유 링크
            if (role === "TRAINER") {
              router.push({
                pathname: "/(tabs)/trainer/member-detail",
                params: {
                  id: memberId,
                  ...(memberType === "manual" ? { type: "manual" } : {}),
                  initialTab: "1",
                },
              } as any);
            } else {
              Linking.openURL(Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL);
            }
          } else if (code) {
            // 회원초대 링크
            AsyncStorage.setItem("pendingInviteCode", code.toUpperCase());
            if (role === "TRAINER") {
              Alert.alert(
                "회원 전용",
                "이 링크는 회원 가입용입니다.\n회원에게 공유해주세요!",
                [{ text: "확인", onPress: () => router.replace("/(tabs)/trainer/home" as any) }],
              );
            } else if (jwt) {
              router.replace("/(tabs)/member/home" as any);
            } else {
              router.replace("/auth" as any);
            }
          }
        });
      } catch {}
    };

    const linkingSub = Linking.addEventListener("url", handleDeepLink);
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }); });

    return () => {
      unsubscribeBackground();
      unsubscribeForeground();
      linkingSub.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)/member" />
        <Stack.Screen name="(tabs)/trainer" />
        <Stack.Screen name="kakaolink" />
      </Stack>
      {banner && (
        <InAppBanner key={banner.key} title={banner.title} body={banner.body} type={banner.type} date={banner.date} targetId={banner.targetId} />
      )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
