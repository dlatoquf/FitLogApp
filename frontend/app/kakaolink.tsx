import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function KakaoLinkHandler() {
  const params = useLocalSearchParams();

  useEffect(() => {
    const code = params.code as string | undefined;
    (async () => {
      if (code) {
        await AsyncStorage.setItem("pendingInviteCode", code.toUpperCase());
      }
      // 로그인 여부 확인 후 적절한 화면으로 이동
      const jwt = await AsyncStorage.getItem("jwt");
      if (jwt) {
        router.replace("/(tabs)/member/home" as any);
      } else {
        router.replace("/auth" as any);
      }
    })();
  }, []);

  return <View />;
}
