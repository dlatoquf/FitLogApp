import messaging from "@react-native-firebase/messaging";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { saveFcmToken } from "../utils/fcm";

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
    await saveFcmToken(token);

    messaging().onTokenRefresh(async (newToken) => {
      await saveFcmToken(newToken);
    });
  } catch (e: any) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)/member" />
        <Stack.Screen name="(tabs)/trainer" />
      </Stack>
    </GestureHandlerRootView>
  );
}
