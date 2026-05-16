import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../constants/api";

// FCM 토큰을 백엔드에 저장 (로그인 후 JWT가 있을 때만 성공)
export async function saveFcmToken(token: string) {
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
    console.log("FCM 토큰 저장 완료");
  } catch (e) {
    console.log("FCM 토큰 저장 실패", e);
  }
}
