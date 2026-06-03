import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging from "@react-native-firebase/messaging";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { saveFcmToken } from "../utils/fcm";

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

function InAppBanner({ title, body }: { title: string; body: string }) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80 }),
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
        paddingTop: 52,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: "#1a1a1a",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 10,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 2 }}>
        {title}
      </Text>
      <Text style={{ color: "#ccc", fontSize: 13 }} numberOfLines={2}>
        {body}
      </Text>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [banner, setBanner] = useState<{ title: string; body: string; key: number } | null>(null);

  useEffect(() => {
    initFCM();

    const unsubscribeBackground = messaging().onNotificationOpenedApp(() => {});
    messaging().getInitialNotification().then(() => {});

    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      setBanner({
        title: remoteMessage.notification?.title ?? "알림",
        body: remoteMessage.notification?.body ?? "",
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
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)/member" />
        <Stack.Screen name="(tabs)/trainer" />
      </Stack>
      {banner && (
        <InAppBanner key={banner.key} title={banner.title} body={banner.body} />
      )}
    </GestureHandlerRootView>
  );
}
