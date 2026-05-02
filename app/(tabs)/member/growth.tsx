import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { ENDPOINTS } from "../../../constants/api";
import { apiGet, apiPost, toDateKey } from "../../../hooks/useApi";
import { BodyLog, FitLog } from "../../../types";

const SCREEN_W = Dimensions.get("window").width - 40;

export default function MemberGrowthScreen() {
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [fitLogs, setFitLogs] = useState<FitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric] = useState<"weight" | "bodyFat" | "muscleMass">("weight");
  const [tab, setTab] = useState<"body" | "workout">("body");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ weight: "", bodyFat: "", muscleMass: "", note: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [bodyData, fitData] = await Promise.all([
        apiGet<BodyLog[]>(ENDPOINTS.bodylog.me),
        apiGet<FitLog[]>(ENDPOINTS.fitlog.list),
      ]);
      setBodyLogs(bodyData);
      setFitLogs(fitData);
    } catch {
      setBodyLogs([
        { date: "2025-03-01", weight: 80.0, bodyFat: 25.0, muscleMass: 30.0 },
        { date: "2025-03-15", weight: 79.2, bodyFat: 24.5, muscleMass: 30.5 },
        { date: "2025-04-01", weight: 78.5, bodyFat: 23.8, muscleMass: 31.0 },
        { date: "2025-04-15", weight: 77.8, bodyFat: 23.0, muscleMass: 31.6 },
        { date: "2025-05-01", weight: 76.5, bodyFat: 22.1, muscleMass: 32.2 },
      ]);
      setFitLogs([
        {
          id: 1,
          memberId: 1,
          date: "2025-05-01",
          exercises: [
            { name: "벤치프레스", sets: [{ setNumber: 1, weight: 60, reps: 12 }, { setNumber: 2, weight: 70, reps: 10 }, { setNumber: 3, weight: 80, reps: 8 }] },
            { name: "인클라인 덤벨", sets: [{ setNumber: 1, weight: 16, reps: 12 }, { setNumber: 2, weight: 18, reps: 10 }] },
          ],
          memo: "오늘 컨디션 좋음",
        },
        {
          id: 2,
          memberId: 1,
          date: "2025-04-28",
          exercises: [
            { name: "스쿼트", sets: [{ setNumber: 1, weight: 80, reps: 10 }, { setNumber: 2, weight: 90, reps: 8 }, { setNumber: 3, weight: 100, reps: 6 }] },
            { name: "레그프레스", sets: [{ setNumber: 1, weight: 120, reps: 12 }, { setNumber: 2, weight: 140, reps: 10 }] },
          ],
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveBodyLog = async () => {
    if (!addForm.weight) {
      Alert.alert("오류", "체중을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await apiPost(ENDPOINTS.bodylog.create, {
        date: toDateKey(new Date()),
        weight: parseFloat(addForm.weight),
        bodyFat: addForm.bodyFat ? parseFloat(addForm.bodyFat) : undefined,
        muscleMass: addForm.muscleMass ? parseFloat(addForm.muscleMass) : undefined,
        note: addForm.note || undefined,
      });
      setShowAddModal(false);
      setAddForm({ weight: "", bodyFat: "", muscleMass: "", note: "" });
      fetchData(true);
      Alert.alert("완료", "바디로그가 기록됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metricConfig = {
    weight: { label: "체중", unit: "kg", color: Colors.blue },
    bodyFat: { label: "체지방률", unit: "%", color: Colors.red },
    muscleMass: { label: "골격근량", unit: "kg", color: Colors.green },
  };

  const values = bodyLogs.map((l) => l[metric] ?? 0).filter((v) => v > 0);
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 100;
  const range = maxVal - minVal || 1;
  const chartH = 140;
  const chartW = SCREEN_W - 40;
  const stepX = bodyLogs.length > 1 ? chartW / (bodyLogs.length - 1) : chartW;
  const points = bodyLogs.map((log, i) => {
    const val = log[metric] ?? 0;
    const x = i * stepX;
    const y = chartH - ((val - minVal) / range) * (chartH - 20) - 10;
    return { x, y, val, date: log.date };
  });

  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const diff = lastVal - firstVal;
  const isImproved = metric === "bodyFat" ? diff < 0 : diff > 0;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor={Colors.green}
          />
        }
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>성장 그래프</Text>
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+ 기록</Text>
          </TouchableOpacity>
        </View>

        {/* 탭 */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {([["body", "바디로그"], ["workout", "운동 기록"]] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === key ? Colors.green : Colors.bgSub, borderWidth: 1, borderColor: tab === key ? Colors.green : Colors.border }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: tab === key ? "#fff" : Colors.textMuted }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "body" && (
          <>
            {/* 지표 선택 */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {(["weight", "bodyFat", "muscleMass"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMetric(m)}
                  style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", backgroundColor: metric === m ? metricConfig[m].color : Colors.bgSub, borderWidth: 1, borderColor: metric === m ? metricConfig[m].color : Colors.border }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: metric === m ? "#fff" : Colors.textMuted }}>{metricConfig[m].label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 요약 */}
            {values.length >= 2 && (
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>시작</Text>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: Colors.text }}>{firstVal}{metricConfig[metric].unit}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>현재</Text>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: metricConfig[metric].color }}>{lastVal}{metricConfig[metric].unit}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: isImproved ? Colors.greenLight : Colors.redBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: isImproved ? Colors.green + "44" : Colors.red + "44" }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>변화</Text>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: isImproved ? Colors.green : Colors.red }}>
                    {diff > 0 ? "+" : ""}{diff.toFixed(1)}{metricConfig[metric].unit}
                  </Text>
                </View>
              </View>
            )}

            {/* 차트 */}
            {bodyLogs.length < 2 ? (
              <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 20, alignItems: "center", marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📊</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>데이터가 2개 이상 필요해요</Text>
                <TouchableOpacity
                  onPress={() => setShowAddModal(true)}
                  style={{ marginTop: 12, backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 13, color: Colors.green, fontWeight: "700" }}>첫 기록 남기기</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 12 }}>
                  {metricConfig[metric].label} 변화 추이
                </Text>
                <View style={{ height: chartH + 30, position: "relative" }}>
                  <View style={{ position: "absolute", left: 0, top: 0, bottom: 30, width: 40, justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 10, color: Colors.textMuted }}>{maxVal.toFixed(1)}</Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted }}>{((maxVal + minVal) / 2).toFixed(1)}</Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted }}>{minVal.toFixed(1)}</Text>
                  </View>
                  <View style={{ position: "absolute", left: 40, right: 0, top: 0, height: chartH }}>
                    {[0, 0.5, 1].map((ratio) => (
                      <View key={ratio} style={{ position: "absolute", left: 0, right: 0, top: ratio * (chartH - 20) + 10, height: 1, backgroundColor: Colors.border + "80" }} />
                    ))}
                    {points.map((p, i) => (
                      <View key={i}>
                        {i < points.length - 1 && (() => {
                          const next = points[i + 1];
                          const dx = next.x - p.x;
                          const dy = next.y - p.y;
                          const len = Math.sqrt(dx * dx + dy * dy);
                          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                          return (
                            <View style={{ position: "absolute", left: p.x, top: p.y, width: len, height: 2, backgroundColor: metricConfig[metric].color, transformOrigin: "left center", transform: [{ rotate: `${angle}deg` }] }} />
                          );
                        })()}
                        <View style={{ position: "absolute", left: p.x - 6, top: p.y - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: metricConfig[metric].color, borderWidth: 2, borderColor: "#fff" }} />
                        <View style={{ position: "absolute", left: p.x - 20, top: p.y - 22, width: 40, alignItems: "center" }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: metricConfig[metric].color }}>{p.val.toFixed(1)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={{ position: "absolute", left: 40, right: 0, bottom: 0, height: 24, flexDirection: "row", justifyContent: "space-between" }}>
                    {points.map((p, i) => (
                      <Text key={i} style={{ fontSize: 9, color: Colors.textMuted }}>{p.date.slice(5)}</Text>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* 기록 목록 */}
            {bodyLogs.slice().reverse().map((log, i) => (
              <View key={i} style={{ backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>{log.date}</Text>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  {[{ label: "체중", val: log.weight, unit: "kg", color: Colors.blue }, { label: "체지방", val: log.bodyFat, unit: "%", color: Colors.red }, { label: "근육", val: log.muscleMass, unit: "kg", color: Colors.green }].map(({ label, val, unit, color }) =>
                    val !== undefined ? (
                      <View key={label} style={{ alignItems: "center" }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color }}>{val}{unit}</Text>
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>{label}</Text>
                      </View>
                    ) : null
                  )}
                </View>
              </View>
            ))}
          </>
        )}

        {tab === "workout" && (
          <>
            {fitLogs.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🏋️</Text>
                <Text style={{ fontSize: 15, color: Colors.textMuted }}>운동 기록이 없어요</Text>
              </View>
            ) : (
              fitLogs.map((log) => (
                <View key={log.id} style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 8 }}>{log.date}</Text>
                  {log.exercises.map((ex, ei) => (
                    <View key={ei} style={{ marginBottom: 10 }}>
                      <View style={{ backgroundColor: Colors.greenLight, borderLeftWidth: 3, borderLeftColor: Colors.green, padding: 8, borderRadius: 8, flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
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
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* 바디로그 추가 모달 */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>오늘 바디로그 기록</Text>

            {[
              { label: "체중 (kg)", key: "weight", placeholder: "70.0", required: true },
              { label: "체지방률 (%)", key: "bodyFat", placeholder: "20.0" },
              { label: "골격근량 (kg)", key: "muscleMass", placeholder: "30.0" },
              { label: "메모", key: "note", placeholder: "오늘 컨디션 등..." },
            ].map(({ label, key, placeholder, required }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>
                  {label}{required && <Text style={{ color: Colors.red }}> *</Text>}
                </Text>
                <TextInput
                  value={addForm[key as keyof typeof addForm]}
                  onChangeText={(v) => setAddForm((f) => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType={key !== "note" ? "decimal-pad" : "default"}
                  style={{ backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: addForm[key as keyof typeof addForm] ? Colors.green : Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text }}
                />
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveBodyLog} disabled={saving} style={{ flex: 2, backgroundColor: Colors.green, borderRadius: 12, padding: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>{saving ? "저장 중..." : "저장"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
