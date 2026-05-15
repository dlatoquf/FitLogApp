import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

const SCREEN_W   = Dimensions.get("window").width - 72;
const TOTAL_SLOTS = 8;

interface BodyLog {
  date: string;
  weight?: number;
  bodyFatMass?: number;
  bodyFat?: number;
  muscleMass?: number;
}

export default function MemberGrowthScreen() {
  const [bodyLogs, setBodyLogs]     = useState<BodyLog[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [weight, setWeight]           = useState("");
  const [bodyFatMass, setBodyFatMass] = useState("");
  const [muscleMass, setMuscleMass]   = useState("");
  const [saving, setSaving]           = useState(false);

  const autoBodyFat = (() => {
    const w = parseFloat(weight);
    const f = parseFloat(bodyFatMass);
    if (w > 0 && f > 0) return Math.round((f / w) * 1000) / 10;
    return null;
  })();

  const fetchBodyLogs = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/bodylog/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error();
      const raw = await res.json();
      setBodyLogs(raw.map((l: any) => ({
        date: l.date || l.logDate,
        weight: l.weight,
        bodyFatMass: l.bodyFatMass,
        bodyFat: l.bodyFatMass && l.weight
          ? Math.round((l.bodyFatMass / l.weight) * 1000) / 10
          : l.bodyFat,
        muscleMass: l.muscleMass,
      })));
    } catch {
      setBodyLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveLog = async () => {
    if (!weight) { Alert.alert("오류", "체중을 입력해주세요."); return; }
    setSaving(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/bodylog`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          weight: parseFloat(weight),
          bodyFatMass: bodyFatMass ? parseFloat(bodyFatMass) : null,
          bodyFat: autoBodyFat,
          muscleMass: muscleMass ? parseFloat(muscleMass) : null,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      const data = await res.json();
      // 재조회 없이 응답에서 바로 목록 업데이트
      if (data.logs) {
        setBodyLogs(data.logs.map((l: any) => ({
          date: l.date || l.logDate,
          weight: l.weight,
          bodyFatMass: l.bodyFatMass,
          bodyFat: l.bodyFatMass && l.weight
            ? Math.round((l.bodyFatMass / l.weight) * 1000) / 10
            : l.bodyFat,
          muscleMass: l.muscleMass,
        })));
      }
      setWeight(""); setBodyFatMass(""); setMuscleMass("");
      Alert.alert("완료", "바디로그가 저장됐어요!");
    } catch (e: any) { Alert.alert("오류", e.message); }
    finally { setSaving(false); }
  };

  useEffect(() => { fetchBodyLogs(); }, []);

  // 그래프
  const BodyGraph = ({
    logs,
    metric,
    color,
    label,
    unit,
    isLast = false,
  }: {
    logs: BodyLog[];
    metric: keyof BodyLog;
    color: string;
    label: string;
    unit: string;
    isLast?: boolean;
  }) => {
    const TOTAL_SLOTS = 8;
    const data = logs.slice(-8);

    const validData = data.filter((log) => {
      const value = log[metric] as number | undefined;
      return value !== undefined && value !== null && value > 0;
    });

    if (validData.length < 1) return null;

    const chartH = 42;
    const chartPadX = 18;
    const chartW = SCREEN_W - 36;
    const stepX = chartW / (TOTAL_SLOTS - 1);

    const values = validData.map((log) => log[metric] as number);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);

    const diff = maxV - minV;
    const padding = diff === 0 ? 0.5 : diff * 0.15;
    minV = minV - padding;
    maxV = maxV + padding;
    const range = maxV - minV || 1;

    const graphColor = color;

    const points = validData.map((log, i) => {
      const value = log[metric] as number;
      const x = chartPadX + i * stepX;

      return {
        x,
        y: chartH - ((value - minV) / range) * (chartH - 20) - 10,
        val: value,
        date: log.date?.slice(5) ?? "",
      };
    });

    return (
      <View style={{ marginBottom: isLast ? 0 : 26, width: SCREEN_W }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: Colors.text,
            marginBottom: 18,
          }}
        >
          {label}
        </Text>

        <View
          style={{ height: chartH + 24, position: "relative", width: SCREEN_W }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: SCREEN_W,
              height: chartH,
            }}
          >
            {/* 그리드 라인 */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: chartPadX + i * stepX,
                  top: 0,
                  width: 1,
                  height: chartH,
                  backgroundColor: Colors.border + "40",
                }}
              />
            ))}

            {/* 라인 */}
            {points.map((p, i) => {
              if (i >= points.length - 1) return null;

              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    width: len,
                    height: 2,
                    backgroundColor: graphColor,
                    transformOrigin: "left center",
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* 포인트 + 수치 */}
            {points.map((p, i) => (
              <View key={i}>
                <View
                  style={{
                    position: "absolute",
                    left: p.x - 3.5,
                    top: p.y - 3.5,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: graphColor,
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />

                <View
                  style={{
                    position: "absolute",
                    left: p.x - 22,
                    top: p.y - 16,
                    width: 44,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: graphColor,
                    }}
                  >
                    {Number(p.val).toFixed(1).replace(/\.0$/, "")}
                    {unit}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* x축 날짜 라벨 */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: chartH + 8,
              width: SCREEN_W,
              height: 16,
            }}
          >
            {points.map((p, i) => (
              <Text
                key={i}
                style={{
                  position: "absolute",
                  left: p.x - 22,
                  width: 44,
                  textAlign: "center",
                  fontSize: 7,
                  color: Colors.textMuted,
                }}
              >
                {p.date}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };


  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchBodyLogs(true)} tintColor={Colors.green} />}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 20 }}>바디로그</Text>

      {/* 오늘 기록 입력 */}
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: Colors.border }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text, marginBottom: 12 }}>오늘 기록</Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          {[
            { label: "몸무게", value: weight, setter: setWeight, unit: "kg", placeholder: "0.0" },
            { label: "체지방량", value: bodyFatMass, setter: setBodyFatMass, unit: "kg", placeholder: "0.0" },
            { label: "근육량", value: muscleMass, setter: setMuscleMass, unit: "kg", placeholder: "0.0" },
          ].map(({ label, value, setter, unit, placeholder }) => (
            <View key={label} style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 4 }}>{label}</Text>
              <View style={{ backgroundColor: "#fff", borderWidth: 1.5, borderColor: value ? Colors.green : Colors.border, borderRadius: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 }}>
                <TextInput
                  value={value}
                  onChangeText={setter}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="decimal-pad"
                  style={{ flex: 1, fontSize: 14, color: Colors.text }}
                />
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>{unit}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 체지방률 자동계산 표시 */}
        {autoBodyFat !== null && (
          <View style={{ backgroundColor: Colors.greenLight, borderRadius: 8, padding: 8, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>
              💡 체지방률 자동계산: {autoBodyFat}%
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={saveLog}
          disabled={saving}
          style={{ backgroundColor: Colors.green, borderRadius: 12, padding: 14, alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>
            {saving ? "저장 중..." : "기록 저장"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 그래프 */}
      {bodyLogs.length > 0 && (
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            padding: 12,
            paddingBottom: 4,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: "flex-start",
            overflow: "hidden",
          }}
        >
          <BodyGraph
            logs={bodyLogs}
            metric="weight"
            color={Colors.green}
            label="체중 변화"
            unit="kg"
          />
          <BodyGraph
            logs={bodyLogs}
            metric="bodyFat"
            color={Colors.green}
            label="체지방률 변화"
            unit="%"
            isLast
          />
        </View>
      )}

      {/* 기록 목록 */}
      <Text
        style={{
          fontSize: 14,
          fontWeight: "700",
          color: Colors.textSub,
          marginBottom: 10,
        }}
      >
        기록 목록
      </Text>

      {bodyLogs.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>📊</Text>
          <Text style={{ fontSize: 14, color: Colors.textMuted }}>
            등록된 바디로그가 없어요
          </Text>
        </View>
      ) : (
        bodyLogs
          .slice()
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .map((log, i, arr) => {
            const prev = arr[i + 1];

            const diffText = (key: keyof BodyLog) => {
              const cur = log[key] as number | undefined;
              const before = prev?.[key] as number | undefined;
              if (cur == null || before == null) return null;
              const diff = Number((cur - before).toFixed(1));
              if (diff === 0) return null;
              return diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`;
            };

            return (
              <View
                key={`${log.date}-${i}`}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  {log.date}
                </Text>

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  {[
                    {
                      label: "몸무게",
                      val: log.weight,
                      unit: "kg",
                      color: Colors.text,
                      diff: null,
                    },
                    {
                      label: "체지방량",
                      val: log.bodyFatMass,
                      unit: "kg",
                      color: Colors.text,
                      diff: diffText("bodyFatMass"),
                    },
                    {
                      label: "체지방률",
                      val: log.bodyFat,
                      unit: "%",
                      color: Colors.text,
                      diff: diffText("bodyFat"),
                    },
                    {
                      label: "근육량",
                      val: log.muscleMass,
                      unit: "kg",
                      color: Colors.text,
                      diff: diffText("muscleMass"),
                    },
                  ].map(({ label, val, unit, color, diff }) => (
                    <View key={label} style={{ alignItems: "center", flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color,
                        }}
                      >
                        {val ?? "-"}
                        {val ? unit : ""}
                      </Text>

                      {diff ? (
                        <Text
                          style={{
                            fontSize: 10,
                            color: String(diff).startsWith("↑")
                              ? Colors.green
                              : Colors.textMuted,
                            fontWeight: "800",
                            marginTop: 2,
                          }}
                        >
                          {diff}
                        </Text>
                      ) : null}

                      <Text
                        style={{
                          fontSize: 10,
                          color: Colors.textMuted,
                          marginTop: diff ? 0 : 2,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })
      )}
    </ScrollView>
  );
}