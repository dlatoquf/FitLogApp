import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { ENDPOINTS } from "../../../constants/api";
import { apiGet, apiPut, toDateKey } from "../../../hooks/useApi";
import { BodyLog, DietFeedback, DietResponse, FitLog, Member } from "../../../types";

const MEAL_TYPES = [
  { key: "BREAKFAST", label: "아침", emoji: "🌅" },
  { key: "LUNCH", label: "점심", emoji: "☀️" },
  { key: "DINNER", label: "저녁", emoji: "🌙" },
  { key: "SNACK", label: "간식", emoji: "🍎" },
];

export default function MemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dietData, setDietData] = useState<DietResponse | null>(null);
  const [fitLogs, setFitLogs] = useState<FitLog[]>([]);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<DietFeedback[]>([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [showPTEdit, setShowPTEdit] = useState(false);
  const [ptForm, setPtForm] = useState({ total: "0", remain: "0", startDate: "", expDate: "", memo: "" });

  const fetchMember = async () => {
    try {
      const data = await apiGet<Member>(`/api/trainer/members/${memberId}`);
      setMember(data);
      setPtForm({
        total: String(data.ptTotal || 0),
        remain: String(data.ptRemaining || 0),
        startDate: data.ptStartDate || "",
        expDate: data.ptExpDate || "",
        memo: data.memo || "",
      });
    } catch {
      const dummy: Member = {
        id: memberId,
        user: { id: memberId, name: "김지수" },
        ptRemaining: 12,
        ptTotal: 20,
        ptStartDate: "2025-03-01",
        ptExpDate: "2025-06-30",
        goal: "체지방 감량",
        memo: "",
        status: "ACTIVE",
      };
      setMember(dummy);
      setPtForm({
        total: String(dummy.ptTotal),
        remain: String(dummy.ptRemaining),
        startDate: dummy.ptStartDate || "",
        expDate: dummy.ptExpDate || "",
        memo: dummy.memo || "",
      });
    }
  };

  const fetchDiet = async () => {
    try {
      const data = await apiGet<DietResponse>(
        `${ENDPOINTS.diet.member(memberId)}?date=${toDateKey(selectedDate)}`
      );
      setDietData(data);
    } catch {
      setDietData(null);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const data = await apiGet<DietFeedback[]>(ENDPOINTS.diet.feedbackByMember(memberId));
      setFeedbacks(data);
    } catch {
      setFeedbacks([]);
    }
  };

  const fetchFitLogs = async () => {
    try {
      const data = await apiGet<FitLog[]>(ENDPOINTS.fitlog.byMember(memberId));
      setFitLogs(data);
    } catch {
      setFitLogs([
        {
          id: 1,
          memberId,
          date: toDateKey(new Date()),
          exercises: [
            { name: "벤치프레스", sets: [{ setNumber: 1, weight: 60, reps: 12 }, { setNumber: 2, weight: 70, reps: 10 }, { setNumber: 3, weight: 80, reps: 8 }] },
            { name: "인클라인 덤벨", sets: [{ setNumber: 1, weight: 16, reps: 12 }, { setNumber: 2, weight: 18, reps: 10 }] },
          ],
          memo: "오늘 컨디션 좋음",
        },
      ]);
    }
  };

  const fetchBodyLogs = async () => {
    try {
      const data = await apiGet<BodyLog[]>(ENDPOINTS.bodylog.member(memberId));
      setBodyLogs(data);
    } catch {
      setBodyLogs([
        { date: "2025-04-18", weight: 77.2, bodyFat: 23.1, muscleMass: 31.8 },
        { date: "2025-04-22", weight: 76.8, bodyFat: 22.6, muscleMass: 32.1 },
        { date: "2025-04-25", weight: 76.5, bodyFat: 22.1, muscleMass: 32.4 },
        { date: "2025-04-28", weight: 76.0, bodyFat: 21.8, muscleMass: 32.6 },
        { date: "2025-05-01", weight: 75.2, bodyFat: 21.2, muscleMass: 32.9 },
      ]);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchMember();
      setLoading(false);
    };
    init();
  }, [memberId]);

  useEffect(() => {
    if (tab === 0) { fetchDiet(); fetchFeedbacks(); }
    else if (tab === 1) fetchFitLogs();
    else if (tab === 2) fetchBodyLogs();
  }, [tab, selectedDate]);

  const sendFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSendingFeedback(true);
    try {
      await apiPut(ENDPOINTS.diet.feedback, {
        memberId,
        targetDate: toDateKey(selectedDate),
        comment: feedbackText,
      });
      setFeedbackText("");
      fetchFeedbacks();
      Alert.alert("완료", "피드백이 전송됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSendingFeedback(false);
    }
  };

  const savePT = async () => {
    try {
      await apiPut(ENDPOINTS.trainer.updatePt(memberId), {
        ptTotal: Number(ptForm.total),
        ptRemaining: Number(ptForm.remain),
        ptStartDate: ptForm.startDate || undefined,
        ptExpDate: ptForm.expDate || undefined,
        memo: ptForm.memo,
      });
      setShowPTEdit(false);
      fetchMember();
      Alert.alert("완료", "PT 정보가 수정됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    }
  };

  if (loading || !member) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const ptPct = member.ptTotal > 0 ? (member.ptRemaining / member.ptTotal) * 100 : 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* 헤더 */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 22, color: Colors.textMuted }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.text }}>
            {member.user.name}
          </Text>
          {member.goal && (
            <View style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{member.goal}</Text>
            </View>
          )}
        </View>

        {/* PT 잔여 카드 */}
        <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: member.ptTotal > 0 ? 10 : 0 }}>
            <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-end" }}>
              <View>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>잔여</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.blue }}>
                  {member.ptRemaining ?? "-"}회
                </Text>
              </View>
              {member.ptTotal > 0 && (
                <View>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>총</Text>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.textSub }}>
                    {member.ptTotal}회
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  if ((member.ptRemaining || 0) > 0) {
                    setMember({ ...member, ptRemaining: (member.ptRemaining || 0) - 1 });
                  }
                }}
                style={{ width: 32, height: 32, backgroundColor: Colors.redBg, borderWidth: 1, borderColor: Colors.red + "44", borderRadius: 8, justifyContent: "center", alignItems: "center" }}
              >
                <Text style={{ fontSize: 18, color: Colors.red, fontWeight: "700" }}>−</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowPTEdit(true)}
                style={{ backgroundColor: Colors.blue, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>수정</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMember({ ...member, ptRemaining: (member.ptRemaining || 0) + 10 })}
                style={{ backgroundColor: Colors.green, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+10</Text>
              </TouchableOpacity>
            </View>
          </View>
          {member.ptTotal > 0 && (
            <>
              <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 6 }}>
                <View style={{ width: `${Math.min(ptPct, 100)}%` as any, height: 6, backgroundColor: Colors.blue, borderRadius: 99 }} />
              </View>
              {member.ptStartDate && (
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
                  {member.ptStartDate} 시작{member.ptExpDate ? ` · ${member.ptExpDate} 만료` : ""}
                </Text>
              )}
            </>
          )}
        </View>

        {/* 탭 */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {["식단", "운동", "바디로그"].map((t, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setTab(i)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                backgroundColor: tab === i ? Colors.green : Colors.bgSub,
                borderWidth: 1, borderColor: tab === i ? Colors.green : Colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: tab === i ? "#fff" : Colors.textMuted }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 탭 콘텐츠 */}
        {tab === 0 && (
          <DietTab
            dietData={dietData}
            feedbacks={feedbacks}
            feedbackText={feedbackText}
            setFeedbackText={setFeedbackText}
            sendFeedback={sendFeedback}
            sendingFeedback={sendingFeedback}
            memberName={member.user.name}
          />
        )}
        {tab === 1 && <FitLogTab fitLogs={fitLogs} />}
        {tab === 2 && <BodyLogTab bodyLogs={bodyLogs} />}
      </ScrollView>

      {/* PT 수정 모달 */}
      <Modal visible={showPTEdit} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>PT 횟수 수정</Text>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
              {[["총 횟수", "total"], ["잔여 횟수", "remain"]].map(([label, key]) => (
                <View key={key} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>{label}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, overflow: "hidden" }}>
                    <TouchableOpacity
                      onPress={() => setPtForm((f) => ({ ...f, [key]: String(Math.max(0, Number(f[key as keyof typeof f]) - 1)) }))}
                      style={{ padding: 12, borderRightWidth: 1, borderRightColor: Colors.border }}
                    >
                      <Text style={{ fontSize: 18, color: Colors.textMuted }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: key === "remain" ? Colors.blue : Colors.text }}>
                      {ptForm[key as keyof typeof ptForm]}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPtForm((f) => ({ ...f, [key]: String(Number(f[key as keyof typeof f]) + 1) }))}
                      style={{ padding: 12, borderLeftWidth: 1, borderLeftColor: Colors.border }}
                    >
                      <Text style={{ fontSize: 18, color: Colors.green }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>시작일</Text>
            <TextInput
              value={ptForm.startDate}
              onChangeText={(v) => setPtForm((f) => ({ ...f, startDate: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textPlaceholder}
              style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 10 }}
            />
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>만료일 (선택)</Text>
            <TextInput
              value={ptForm.expDate}
              onChangeText={(v) => setPtForm((f) => ({ ...f, expDate: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textPlaceholder}
              style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 10 }}
            />
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>메모</Text>
            <TextInput
              value={ptForm.memo}
              onChangeText={(v) => setPtForm((f) => ({ ...f, memo: v }))}
              placeholder="예: 추가 결제 10회"
              placeholderTextColor={Colors.textPlaceholder}
              style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text, marginBottom: 16 }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowPTEdit(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={savePT}
                style={{ flex: 2, backgroundColor: Colors.green, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── 식단 탭 ──────────────────────────────────────────────────────────────────
function DietTab({
  dietData, feedbacks, feedbackText, setFeedbackText, sendFeedback, sendingFeedback, memberName,
}: {
  dietData: DietResponse | null;
  feedbacks: DietFeedback[];
  feedbackText: string;
  setFeedbackText: (v: string) => void;
  sendFeedback: () => void;
  sendingFeedback: boolean;
  memberName: string;
}) {
  const GOAL_KCAL = 2000;
  const total = dietData?.totalCalories ?? 0;

  return (
    <View>
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 2 }}>{memberName}님 칼로리</Text>
            <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.gold }}>
              {Math.round(total).toLocaleString()}
              <Text style={{ fontSize: 13, color: Colors.textMuted }}> / {GOAL_KCAL} kcal</Text>
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: total > GOAL_KCAL ? Colors.red : Colors.green, fontWeight: "700" }}>
            {total > GOAL_KCAL ? `${Math.round(total - GOAL_KCAL)} 초과` : `${Math.round(GOAL_KCAL - total)} 남음`}
          </Text>
        </View>
        <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 8, marginBottom: 12 }}>
          <View style={{ width: `${Math.min((total / GOAL_KCAL) * 100, 100)}%` as any, height: 8, borderRadius: 99, backgroundColor: total > GOAL_KCAL ? Colors.red : Colors.green }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          {[["탄수화물", dietData?.totalCarbs ?? 0, Colors.blue], ["단백질", dietData?.totalProtein ?? 0, Colors.green], ["지방", dietData?.totalFat ?? 0, Colors.gold]].map(([l, v, c]) => (
            <View key={l as string} style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: c as string }}>{Math.round(v as number)}<Text style={{ fontSize: 11 }}>g</Text></Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      {MEAL_TYPES.map(({ key, label, emoji }) => {
        const mealGroup = dietData?.meals.find((m) => m.mealType === key);
        const foods = mealGroup?.foods ?? [];
        const mealCal = foods.reduce((s, f) => s + f.calories, 0);
        return (
          <View key={key} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Text style={{ fontSize: 16 }}>{emoji}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>{label}</Text>
              {mealCal > 0 && <Text style={{ fontSize: 12, color: Colors.textMuted }}>{Math.round(mealCal)} kcal</Text>}
            </View>
            {foods.length === 0 ? (
              <View style={{ backgroundColor: Colors.bgSub, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 12, color: Colors.textPlaceholder }}>기록 없음</Text>
              </View>
            ) : (
              foods.map((f, i) => (
                <View key={i} style={{ backgroundColor: Colors.bgSub, borderRadius: 10, padding: 12, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: Colors.green, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.text }}>{f.foodName}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>탄 {f.carbs}g · 단 {f.protein}g · 지 {f.fat}g</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.gold }}>{f.calories}kcal</Text>
                </View>
              ))
            )}
          </View>
        );
      })}

      <View style={{ backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", borderRadius: 14, padding: 14, marginTop: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.green, marginBottom: 10 }}>
          💬 {memberName}님께 피드백
        </Text>
        <TextInput
          value={feedbackText}
          onChangeText={setFeedbackText}
          placeholder="식단에 대한 피드백을 입력하세요..."
          placeholderTextColor={Colors.textPlaceholder}
          multiline
          numberOfLines={3}
          style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 13, color: Colors.text, textAlignVertical: "top", marginBottom: 10, minHeight: 70 }}
        />
        <TouchableOpacity
          onPress={sendFeedback}
          disabled={sendingFeedback || !feedbackText.trim()}
          style={{ backgroundColor: feedbackText.trim() ? Colors.green : Colors.border, borderRadius: 10, padding: 12, alignItems: "center" }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: feedbackText.trim() ? "#fff" : Colors.textMuted }}>
            {sendingFeedback ? "전송 중..." : "📤 전송 + 알림"}
          </Text>
        </TouchableOpacity>
      </View>

      {feedbacks.length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 8 }}>이전 피드백</Text>
          {feedbacks.slice(0, 3).map((fb) => (
            <View key={fb.id} style={{ backgroundColor: Colors.bgSub, borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.green }}>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 4 }}>{fb.targetDate}</Text>
              <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>{fb.comment}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── 운동 탭 ──────────────────────────────────────────────────────────────────
function FitLogTab({ fitLogs }: { fitLogs: FitLog[] }) {
  if (fitLogs.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
        <Text style={{ fontSize: 14, color: Colors.textMuted }}>등록된 운동 기록이 없어요</Text>
      </View>
    );
  }
  return (
    <View>
      {fitLogs.map((log) => (
        <View key={log.id} style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 8 }}>{log.date}</Text>
          {log.exercises.map((ex, ei) => (
            <View key={ei} style={{ marginBottom: 10 }}>
              {/* ✅ borderRadius CSS 문자열 제거 → 숫자로 교체 */}
              <View style={{
                backgroundColor: Colors.greenLight,
                borderLeftWidth: 3,
                borderLeftColor: Colors.green,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderTopRightRadius: 8,
                borderBottomRightRadius: 8,
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.text }}>{ex.name}</Text>
                <Text style={{ fontSize: 11, color: Colors.green }}>{ex.sets.length}세트</Text>
              </View>
              {ex.sets.map((s, si) => (
                <View key={si} style={{ flexDirection: "row", gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
                  <View style={{ width: 24, height: 24, backgroundColor: Colors.green, borderRadius: 6, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{s.setNumber}</Text>
                  </View>
                  <Text style={{ flex: 1, fontSize: 13, color: Colors.text }}>{s.weight}kg × {s.reps}회</Text>
                </View>
              ))}
            </View>
          ))}
          {log.memo && (
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 8 }}>
              메모: {log.memo}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── 바디로그 탭 ───────────────────────────────────────────────────────────────
function BodyLogTab({ bodyLogs }: { bodyLogs: BodyLog[] }) {
  if (bodyLogs.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 40 }}>
        <Text style={{ fontSize: 36, marginBottom: 12 }}>📊</Text>
        <Text style={{ fontSize: 14, color: Colors.textMuted }}>등록된 바디로그가 없어요</Text>
      </View>
    );
  }
  return (
    <View>
      <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 10 }}>최근 기록</Text>
      {bodyLogs.slice().reverse().map((log, i) => (
        <View key={i} style={{ backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>{log.date}</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}>{log.weight}kg</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>체중</Text>
            </View>
            {log.bodyFat !== undefined && (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.blue }}>{log.bodyFat}%</Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>체지방</Text>
              </View>
            )}
            {log.muscleMass !== undefined && (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.green }}>{log.muscleMass}kg</Text>
                <Text style={{ fontSize: 10, color: Colors.textMuted }}>근육</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}