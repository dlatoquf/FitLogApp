import AsyncStorage from "@react-native-async-storage/async-storage";
import messaging from "@react-native-firebase/messaging";
import * as AppleAuthentication from "expo-apple-authentication";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
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
  const [checkingToken, setCheckingToken] = useState(true);
  const lastLogoTapRef = useRef<number>(0);

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

  // 로고 더블탭 → 테스트 로그인 (Google Play 심사용)
  const handleLogoDoubleTap = async () => {
    const now = Date.now();
    if (now - lastLogoTapRef.current < 400) {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/auth/test-login`, { method: "POST" });
        if (!res.ok) return;
        const data = await res.json();
        await AsyncStorage.setItem("jwt", data.jwt);
        if (data.role) await AsyncStorage.setItem("role", data.role);
        navigateByRole(data.role);
      } catch {}
      finally { setLoading(false); }
    }
    lastLogoTapRef.current = now;
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
  // 애플 로그인 버튼 핸들러
  // ─────────────────────────────────────────────
  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) throw new Error("Apple identityToken을 가져오지 못했어요.");

      const name = fullName?.givenName && fullName?.familyName
        ? `${fullName.familyName}${fullName.givenName}`
        : null;

      const res = await fetch(`${API_URL}/api/auth/apple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identityToken, name }),
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
      if (role) await AsyncStorage.setItem("role", role);

      try {
        const fcmToken = await messaging().getToken();
        if (fcmToken) await saveFcmToken(fcmToken);
      } catch {}

      if (isNewUser || !role) {
        if (name) await AsyncStorage.setItem("appleProvidedName", name);
        await AsyncStorage.setItem("loginMethod", "apple");
        router.replace("/auth/signup");
      } else {
        navigateByRole(role);
      }
    } catch (e: any) {
      if (e?.code === "ERR_REQUEST_CANCELED") return; // 사용자가 직접 취소
      Alert.alert("로그인 실패", "Apple 로그인에 실패했어요. 다시 시도해주세요.");
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
            <Pressable onPress={handleLogoDoubleTap}>
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
            </Pressable>
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
              marginBottom: 12,
              opacity: loading ? 0.7 : 1,
            })}
          >
            {loading ? (
              <ActivityIndicator color={Colors.kakaoText} />
            ) : (
              <>
                {/* 카카오 말풍선 로고 */}
                <Svg width={22} height={22} viewBox="0 0 24 24" style={{ marginRight: 10 }}>
                  <Path
                    d="M12 3C6.477 3 2 6.582 2 11c0 2.836 1.775 5.328 4.456 6.808L5.5 21l3.917-2.094A11.3 11.3 0 0 0 12 19c5.523 0 10-3.582 10-8s-4.477-8-10-8z"
                    fill="#3C1E1E"
                  />
                </Svg>
                <Text style={{ color: Colors.kakaoText, fontWeight: "900", fontSize: 18 }}>
                  카카오로 로그인
                </Text>
              </>
            )}
          </Pressable>

          {/* 애플 로그인 버튼 (iOS 전용) */}
          {Platform.OS === "ios" && (
            <Pressable
              onPress={handleAppleLogin}
              disabled={loading}
              style={({ pressed }) => ({
                width: "100%",
                height: 64,
                borderRadius: 22,
                backgroundColor: pressed ? "#333" : "#000",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                marginBottom: 24,
                opacity: loading ? 0.7 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  {/* 애플 로고 */}
                  <Svg width={20} height={24} viewBox="0 0 814 1000" style={{ marginRight: 10 }}>
                    <Path
                      d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 133.4-318.1 264.4-318.1 70.1 0 128.4 46.4 172.5 46.4 42.8 0 109.6-49.1 190.5-49.1zm-11.5-212.5c34.1-40.2 58.4-96.2 58.4-152.2 0-7.8-.6-15.6-1.9-22.7-55.4 2.1-121.8 36.8-161.3 84.4-31.3 36.1-61 92.1-61 148.8 0 8.4 1.3 16.9 1.9 19.5 3.3.6 8.4 1.3 13.6 1.3 49.9 0 112.3-33.5 150.3-79.1z"
                      fill="#fff"
                    />
                  </Svg>
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 18 }}>
                    Apple로 로그인
                  </Text>
                </>
              )}
            </Pressable>
          )}

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
