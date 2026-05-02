import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { API_URL } from "../../constants/api";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function SignupMemberScreen() {
  const [phone, setPhone] = useState("");
  const [trainerCode, setTrainerCode] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [muscleMass, setMuscleMass] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerifyCode = async () => {
    if (trainerCode.trim().length < 4) {
      Alert.alert("입력 오류", "트레이너 코드를 입력해주세요.");
      return;
    }
    setVerifying(true);
    // 실제로는 서버에 코드 검증 요청을 보내야 합니다.
    // 현재는 6자리 코드를 입력하면 검증 성공으로 처리합니다.
    setTimeout(() => {
      setVerifying(false);
      setCodeVerified(true);
    }, 800);
  };

  const handleSubmit = async () => {
    if (!phone.trim()) {
      Alert.alert("입력 오류", "전화번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const name = await AsyncStorage.getItem("pendingName");

      const body: Record<string, any> = {
        name,
        phone: phone.replace(/-/g, ""),
        trainerCode: trainerCode.trim() || undefined,
      };
      if (height) body.height = parseFloat(height);
      if (weight) body.weight = parseFloat(weight);
      if (bodyFat) body.bodyFat = parseFloat(bodyFat);
      if (muscleMass) body.muscleMass = parseFloat(muscleMass);

      const res = await fetch(`${API_URL}/api/profile/member`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "프로필 저장 실패");
      }

      await AsyncStorage.removeItem("pendingName");
      router.replace("/(tabs)/member/home");
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "알 수 없는 오류가 발생했어요.");
    } finally {
      setLoading(false);
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
          <Pressable onPress={() => router.back()} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 22, color: Colors.text }}>←</Text>
          </Pressable>

          <Text
            style={{
              fontSize: 11,
              color: Colors.textMuted,
              marginBottom: 4,
              fontWeight: "600",
            }}
          >
            회원 가입 · 프로필 정보
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: Colors.text,
              marginBottom: 28,
            }}
          >
            기본 정보를 입력해주세요
          </Text>

          {/* 전화번호 */}
          <FieldLabel label="전화번호" required />
          <TextInput
            placeholder="010-0000-0000"
            placeholderTextColor={Colors.textPlaceholder}
            value={phone}
            onChangeText={(v) => setPhone(formatPhone(v))}
            keyboardType="phone-pad"
            style={inputStyle(!!phone)}
          />

          {/* 트레이너 코드 */}
          <FieldLabel label="트레이너 코드 (선택)" />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            <TextInput
              placeholder="트레이너에게 받은 코드 입력"
              placeholderTextColor={Colors.textPlaceholder}
              value={trainerCode}
              onChangeText={(v) => {
                setTrainerCode(v.toUpperCase());
                setCodeVerified(false);
              }}
              autoCapitalize="characters"
              style={[inputStyle(!!trainerCode), { flex: 1, marginBottom: 0 }]}
            />
            <Pressable
              onPress={handleVerifyCode}
              disabled={verifying || codeVerified}
              style={{
                backgroundColor: codeVerified
                  ? Colors.green
                  : Colors.bgSub,
                borderWidth: 1.5,
                borderColor: codeVerified ? Colors.green : Colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: codeVerified ? "#fff" : Colors.textSub,
                }}
              >
                {verifying ? "..." : codeVerified ? "✓ 확인" : "확인"}
              </Text>
            </Pressable>
          </View>

          {/* 신체 정보 */}
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: Colors.text,
              marginBottom: 4,
            }}
          >
            신체 정보 (선택)
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: Colors.textMuted,
              marginBottom: 16,
            }}
          >
            나중에 설정에서도 입력할 수 있어요
          </Text>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 0 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="키 (cm)" />
              <UnitInput
                value={height}
                onChangeText={setHeight}
                unit="cm"
                placeholder="170"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="체중 (kg)" />
              <UnitInput
                value={weight}
                onChangeText={setWeight}
                unit="kg"
                placeholder="70"
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 32 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="체지방률 (%)" />
              <UnitInput
                value={bodyFat}
                onChangeText={setBodyFat}
                unit="%"
                placeholder="20"
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="골격근량 (kg)" />
              <UnitInput
                value={muscleMass}
                onChangeText={setMuscleMass}
                unit="kg"
                placeholder="30"
              />
            </View>
          </View>

          <View style={{ flex: 1 }} />

          {/* 가입 완료 버튼 */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading || !phone.trim()}
            style={({ pressed }) => ({
              backgroundColor:
                loading || !phone.trim()
                  ? Colors.border
                  : pressed
                  ? "#256e47"
                  : Colors.green,
              padding: 17,
              borderRadius: 14,
              alignItems: "center",
            })}
          >
            <Text
              style={{
                color: loading || !phone.trim() ? Colors.textMuted : "#fff",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              {loading ? "처리 중..." : "가입 완료 ✓"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "600",
        color: Colors.textSub,
        marginBottom: 8,
      }}
    >
      {label}
      {required && (
        <Text style={{ color: Colors.red }}> *</Text>
      )}
    </Text>
  );
}

function inputStyle(active: boolean) {
  return {
    backgroundColor: Colors.bgSub,
    borderWidth: 1.5,
    borderColor: active ? Colors.green : Colors.border,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    fontSize: 15,
    color: Colors.text,
  };
}

function UnitInput({
  value,
  onChangeText,
  unit,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  unit: string;
  placeholder: string;
}) {
  return (
    <View
      style={{
        backgroundColor: Colors.bgSub,
        borderWidth: 1.5,
        borderColor: value ? Colors.green : Colors.border,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
        marginBottom: 20,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textPlaceholder}
        keyboardType="decimal-pad"
        style={{ flex: 1, fontSize: 15, color: Colors.text, paddingVertical: 14 }}
      />
      <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "600" }}>
        {unit}
      </Text>
    </View>
  );
}
