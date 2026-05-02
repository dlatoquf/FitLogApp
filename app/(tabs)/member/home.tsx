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
import { apiGet, toDateKey } from "../../../hooks/useApi";
import { DietFeedback, MemberProfile } from "../../../types";

interface MemberHomeData {
  member: MemberProfile;
  todayDietCalories: number;
  goalCalories: number;
  nextSchedule: string | null;
  ptRemaining: number;
  ptTotal: number;
  latestFeedback: DietFeedback | null;
  unreadFeedbackCount: number;
}

export default function MemberHomeScreen() {
  const [data, setData] = useState<MemberHomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await apiGet<MemberHomeData>("/api/member/home");
      setData(result);
    } catch {
      setData({
        member: {
          id: 1,
          name: "김지수",
          phone: "010-1234-5678",
          height: 165,
          weight: 60,
          bodyFat: 22,
          muscleMass: 28,
          ptRemaining: 12,
          ptTotal: 20,
          ptStartDate: "2025-03-01",
          ptExpDate: "2025-06-30",
          goal: "체지방 감량",
          trainerName: "김트레이너",
        },
        todayDietCalories: 1450,
        goalCalories: 1800,
        nextSchedule: "2025-05-03 10:00",
        ptRemaining: 12,
        ptTotal: 20,
        latestFeedback: {
          id: 1,
          comment: "오늘 단백질 섭취가 조금 부족해요. 저녁에 닭가슴살이나 두부를 추가해보세요!",
          targetDate: "2025-04-30",
          createdAt: "2025-04-30T20:00:00",
          read: false,
        },
        unreadFeedbackCount: 2,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHome();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const dietPct = data ? Math.round((data.todayDietCalories / data.goalCalories) * 100) : 0;
  const ptPct = data && data.ptTotal > 0 ? Math.round((data.ptRemaining / data.ptTotal) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchHome(true)}
          tintColor={Colors.green}
        />
      }
    >
      {/* 인사 */}
      <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}>안녕하세요 👋</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>
          {data?.member.name}님
        </Text>
        {data?.member.trainerName && (
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            담당: {data.member.trainerName} 트레이너
          </Text>
        )}
      </View>

      {/* PT 잔여 */}
      <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: Colors.textSub }}>PT 잔여 횟수</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
            <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.blue }}>{data?.ptRemaining ?? 0}</Text>
            <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 4 }}>/ {data?.ptTotal ?? 0}회</Text>
          </View>
        </View>
        <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 8 }}>
          <View style={{ width: `${ptPct}%` as any, height: 8, borderRadius: 99, backgroundColor: Colors.blue }} />
        </View>
        {data?.member.ptExpDate && (
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
            만료일: {data.member.ptExpDate}
          </Text>
        )}
      </View>

      {/* 오늘 식단 */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/member/diet")}
        style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: Colors.textSub }}>오늘 식단</Text>
          <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>기록하기 →</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, marginBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "900", color: Colors.gold }}>
            {data?.todayDietCalories.toLocaleString() ?? 0}
          </Text>
          <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 4 }}>
            / {data?.goalCalories.toLocaleString() ?? 0} kcal
          </Text>
        </View>
        <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 8 }}>
          <View style={{ width: `${Math.min(dietPct, 100)}%` as any, height: 8, borderRadius: 99, backgroundColor: dietPct > 100 ? Colors.red : Colors.gold }} />
        </View>
        <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 6 }}>
          {dietPct >= 100 ? "목표 달성! 🎉" : `목표까지 ${100 - dietPct}% 남았어요`}
        </Text>
      </TouchableOpacity>

      {/* 다음 수업 */}
      {data?.nextSchedule && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/member/schedule")}
          style={{ backgroundColor: Colors.greenLight, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.green + "44" }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.green, marginBottom: 4 }}>📅 다음 수업</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>{data.nextSchedule}</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>탭하여 일정 확인하기</Text>
        </TouchableOpacity>
      )}

      {/* 트레이너 피드백 */}
      {data?.latestFeedback && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/member/diet")}
          style={{
            backgroundColor: data.latestFeedback.read ? Colors.bgSub : Colors.blueBg,
            borderRadius: 14,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: data.latestFeedback.read ? Colors.border : Colors.blue + "44",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.blue }}>
              💬 트레이너 피드백
            </Text>
            {(data.unreadFeedbackCount ?? 0) > 0 && (
              <View style={{ backgroundColor: Colors.red, width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 11, color: "#fff", fontWeight: "700" }}>{data.unreadFeedbackCount}</Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }} numberOfLines={2}>
            {data.latestFeedback.comment}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
            {data.latestFeedback.targetDate}
          </Text>
        </TouchableOpacity>
      )}

      {/* 빠른 메뉴 */}
      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub, marginBottom: 10, marginTop: 4 }}>
        빠른 메뉴
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <QuickMenu icon="📊" label="성장 확인" onPress={() => router.push("/(tabs)/member/growth")} color={Colors.green} />
        <QuickMenu icon="📅" label="일정 신청" onPress={() => router.push("/(tabs)/member/schedule")} color={Colors.blue} />
        <QuickMenu icon="🍽" label="식단 기록" onPress={() => router.push("/(tabs)/member/diet")} color={Colors.gold} />
      </View>
    </ScrollView>
  );
}

function QuickMenu({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ fontSize: 26, marginBottom: 6 }}>{icon}</Text>
      <Text style={{ fontSize: 12, fontWeight: "700", color, textAlign: "center" }}>{label}</Text>
    </TouchableOpacity>
  );
}
