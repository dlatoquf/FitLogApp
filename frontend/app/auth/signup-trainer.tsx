import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { API_URL } from "../../constants/api";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const HOURS = Array.from({ length: 21 }, (_, i) => `${String(i + 4).padStart(2, "0")}:00`);

export default function SignupTrainerScreen() {
  const [gymName, setGymName] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("22:00");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleDay = (i: number) => {
    setSelectedDays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
    );
  };

  const handleSubmit = async () => {
    if (!gymName.trim()) {
      Alert.alert("입력 오류", "헬스장명을 입력해주세요.");
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert("입력 오류", "근무 요일을 선택해주세요.");
      return;
    }

    setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const name = await AsyncStorage.getItem("pendingName");

      const res = await fetch(`${API_URL}/api/profile/trainer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          name,
          gymName: gymName.trim(),
          workDays: selectedDays.map((i) => DAYS[i]).join(","),
          startTime,
          endTime,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "프로필 저장 실패");
      }

      await AsyncStorage.removeItem("pendingName");
      router.replace("/(tabs)/trainer/home");
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
            트레이너 가입 · 근무 정보
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: "800",
              color: Colors.text,
              marginBottom: 28,
            }}
          >
            근무 정보를 입력해주세요
          </Text>

          {/* 헬스장명 */}
          <FieldLabel label="헬스장명" />
          <TextInput
            placeholder="예: 강남 핏라이프 PT센터"
            placeholderTextColor={Colors.textPlaceholder}
            value={gymName}
            onChangeText={setGymName}
            style={inputStyle(!!gymName)}
          />

          {/* 근무 요일 */}
          <FieldLabel label="근무 요일" />
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                onPress={() => toggleDay(i)}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: selectedDays.includes(i)
                    ? Colors.green
                    : Colors.bgSub,
                  borderWidth: 1.5,
                  borderColor: selectedDays.includes(i)
                    ? Colors.green
                    : Colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: selectedDays.includes(i) ? "#fff" : Colors.textMuted,
                  }}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 근무 시간 */}
          <FieldLabel label="근무 시간" />
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
            {/* 출근 시간 */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  marginBottom: 4,
                }}
              >
                출근
              </Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderWidth: 1.5,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: Colors.green,
                  }}
                >
                  {startTime}
                </Text>
                <Text style={{ color: Colors.textMuted }}>▾</Text>
              </TouchableOpacity>
            </View>
            {/* 퇴근 시간 */}
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  marginBottom: 4,
                }}
              >
                퇴근
              </Text>
              <TouchableOpacity
                onPress={() => setShowEndPicker(true)}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderWidth: 1.5,
                  borderColor: Colors.border,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: Colors.green,
                  }}
                >
                  {endTime}
                </Text>
                <Text style={{ color: Colors.textMuted }}>▾</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 트레이너 코드 안내 */}
          <View
            style={{
              backgroundColor: Colors.greenLight,
              borderWidth: 1,
              borderColor: Colors.green + "44",
              borderRadius: 14,
              padding: 16,
              marginBottom: 32,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.green,
                marginBottom: 4,
              }}
            >
              💡 트레이너 코드 안내
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textSub, lineHeight: 20 }}>
              가입 완료 후 고유한 트레이너 코드가 발급됩니다.{"\n"}
              회원에게 코드를 공유하면 자동으로 연결돼요.
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          {/* 가입 완료 버튼 */}
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => ({
              backgroundColor:
                loading ? Colors.border : pressed ? "#256e47" : Colors.green,
              padding: 17,
              borderRadius: 14,
              alignItems: "center",
            })}
          >
            <Text
              style={{
                color: loading ? Colors.textMuted : "#fff",
                fontWeight: "700",
                fontSize: 16,
              }}
            >
              {loading ? "처리 중..." : "가입 완료 ✓"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 출근 시간 피커 */}
      <TimePicker
        visible={showStartPicker}
        title="출근 시간"
        hours={HOURS}
        selected={startTime}
        onSelect={(h) => { setStartTime(h); setShowStartPicker(false); }}
        onClose={() => setShowStartPicker(false)}
      />

      {/* 퇴근 시간 피커 */}
      <TimePicker
        visible={showEndPicker}
        title="퇴근 시간"
        hours={HOURS}
        selected={endTime}
        onSelect={(h) => { setEndTime(h); setShowEndPicker(false); }}
        onClose={() => setShowEndPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label }: { label: string }) {
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

function TimePicker({
  visible,
  title,
  hours,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  hours: string[];
  selected: string;
  onSelect: (h: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
            maxHeight: "60%",
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: Colors.border,
              borderRadius: 99,
              alignSelf: "center",
              marginBottom: 16,
            }}
          />
          <Text
            style={{
              fontSize: 17,
              fontWeight: "800",
              color: Colors.text,
              marginBottom: 16,
            }}
          >
            {title}
          </Text>
          <ScrollView>
            {hours.map((h) => (
              <TouchableOpacity
                key={h}
                onPress={() => onSelect(h)}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  marginBottom: 4,
                  backgroundColor:
                    selected === h ? Colors.greenLight : Colors.bgSub,
                  borderWidth: 1,
                  borderColor:
                    selected === h ? Colors.green : Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: selected === h ? "700" : "400",
                    color: selected === h ? Colors.green : Colors.text,
                  }}
                >
                  {h}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={{ marginTop: 12, alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
