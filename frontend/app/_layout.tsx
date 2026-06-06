import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeKakaoSDK } from "@react-native-kakao/core";
import messaging from "@react-native-firebase/messaging";
import * as Linking from "expo-linking";
import { router, Stack, useRootNavigationState } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { saveFcmToken } from "../utils/fcm";
import { API_URL } from "../constants/api";


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
  try {
    AsyncStorage.getItem("role").then((role) => {
      const isTrainer = role === "TRAINER";
      if (type === "SCHEDULE_CONFIRM" || type === "SCHEDULE_CANCEL" || type === "PT_ADD" || type === "PT_EXPIRY") {
        router.push(isTrainer ? "/(tabs)/trainer/home" : "/(tabs)/member/home");
      } else if (type === "DIET_FEEDBACK") {
        router.push(date
          ? ({ pathname: "/(tabs)/member/diet", params: { date } } as any)
          : "/(tabs)/member/diet"
        );
      } else if (type === "DIET_PHOTO") {
        if (targetId) {
          router.push({ pathname: "/(tabs)/trainer/member-detail", params: { id: targetId, initialTab: "0", ...(date ? { date } : {}) } } as any);
        } else {
          router.push("/(tabs)/trainer/members" as any);
        }
      } else if (type === "WORKOUT_LOG") {
        if (isTrainer) {
          if (targetId) {
            router.push({ pathname: "/(tabs)/trainer/member-detail", params: { id: targetId, initialTab: "1", ...(date ? { date } : {}) } } as any);
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
  const [banner, setBanner] = useState<{ title: string; body: string; type?: string; date?: string; targetId?: string; key: number } | null>(null);
  const [initialNotif, setInitialNotif] = useState<{ type: string; date?: string; targetId?: string } | null>(null);
  const navigationState = useRootNavigationState();

  // 콜드 스타트: 라우터가 준비되면 저장해둔 알림으로 이동
  useEffect(() => {
    if (!navigationState?.key || !initialNotif) return;
    navigateByType(initialNotif.type, initialNotif.date, initialNotif.targetId);
    setInitialNotif(null);
  }, [navigationState?.key, initialNotif]);

  useEffect(() => {
    initializeKakaoSDK("e889ccffb6096521a6b49b9774f4d9ab");
    initFCM();

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
      markAllNotificationsRead();
      if (type) navigateByType(type, date, targetId);
    });

    messaging().getInitialNotification().then((remoteMessage) => {
      if (!remoteMessage) return;
      const type = remoteMessage.data?.type as string | undefined;
      const date = remoteMessage.data?.date as string | undefined;
      const targetId = remoteMessage.data?.targetId as string | undefined;
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

    // 카카오 공유 딥링크: kakaoe889...://kakaolink?code=ABC123
    const handleDeepLink = ({ url }: { url: string }) => {
      try {
        if (!url.includes("kakaolink")) return;
        const query = url.split("?")[1] ?? "";
        const params = new URLSearchParams(query);
        const code = params.get("code");
        if (code) {
          AsyncStorage.setItem("pendingInviteCode", code.toUpperCase());
        }
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
        <Stack.Screen name="onboarding/trainer" />
        <Stack.Screen name="(tabs)/member" />
        <Stack.Screen name="(tabs)/trainer" />
      </Stack>
      {banner && (
        <InAppBanner key={banner.key} title={banner.title} body={banner.body} type={banner.type} date={banner.date} targetId={banner.targetId} />
      )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
