import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Colors } from "../constants/Colors";
import { API_URL } from "../constants/api";

export default function IndexScreen() {
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        if (!jwt) {
          router.replace("/auth/login");
          return;
        }

        // 토큰 유효성 및 역할 확인
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        if (!res.ok) {
          await AsyncStorage.removeItem("jwt");
          router.replace("/auth/login");
          return;
        }

        const data = await res.json();
        if (data.role === "TRAINER") {
          router.replace("/(tabs)/trainer/home");
        } else {
          router.replace("/(tabs)/member/home");
        }
      } catch {
        // 네트워크 오류 시 저장된 역할로 판단
        const savedRole = await AsyncStorage.getItem("role");
        if (savedRole === "TRAINER") {
          router.replace("/(tabs)/trainer/home");
        } else if (savedRole === "MEMBER") {
          router.replace("/(tabs)/member/home");
        } else {
          router.replace("/auth/login");
        }
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator color={Colors.green} size="large" />
    </View>
  );
}
