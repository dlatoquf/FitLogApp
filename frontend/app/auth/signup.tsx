import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";

type Role = "trainer" | "member" | null;

export default function SignupScreen() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [name, setName] = useState("");
  const [isAppleName, setIsAppleName] = useState(false);

  useEffect(() => {
    const loadName = async () => {
      const loginMethod = await AsyncStorage.getItem("loginMethod");
      const isApple = loginMethod === "apple";

      const appleName = await AsyncStorage.getItem("appleProvidedName");
      if (appleName) {
        setName(appleName);
        setIsAppleName(true);
        await AsyncStorage.removeItem("appleProvidedName");
        return;
      }

      // Apple 로그인이면 항상 이름 칸 숨김 — DB에서 이름 조회
      if (isApple) {
        setIsAppleName(true);
        const jwt = await AsyncStorage.getItem("jwt");
        if (jwt) {
          try {
            const { API_URL } = await import("../../constants/api");
            const res = await fetch(`${API_URL}/api/me`, {
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.name) setName(data.name);
            }
          } catch {}
        }
        await AsyncStorage.removeItem("loginMethod");
      }
    };
    loadName();
  }, []);

  const canNext = selectedRole !== null && (isAppleName || name.trim().length > 0);

  const handleNext = async () => {
    if (!canNext) return;
    await AsyncStorage.setItem("pendingName", name.trim());
    if (selectedRole === "trainer") {
      router.push("/auth/signup-trainer");
    } else {
      router.push("/auth/signup-member");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: 56,
            paddingBottom: 40,
          }}
        >
          {/* 뒤로가기 */}
          <Pressable onPress={() => router.replace("/auth/login")} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 22, color: Colors.text }}>←</Text>
          </Pressable>

          <Text
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: Colors.text,
              marginBottom: 8,
            }}
          >
            역할을 선택하세요
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: Colors.textMuted,
              marginBottom: 28,
            }}
          >
            역할에 따라 다른 화면이 제공돼요
          </Text>

          {/* 트레이너 카드 */}
          <Pressable
            onPress={() => setSelectedRole("trainer")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 2,
              borderColor:
                selectedRole === "trainer" ? Colors.green : Colors.border,
              borderRadius: 16,
              padding: 18,
              marginBottom: 14,
              backgroundColor:
                selectedRole === "trainer" ? Colors.greenLight : "#fff",
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                backgroundColor: Colors.greenBg,
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <Text style={{ fontSize: 26 }}>🏋️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: Colors.text,
                  marginBottom: 3,
                }}
              >
                트레이너
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textSub }}>
                회원 관리 · FitLog 작성 · 일정 조율
              </Text>
            </View>
            {selectedRole === "trainer" && <CheckBadge />}
          </Pressable>

          {/* 회원 카드 */}
          <Pressable
            onPress={() => setSelectedRole("member")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 2,
              borderColor:
                selectedRole === "member" ? Colors.blue : Colors.border,
              borderRadius: 16,
              padding: 18,
              marginBottom: 28,
              backgroundColor:
                selectedRole === "member" ? Colors.blueBg : "#fff",
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                backgroundColor: "#E8F0F5",
                borderRadius: 12,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 16,
              }}
            >
              <Text style={{ fontSize: 26 }}>🧑‍💪</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "700",
                  color: Colors.text,
                  marginBottom: 3,
                }}
              >
                회원
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textSub }}>
                운동 확인 · 식단 기록 · 성장 추적
              </Text>
            </View>
            {selectedRole === "member" && (
              <CheckBadge color={Colors.blue} />
            )}
          </Pressable>

          {/* 이름 입력 — Apple 로그인이면 자동입력이므로 숨김 */}
          {!isAppleName && (
            <>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: Colors.textSub,
                  marginBottom: 6,
                }}
              >
                이름
              </Text>
              <TextInput
                placeholder="이름을 입력하세요"
                placeholderTextColor={Colors.textPlaceholder}
                value={name}
                onChangeText={setName}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderWidth: 1.5,
                  borderColor: name.trim() ? Colors.green : Colors.border,
                  padding: 15,
                  borderRadius: 12,
                  marginBottom: 32,
                  fontSize: 15,
                  color: Colors.text,
                }}
              />
            </>
          )}

          <View style={{ flex: 1 }} />

          {/* 다음 버튼 */}
          <Pressable
            onPress={handleNext}
            style={({ pressed }) => ({
              backgroundColor: canNext
                ? pressed
                  ? "#256e47"
                  : Colors.green
                : Colors.border,
              padding: 17,
              borderRadius: 14,
              alignItems: "center",
            })}
          >
            <Text
              style={{
                color: canNext ? "#fff" : Colors.textMuted,
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              다음 →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CheckBadge({ color = Colors.green }: { color?: string }) {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: color,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>✓</Text>
    </View>
  );
}
