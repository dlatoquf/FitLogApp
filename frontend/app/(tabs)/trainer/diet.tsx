import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { ENDPOINTS } from "../../../constants/api";
import { apiGet } from "../../../hooks/useApi";

interface MemberDietSummary {
  memberId: number;
  memberName: string;
  date: string;
  totalCalories: number;
  goalCalories: number;
  achievementRate: number;
  hasFeedback: boolean;
}

export default function TrainerDietScreen() {
  const [members, setMembers] = useState<MemberDietSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "low" | "nofeedback">("all");

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await apiGet<MemberDietSummary[]>("/api/trainer/diet-summary");
      setMembers(data);
    } catch {
      // 더미 데이터
      setMembers([
        { memberId: 1, memberName: "김지수", date: "2025-05-01", totalCalories: 1850, goalCalories: 2000, achievementRate: 92, hasFeedback: true },
        { memberId: 2, memberName: "이준호", date: "2025-05-01", totalCalories: 1200, goalCalories: 2200, achievementRate: 54, hasFeedback: false },
        { memberId: 3, memberName: "박민지", date: "2025-05-01", totalCalories: 2100, goalCalories: 1800, achievementRate: 116, hasFeedback: false },
        { memberId: 4, memberName: "최영호", date: "2025-05-01", totalCalories: 0, goalCalories: 2000, achievementRate: 0, hasFeedback: false },
        { memberId: 5, memberName: "정수연", date: "2025-05-01", totalCalories: 1780, goalCalories: 1900, achievementRate: 93, hasFeedback: true },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = members.filter((m) => {
    if (filter === "low") return m.achievementRate < 60;
    if (filter === "nofeedback") return !m.hasFeedback;
    return true;
  });

  const lowCount = members.filter((m) => m.achievementRate < 60).length;
  const noFeedbackCount = members.filter((m) => !m.hasFeedback).length;

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
          onRefresh={() => fetchData(true)}
          tintColor={Colors.green}
        />
      }
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>
        식단 관리
      </Text>

      {/* 요약 카드 */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: Colors.redBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.red + "33" }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.red }}>{lowCount}명</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>달성률 60% 이하</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: Colors.goldBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.gold + "33" }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.gold }}>{noFeedbackCount}명</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>피드백 미전송</Text>
        </View>
      </View>

      {/* 필터 탭 */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {([["all", "전체"], ["low", "저달성"], ["nofeedback", "미피드백"]] as const).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: filter === key ? Colors.green : Colors.bgSub,
              borderWidth: 1,
              borderColor: filter === key ? Colors.green : Colors.border,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: filter === key ? "#fff" : Colors.textMuted }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 회원 목록 */}
      {filtered.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 48 }}>
          <Text style={{ fontSize: 36, marginBottom: 12 }}>🎉</Text>
          <Text style={{ fontSize: 15, color: Colors.textMuted }}>모든 회원이 잘 하고 있어요!</Text>
        </View>
      ) : (
        filtered.map((m) => {
          const isLow = m.achievementRate < 60;
          const isOver = m.achievementRate > 110;
          const barColor = isLow ? Colors.red : isOver ? Colors.gold : Colors.green;

          return (
            <TouchableOpacity
              key={m.memberId}
              onPress={() => router.push(`/(tabs)/trainer/member-detail?id=${m.memberId}`)}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: isLow ? Colors.red + "44" : Colors.border,
                borderLeftWidth: 3,
                borderLeftColor: barColor,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: barColor, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{m.memberName[0]}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{m.memberName}</Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>{m.date}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: barColor }}>
                    {m.achievementRate}%
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    {m.totalCalories.toLocaleString()} / {m.goalCalories.toLocaleString()} kcal
                  </Text>
                </View>
              </View>

              {/* 달성률 바 */}
              <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 6, marginBottom: 8 }}>
                <View style={{ width: `${Math.min(m.achievementRate, 100)}%` as any, height: 6, borderRadius: 99, backgroundColor: barColor }} />
              </View>

              {/* 피드백 상태 */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                {isLow && (
                  <View style={{ backgroundColor: Colors.redBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: Colors.red, fontWeight: "700" }}>⚠ 달성률 낮음</Text>
                  </View>
                )}
                {isOver && (
                  <View style={{ backgroundColor: Colors.goldBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, color: Colors.gold, fontWeight: "700" }}>↑ 초과 섭취</Text>
                  </View>
                )}
                {!isLow && !isOver && <View />}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: m.hasFeedback ? Colors.green : Colors.border }} />
                  <Text style={{ fontSize: 11, color: m.hasFeedback ? Colors.green : Colors.textMuted }}>
                    {m.hasFeedback ? "피드백 완료" : "피드백 필요"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}
