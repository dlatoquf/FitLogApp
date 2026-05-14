import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging from "@react-native-firebase/messaging";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import { API_URL } from "../constants/api";

// FCM 토큰을 백엔드에 저장
async function saveFcmToken(token: string) {
  try {
    const jwt = await AsyncStorage.getItem("jwt");
    if (!jwt) return;

    await fetch(`${API_URL}/api/notifications/fcm-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    console.log("FCM 토큰 저장 실패", e);
  }
}

// 푸시 알림 권한 요청 및 FCM 초기화
async function initFCM() {
  try {
    // 이 줄 추가!
    await messaging().registerDeviceForRemoteMessages();

    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) return;

    const token = await messaging().getToken();
    console.log("FCM Token:", token);
    await saveFcmToken(token);

    messaging().onTokenRefresh(async (newToken) => {
      await saveFcmToken(newToken);
    });
  } catch (e) {
    console.log("FCM 초기화 실패", e);
  }
}

export default function RootLayout() {
  useEffect(() => {
    initFCM();

    // 백그라운드에서 알림 클릭
    const unsubscribeBackground = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log("백그라운드 알림 클릭:", remoteMessage);
    });

    // 앱 종료 상태에서 알림 클릭
    messaging().getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log("종료 상태 알림 클릭:", remoteMessage);
      }
    });

    // 포그라운드 알림 수신
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage.notification?.title ?? "알림",
        remoteMessage.notification?.body ?? ""
      );
    });

    return () => {
      unsubscribeBackground();
      unsubscribeForeground();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)/member" />
      <Stack.Screen name="(tabs)/trainer" />
    </Stack>
  );
}