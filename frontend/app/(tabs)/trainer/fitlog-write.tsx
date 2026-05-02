import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { apiGet, toDateKey } from "../../../hooks/useApi";
import { Exercise, ExerciseSet, Member } from "../../../types";

const PRESET_EXERCISES = [
  "벤치프레스", "인클라인 벤치프레스", "덤벨 플라이",
  "스쿼트", "레그프레스", "레그컬", "레그익스텐션",
  "데드리프트", "루마니안 데드리프트",
  "풀업", "랫풀다운", "시티드 로우",
  "숄더프레스", "사이드 레터럴 레이즈",
  "바벨컬", "해머컬", "트라이셉스 익스텐션",
  "플랭크", "크런치", "레그레이즈",
];

export default function FitLogWriteScreen() {
  const { memberId: memberIdParam } = useLocalSearchParams<{ memberId?: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(
    memberIdParam ? Number(memberIdParam) : null
  );
  const [date, setDate] = useState(toDateKey(new Date()));
  const [exercises, setExercises] = useState<Exercise[]>([
    { name: "", sets: [{ setNumber: 1, weight: 0, reps: 0 }] },
  ]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState<number | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await apiGet<Member[]>(ENDPOINTS.trainer.members);
        setMembers(data);
      } catch {
        setMembers([
          { id: 1, user: { id: 1, name: "김지수" }, ptRemaining: 12, ptTotal: 20, status: "ACTIVE" },
          { id: 2, user: { id: 2, name: "이준호" }, ptRemaining: 18, ptTotal: 30, status: "ACTIVE" },
          { id: 3, user: { id: 3, name: "박민지" }, ptRemaining: 3, ptTotal: 10, status: "ACTIVE" },
        ]);
      }
    };
    fetchMembers();
  }, []);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const addExercise = () => {
    setExercises((prev) => [
      ...prev,
      { name: "", sets: [{ setNumber: 1, weight: 0, reps: 0 }] },
    ]);
  };

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const updateExerciseName = (index: number, name: string) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, name } : ex))
    );
  };

  const addSet = (exIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIndex
          ? {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  setNumber: ex.sets.length + 1,
                  weight: ex.sets[ex.sets.length - 1]?.weight ?? 0,
                  reps: ex.sets[ex.sets.length - 1]?.reps ?? 0,
                },
              ],
            }
          : ex
      )
    );
  };

  const removeSet = (exIndex: number, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIndex
          ? {
              ...ex,
              sets: ex.sets
                .filter((_, si) => si !== setIndex)
                .map((s, si) => ({ ...s, setNumber: si + 1 })),
            }
          : ex
      )
    );
  };

  const updateSet = (
    exIndex: number,
    setIndex: number,
    field: keyof ExerciseSet,
    value: string
  ) => {
    const num = parseFloat(value) || 0;
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === exIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si === setIndex ? { ...s, [field]: num } : s
              ),
            }
          : ex
      )
    );
  };

  const handleSave = async () => {
    if (!selectedMemberId) {
      Alert.alert("오류", "회원을 선택해주세요.");
      return;
    }
    const validExercises = exercises.filter((ex) => ex.name.trim());
    if (validExercises.length === 0) {
      Alert.alert("오류", "운동을 최소 1개 이상 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}${ENDPOINTS.fitlog.create}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          memberId: selectedMemberId,
          date,
          exercises: validExercises,
          memo: memo.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "저장 실패");
      }

      Alert.alert("완료", "FitLog가 저장됐어요! 🎉", [
        { text: "확인", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 헤더 */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 22, color: Colors.textMuted }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.text }}>FitLog 작성</Text>
        </View>

        {/* 회원 선택 */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textSub, marginBottom: 8 }}>
          회원 선택 <Text style={{ color: Colors.red }}>*</Text>
        </Text>
        <TouchableOpacity
          onPress={() => setShowMemberPicker(true)}
          style={{
            backgroundColor: Colors.bgSub,
            borderWidth: 1.5,
            borderColor: selectedMember ? Colors.green : Colors.border,
            borderRadius: 12,
            padding: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          {selectedMember ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>{selectedMember.user.name[0]}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{selectedMember.user.name}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: Colors.textPlaceholder }}>회원을 선택하세요</Text>
          )}
          <Text style={{ color: Colors.textMuted }}>▾</Text>
        </TouchableOpacity>

        {/* 날짜 */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textSub, marginBottom: 8 }}>날짜</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textPlaceholder}
          style={{
            backgroundColor: Colors.bgSub,
            borderWidth: 1.5,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 15,
            color: Colors.text,
            marginBottom: 20,
          }}
        />

        {/* 운동 목록 */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <View style={{ width: 3, height: 16, backgroundColor: Colors.green, borderRadius: 2 }} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1 }}>운동 목록</Text>
        </View>

        {exercises.map((ex, exIdx) => (
          <View
            key={exIdx}
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 14,
              padding: 14,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            {/* 운동 이름 */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              <TouchableOpacity
                onPress={() => setShowExercisePicker(exIdx)}
                style={{
                  flex: 1,
                  backgroundColor: "#fff",
                  borderWidth: 1.5,
                  borderColor: ex.name ? Colors.green : Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: ex.name ? Colors.text : Colors.textPlaceholder, fontWeight: ex.name ? "700" : "400" }}>
                  {ex.name || "운동 선택 / 직접 입력"}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 12 }}>▾</Text>
              </TouchableOpacity>
              {exercises.length > 1 && (
                <TouchableOpacity
                  onPress={() => removeExercise(exIdx)}
                  style={{ width: 40, height: 40, backgroundColor: Colors.redBg, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: Colors.red + "44" }}
                >
                  <Text style={{ fontSize: 18, color: Colors.red }}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 세트 헤더 */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
              <Text style={{ width: 32, fontSize: 11, color: Colors.textMuted, textAlign: "center" }}>세트</Text>
              <Text style={{ flex: 1, fontSize: 11, color: Colors.textMuted, textAlign: "center" }}>무게(kg)</Text>
              <Text style={{ flex: 1, fontSize: 11, color: Colors.textMuted, textAlign: "center" }}>횟수</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* 세트 목록 */}
            {ex.sets.map((set, setIdx) => (
              <View key={setIdx} style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <View style={{ width: 32, height: 32, backgroundColor: Colors.green, borderRadius: 8, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{set.setNumber}</Text>
                </View>
                <TextInput
                  value={set.weight === 0 ? "" : String(set.weight)}
                  onChangeText={(v) => updateSet(exIdx, setIdx, "weight", v)}
                  placeholder="0"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8, textAlign: "center", fontSize: 14, color: Colors.text }}
                />
                <TextInput
                  value={set.reps === 0 ? "" : String(set.reps)}
                  onChangeText={(v) => updateSet(exIdx, setIdx, "reps", v)}
                  placeholder="0"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 8, textAlign: "center", fontSize: 14, color: Colors.text }}
                />
                {ex.sets.length > 1 ? (
                  <TouchableOpacity
                    onPress={() => removeSet(exIdx, setIdx)}
                    style={{ width: 32, height: 32, justifyContent: "center", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 18, color: Colors.textMuted }}>×</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 32 }} />
                )}
              </View>
            ))}

            {/* 세트 추가 */}
            <TouchableOpacity
              onPress={() => addSet(exIdx)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6, paddingVertical: 8, borderWidth: 1, borderColor: Colors.green + "44", borderRadius: 8, backgroundColor: Colors.greenLight }}
            >
              <Text style={{ fontSize: 13, color: Colors.green, fontWeight: "700" }}>+ 세트 추가</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 운동 추가 버튼 */}
        <TouchableOpacity
          onPress={addExercise}
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.green, borderRadius: 14, borderStyle: "dashed", marginBottom: 16 }}
        >
          <Text style={{ fontSize: 22, color: Colors.green }}>+</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.green }}>운동 추가</Text>
        </TouchableOpacity>

        {/* 메모 */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textSub, marginBottom: 8 }}>메모 (선택)</Text>
        <TextInput
          value={memo}
          onChangeText={setMemo}
          placeholder="오늘 수업 특이사항, 컨디션 등을 기록하세요"
          placeholderTextColor={Colors.textPlaceholder}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: Colors.bgSub,
            borderWidth: 1.5,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 14,
            fontSize: 14,
            color: Colors.text,
            textAlignVertical: "top",
            minHeight: 80,
            marginBottom: 24,
          }}
        />

        {/* 저장 버튼 */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? Colors.border : Colors.green,
            borderRadius: 14,
            padding: 17,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: saving ? Colors.textMuted : "#fff" }}>
            {saving ? "저장 중..." : "💾 FitLog 저장"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 회원 선택 모달 */}
      <Modal visible={showMemberPicker} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "60%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>회원 선택</Text>
            <ScrollView>
              {members.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => { setSelectedMemberId(m.id); setShowMemberPicker(false); }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 6,
                    backgroundColor: selectedMemberId === m.id ? Colors.greenLight : Colors.bgSub,
                    borderWidth: 1,
                    borderColor: selectedMemberId === m.id ? Colors.green : Colors.border,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center", marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{m.user.name[0]}</Text>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1 }}>{m.user.name}</Text>
                  {selectedMemberId === m.id && <Text style={{ color: Colors.green, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 운동 선택 모달 */}
      <Modal visible={showExercisePicker !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "70%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>운동 선택</Text>
            <ScrollView>
              {/* 직접 입력 */}
              <TextInput
                placeholder="직접 입력..."
                placeholderTextColor={Colors.textPlaceholder}
                onSubmitEditing={(e) => {
                  if (showExercisePicker !== null) {
                    updateExerciseName(showExercisePicker, e.nativeEvent.text);
                    setShowExercisePicker(null);
                  }
                }}
                style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 12 }}
              />
              {PRESET_EXERCISES.map((name) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => {
                    if (showExercisePicker !== null) {
                      updateExerciseName(showExercisePicker, name);
                      setShowExercisePicker(null);
                    }
                  }}
                  style={{ padding: 14, borderRadius: 10, marginBottom: 4, backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border }}
                >
                  <Text style={{ fontSize: 14, color: Colors.text }}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
