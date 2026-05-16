import { router } from "expo-router";
import { useEffect, useState } from "react";

// 날짜(+시간) 포맷 헬퍼
const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  if (dateStr.includes("T") || (dateStr.includes(" ") && dateStr.length > 10)) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "오후" : "오전";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${y}.${m}.${day} ${ampm} ${h12}:${min}`;
  }
  return dateStr.replace(/-/g, ".");
};
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { ENDPOINTS } from "../../../constants/api";
import { apiGet } from "../../../hooks/useApi";
import { BodyLog, Member } from "../../../types";

const SCREEN_W = Dimensions.get("window").width - 40;

export default function TrainerGrowthScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric] = useState<"weight" | "bodyFat" | "muscleMass">("weight");

  const fetchMembers = async () => {
    try {
      const data = await apiGet<Member[]>(ENDPOINTS.trainer.members);
      setMembers(data);
      if (data.length > 0) setSelectedMemberId(data[0].id);
    } catch {
      const dummy: Member[] = [
        { id: 1, user: { id: 1, name: "김지수" }, ptRemaining: 12, ptTotal: 20, status: "ACTIVE" },
        { id: 2, user: { id: 2, name: "이준호" }, ptRemaining: 18, ptTotal: 30, status: "ACTIVE" },
      ];
      setMembers(dummy);
      setSelectedMemberId(dummy[0].id);
    }
  };

  const fetchBodyLogs = async (memberId: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const raw = await apiGet<any[]>(ENDPOINTS.bodylog.member(memberId));
      // createdAt 있으면 우선 사용, 없으면 date 폴백
      const data: BodyLog[] = raw.map((l: any) => ({
        date: l.createdAt || l.logDate || l.date,
        weight: l.weight,
        bodyFat: l.bodyFat,
        muscleMass: l.muscleMass,
      }));
      setBodyLogs(data);
    } catch {
      setBodyLogs([
        { date: "2025-03-01", weight: 80.0, bodyFat: 25.0, muscleMass: 30.0 },
        { date: "2025-03-15", weight: 79.2, bodyFat: 24.5, muscleMass: 30.5 },
        { date: "2025-04-01", weight: 78.5, bodyFat: 23.8, muscleMass: 31.0 },
        { date: "2025-04-15", weight: 77.8, bodyFat: 23.0, muscleMass: 31.6 },
        { date: "2025-05-01", weight: 76.5, bodyFat: 22.1, muscleMass: 32.2 },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchMembers();
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedMemberId) {
      fetchBodyLogs(selectedMemberId);
    }
  }, [selectedMemberId]);

  const selectedMember = members.find((m) => m.id === selectedMemberId);

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
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => selectedMemberId && fetchBodyLogs(selectedMemberId, true)}
          tintColor={Colors.green}
        />
      }
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>성장 그래프</Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/trainer/fitlog-write")}
          style={{ backgroundColor: Colors.green, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>+ FitLog 작성</Text>
        </TouchableOpacity>
      </View>

      {/* 회원 선택 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {members.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setSelectedMemberId(m.id)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 20,
                backgroundColor: selectedMemberId === m.id ? Colors.green : Colors.bgSub,
                borderWidth: 1,
                borderColor: selectedMemberId === m.id ? Colors.green : Colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: selectedMemberId === m.id ? "#fff" : Colors.textMuted }}>
                {m.user.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 지표 선택 */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
        {(["weight", "bodyFat", "muscleMass"] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMetric(m)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: metric === m ? metricConfig[m].color : Colors.bgSub,
              borderWidth: 1,
              borderColor: metric === m ? metricConfig[m].color : Colors.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: metric === m ? "#fff" : Colors.textMuted }}>
              {metricConfig[m].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 요약 카드 */}
      {values.length >= 2 && (
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>시작</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: Colors.text }}>
              {firstVal}{metricConfig[metric].unit}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border }}>
            <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 2 }}>현재</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", color: metricConfig[metric].color }}>
              {lastVal}{metricConfig[metric].unit}
            </Text>
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
        </View>
      ) : (
        <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub, marginBottom: 12 }}>
            {selectedMember?.user.name} · {metricConfig[metric].label} 변화
          </Text>

          {/* SVG 대체 - 간단한 View 기반 차트 */}
          <View style={{ height: chartH + 30, position: "relative" }}>
            {/* Y축 라벨 */}
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 30, width: 40, justifyContent: "space-between" }}>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>{maxVal.toFixed(1)}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>{((maxVal + minVal) / 2).toFixed(1)}</Text>
              <Text style={{ fontSize: 10, color: Colors.textMuted }}>{minVal.toFixed(1)}</Text>
            </View>

            {/* 차트 영역 */}
            <View style={{ position: "absolute", left: 40, right: 0, top: 0, height: chartH }}>
              {/* 수평 그리드 라인 */}
              {[0, 0.5, 1].map((ratio) => (
                <View key={ratio} style={{ position: "absolute", left: 0, right: 0, top: ratio * (chartH - 20) + 10, height: 1, backgroundColor: Colors.border + "80" }} />
              ))}

              {/* 데이터 포인트 및 라인 */}
              {points.map((p, i) => (
                <View key={i}>
                  {/* 라인 */}
                  {i < points.length - 1 && (() => {
                    const next = points[i + 1];
                    const dx = next.x - p.x;
                    const dy = next.y - p.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                      <View
                        style={{
                          position: "absolute",
                          left: p.x,
                          top: p.y,
                          width: len,
                          height: 2,
                          backgroundColor: metricConfig[metric].color,
                          transformOrigin: "left center",
                          transform: [{ rotate: `${angle}deg` }],
                        }}
                      />
                    );
                  })()}
                  {/* 포인트 */}
                  <View
                    style={{
                      position: "absolute",
                      left: p.x - 6,
                      top: p.y - 6,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: metricConfig[metric].color,
                      borderWidth: 2,
                      borderColor: "#fff",
                    }}
                  />
                  {/* 값 라벨 */}
                  <View style={{ position: "absolute", left: p.x - 20, top: p.y - 22, width: 40, alignItems: "center" }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: metricConfig[metric].color }}>
                      {p.val.toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* X축 라벨 */}
            <View style={{ position: "absolute", left: 40, right: 0, bottom: 0, height: 24, flexDirection: "row", justifyContent: "space-between" }}>
              {points.map((p, i) => (
                <Text key={i} style={{ fontSize: 9, color: Colors.textMuted, textAlign: "center" }}>
                  {p.date.slice(5)}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 기록 목록 */}
      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub, marginBottom: 10 }}>기록 목록</Text>
      {bodyLogs.slice().reverse().map((log, i) => (
        <View key={i} style={{ backgroundColor: Colors.bgSub, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>{formatDateTime(log.date)}</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {[
              { label: "체중", val: log.weight, unit: "kg", color: Colors.blue },
              { label: "체지방", val: log.bodyFat, unit: "%", color: Colors.red },
              { label: "근육", val: log.muscleMass, unit: "kg", color: Colors.green },
            ].map(({ label, val, unit, color }) =>
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
    </ScrollView>
  );
}
