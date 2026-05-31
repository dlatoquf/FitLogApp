import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging from "@react-native-firebase/messaging";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../constants/Colors";
import { API_URL } from "../../constants/api";
import { saveFcmToken } from "../../utils/fcm";

// 카카오 로그인 라이브러리가 없는 환경을 위한 조건부 import
let loginWithKakaoAccount: (() => Promise<any>) | null = null;
try {
  loginWithKakaoAccount =
    require("@react-native-seoul/kakao-login").loginWithKakaoAccount;
} catch {
  // 라이브러리 없을 경우 무시
}

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  // 앱 진입 시 JWT 자동검증 중에는 스플래시처럼 로딩 표시
  const [checkingToken, setCheckingToken] = useState(true);

  // ─────────────────────────────────────────────
  // 앱 최초 진입 시: 저장된 JWT로 자동 로그인 시도
  // ─────────────────────────────────────────────
  useEffect(() => {
    const tryAutoLogin = async () => {
      try {
        const jwt = await AsyncStorage.getItem("jwt");

        if (!jwt) {
          // JWT 없음 → 로그인 화면 표시
          setCheckingToken(false);
          return;
        }

        // JWT 있음 → 서버에서 유효성 검증
        const res = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (!res.ok) {
          // 토큰 만료 또는 유효하지 않음 → 삭제 후 로그인 화면
          await AsyncStorage.multiRemove(["jwt", "role"]);
          setCheckingToken(false);
          return;
        }

        const data: { jwt: string; isNewUser: boolean; role: string | null } =
          await res.json();

        // role 없음 → 아직 회원가입 미완료지만 뒤로가기로 온 경우일 수 있으므로 로그인 화면 유지
        if (!data.role) {
          setCheckingToken(false);
          return;
        }

        await AsyncStorage.setItem("role", data.role);

        // 자동 로그인 성공 → 홈으로 이동
        navigateByRole(data.role);
      } catch {
        // 네트워크 오류 등 → 캐시된 role로 오프라인 진입 시도
        const cachedRole = await AsyncStorage.getItem("role");
        if (cachedRole) {
          navigateByRole(cachedRole);
        } else {
          setCheckingToken(false);
        }
      }
    };

    tryAutoLogin();
  }, []);

  // role에 따라 화면 이동
  const navigateByRole = (role: string | null) => {
    if (!role) {
      router.replace("/auth/signup");
    } else if (role === "TRAINER") {
      router.replace("/(tabs)/trainer/home");
    } else if (role === "MEMBER") {
      router.replace("/(tabs)/member/home");
    }
  };

  // ─────────────────────────────────────────────
  // 카카오 로그인 버튼 핸들러
  // ─────────────────────────────────────────────
  const handleKakaoLogin = async () => {
    if (!loginWithKakaoAccount) {
      Alert.alert(
        "개발 모드",
        "카카오 로그인 라이브러리가 없습니다.\n테스트용으로 이동합니다.",
        [
          {
            text: "트레이너",
            onPress: () => router.replace("/(tabs)/trainer/home"),
          },
          {
            text: "회원",
            onPress: () => router.replace("/(tabs)/member/home"),
          },
          { text: "가입", onPress: () => router.replace("/auth/signup") },
        ],
      );
      return;
    }

    setLoading(true);
    try {
      // 1. 카카오 SDK 로그인
      console.log("[카카오] loginWithKakaoAccount 호출 시작");
      let kakaoResult: any;
      try {
        kakaoResult = await loginWithKakaoAccount();
        console.log("[카카오] SDK 결과:", JSON.stringify(kakaoResult));
      } catch (kakaoErr: any) {
        console.log(
          "[카카오] SDK 에러:",
          kakaoErr?.message,
          kakaoErr?.code,
          JSON.stringify(kakaoErr),
        );
        throw new Error(`카카오 SDK 오류: ${kakaoErr?.message ?? kakaoErr}`);
      }

      const accessToken =
        kakaoResult?.accessToken ?? kakaoResult?.access_token ?? null;

      if (!accessToken) {
        throw new Error("카카오 accessToken을 가져오지 못했어요.");
      }

      console.log("[카카오] accessToken 획득, 서버 요청 시작:", API_URL);

      // 2. 서버에 카카오 토큰 전송
      let res: Response;
      try {
        res = await fetch(`${API_URL}/api/auth/kakao`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        console.log("[서버] 응답 status:", res.status);
      } catch (fetchErr: any) {
        console.log(
          "[서버] fetch 에러:",
          fetchErr?.message,
          JSON.stringify(fetchErr),
        );
        throw new Error(`서버 연결 실패: ${fetchErr?.message ?? fetchErr}`);
      }

      const text = await res.text();
      console.log("[서버] 응답 body:", text.slice(0, 200));
      let data: { jwt: string; isNewUser: boolean; role: string | null };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`서버 응답 오류: ${text}`);
      }

      if (!res.ok)
        throw new Error((data as any)?.message || `오류: ${res.status}`);

      const { jwt, isNewUser, role } = data;

      // JWT & role 저장 (자동 로그인에 사용)
      await AsyncStorage.setItem("jwt", jwt);
      if (role) await AsyncStorage.setItem("role", role);

      // FCM 토큰 저장 (로그인 직후 JWT가 생겼으므로 이제 저장 가능)
      try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) await saveFcmToken(fcmToken);
      } catch {}

      // 3. 라우팅
      if (isNewUser || !role) {
        router.replace("/auth/signup");
      } else {
        navigateByRole(role);
      }
    } catch (e: any) {
      console.log("[로그인 실패]", e?.message ?? e);
      Alert.alert("로그인 실패", "로그인에 실패했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────
  // JWT 자동검증 중 → 로딩 스피너만 표시
  // ─────────────────────────────────────────────
  if (checkingToken) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={Colors.green} />
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // 로그인 화면 UI
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 28,
          justifyContent: "space-between",
          paddingTop: 70,
          paddingBottom: 34,
        }}
      >
        <View>
          {/* 로고 */}
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={{
                width: 120,
                height: 120,
                borderRadius: 28,
                marginBottom: 14,
              }}
              resizeMode="contain"
            />
            <Text
              style={{ fontSize: 46, fontWeight: "900", color: Colors.text }}
            >
              <Text style={{ color: Colors.green }}>Fit</Text>Log
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 18,
                fontWeight: "800",
                color: Colors.green,
              }}
            >
              트레이너와 회원을
            </Text>
            <Text
              style={{
                marginTop: 2,
                fontSize: 18,
                fontWeight: "800",
                color: Colors.green,
              }}
            >
              하나의 기록으로 연결하다
            </Text>
            <Text
              style={{
                marginTop: 14,
                fontSize: 14,
                color: Colors.textMuted,
                textAlign: "center",
                lineHeight: 22,
                fontWeight: "600",
              }}
            >
              PT 일정 · 운동기록 · 식단관리 · 피드백
            </Text>
          </View>
        </View>

        <View>
          {/* 카카오 로그인 버튼 */}
          <Pressable
            onPress={handleKakaoLogin}
            disabled={loading}
            style={({ pressed }) => ({
              width: "100%",
              height: 64,
              borderRadius: 22,
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
      </View>
    </SafeAreaView>
  );
}
