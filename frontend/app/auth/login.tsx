import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ deprecated 교체
import { Colors } from "../../constants/Colors";
import { API_URL } from "../../constants/api";

// 카카오 로그인 라이브러리가 없는 환경을 위한 조건부 import
let loginWithKakaoAccount: (() => Promise<any>) | null = null;
try {
  loginWithKakaoAccount = require("@react-native-seoul/kakao-login").loginWithKakaoAccount;
} catch {
  // 라이브러리 없을 경우 무시
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleKakaoLogin = async () => {
    if (!loginWithKakaoAccount) {
      Alert.alert("개발 모드", "카카오 로그인 라이브러리가 없습니다.\n테스트용으로 이동합니다.", [
        { text: "트레이너", onPress: () => router.replace("/(tabs)/trainer/home") },
        { text: "회원", onPress: () => router.replace("/(tabs)/member/home") },
        { text: "가입", onPress: () => router.replace("/auth/signup") },
      ]);
      return;
    }

    setLoading(true);
    try {
      // 1. 카카오 로그인
      const kakaoResult = await loginWithKakaoAccount();

      // ✅ 카카오 SDK 응답에서 accessToken 안전하게 추출 (키 이름 대응)
      const accessToken =
        kakaoResult?.accessToken ??
        kakaoResult?.access_token ??
        null;

      if (!accessToken) {
        throw new Error("카카오 accessToken을 가져오지 못했어요.");
      }

      // 2. 서버에 카카오 토큰 전송
      const res = await fetch(`${API_URL}/api/auth/kakao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });

      const text = await res.text();
      let data: { jwt: string; isNewUser: boolean; role: string | null };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`서버 응답 오류: ${text}`);
      }

      if (!res.ok) throw new Error((data as any)?.message || `오류: ${res.status}`);

      const { jwt, isNewUser, role } = data;
      await AsyncStorage.setItem("jwt", jwt);
      // ✅ role도 저장해두면 네트워크 오류 시 index.tsx에서 활용 가능
      if (role) await AsyncStorage.setItem("role", role);

      // 3. 라우팅
      if (isNewUser || !role) {
        router.replace("/auth/signup");
      } else if (role === "TRAINER") {
        router.replace("/(tabs)/trainer/home");
      } else if (role === "MEMBER") {
        router.replace("/(tabs)/member/home");
      }
    } catch (e: any) {
      Alert.alert("로그인 실패", e?.message ?? "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          justifyContent: "center",
          paddingTop: 40,
          paddingBottom: 40,
        }}
      >
        {/* 로고 */}
        <View style={{ alignItems: "center", marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              backgroundColor: Colors.green,
              borderRadius: 22,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: "900", color: "#fff" }}>F</Text>
          </View>
          <Text style={{ fontSize: 40, fontWeight: "900", color: Colors.text }}>
            <Text style={{ color: Colors.green }}>Fit</Text>Log
          </Text>
          <Text
            style={{
              marginTop: 6,
              fontSize: 16,
              fontWeight: "700",
              color: Colors.green,
            }}
          >
            기록이 곧 성장이다
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 15,
              color: Colors.textSub,
              textAlign: "center",
            }}
          >
            핏로그, 기록으로 완성하는 PT
          </Text>
        </View>

        {/* 기능 카드 */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 40 }}>
          <FeatureCard icon="📅" title="일정 관리" desc="수업 스케줄" />
          <FeatureCard icon="📊" title="기록 & 통계" desc="운동 변화" />
          <FeatureCard icon="💬" title="피드백" desc="실시간 소통" />
        </View>

        {/* 카카오 로그인 버튼 */}
        <Pressable
          onPress={handleKakaoLogin}
          disabled={loading}
          style={({ pressed }) => ({
            width: "100%",
            height: 60,
            borderRadius: 30,
            backgroundColor: pressed ? "#E8D000" : Colors.kakao,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            marginBottom: 24,
            opacity: loading ? 0.7 : 1,
          })}
        >
          {loading ? (
            <ActivityIndicator color={Colors.kakaoText} />
          ) : (
            <>
              <Text style={{ fontSize: 22, marginRight: 10 }}>💬</Text>
              <Text
                style={{
                  color: Colors.kakaoText,
                  fontWeight: "900",
                  fontSize: 18,
                }}
              >
                카카오로 로그인
              </Text>
            </>
          )}
        </Pressable>

        {/* 약관 */}
        <Text
          style={{
            textAlign: "center",
            color: Colors.textMuted,
            fontSize: 12,
            lineHeight: 20,
          }}
        >
          로그인 시{"\n"}
          <Text style={{ textDecorationLine: "underline" }}>
            이용약관 및 개인정보보호정책
          </Text>
          에 동의함으로 간주합니다
        </Text>
      </View>
    </SafeAreaView>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        height: 110,
        borderRadius: 18,
        backgroundColor: Colors.bgSub,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ fontSize: 26, marginBottom: 6 }}>{icon}</Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "800",
          color: Colors.text,
          marginBottom: 4,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      <Text
        style={{ fontSize: 11, color: Colors.textMuted, textAlign: "center" }}
      >
        {desc}
      </Text>
    </View>
  );
}