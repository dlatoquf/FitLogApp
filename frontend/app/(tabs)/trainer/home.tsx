import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { ENDPOINTS } from "../../../constants/api";
import { apiGet } from "../../../hooks/useApi";

interface HomeData {
  trainerName: string;
  totalMembers: number;
  todaySchedules: number;
  attendanceRate: number;
  todayPtList: {
    memberId: number;
    memberName: string;
    time: string;
    ptRemaining: number;
  }[];
  pendingSchedules: number;
  lowDietMembers: number;
}

export default function TrainerHomeScreen() {
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const result = await apiGet<HomeData>(ENDPOINTS.trainer.home);
      setData(result);
    } catch {
      // 더미 데이터로 대체
      setData({
        trainerName: "김트레이너",
        totalMembers: 12,
        todaySchedules: 3,
        attendanceRate: 85,
        todayPtList: [
          { memberId: 1, memberName: "김지수", time: "10:00", ptRemaining: 12 },
          { memberId: 2, memberName: "이준호", time: "14:00", ptRemaining: 18 },
          { memberId: 3, memberName: "박민지", time: "17:00", ptRemaining: 3 },
        ],
        pendingSchedules: 2,
        lowDietMembers: 3,
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
      <Text style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}>
        안녕하세요 👋
      </Text>
      <Text
        style={{
          fontSize: 24,
          fontWeight: "800",
          color: Colors.text,
          marginBottom: 20,
        }}
      >
        {data?.trainerName}님
      </Text>

      {/* 요약 카드 */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
        <SummaryCard
          value={String(data?.totalMembers ?? 0)}
          label="총 회원"
          color={Colors.green}
          pct={Math.min((data?.totalMembers ?? 0) * 5, 100)}
        />
        <SummaryCard
          value={String(data?.todaySchedules ?? 0)}
          label="오늘 수업"
          color={Colors.blue}
          pct={Math.min((data?.todaySchedules ?? 0) * 20, 100)}
        />
      </View>

      {/* 출석률 */}
      <View
        style={{
          backgroundColor: Colors.bgSub,
          borderRadius: 14,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: Colors.border,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 14, color: Colors.textSub }}>이번 달 출석률</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.green }}>
            {data?.attendanceRate ?? 0}%
          </Text>
        </View>
        <ProgressBar pct={data?.attendanceRate ?? 0} color={Colors.green} />
      </View>

      {/* 오늘 PT 일정 */}
      <SectionTitle title="오늘 PT 일정" />
      {data?.todayPtList && data.todayPtList.length > 0 ? (
        data.todayPtList.map((item) => (
          <TouchableOpacity
            key={item.memberId}
            onPress={() => router.push(`/(tabs)/trainer/member-detail?id=${item.memberId}`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: Colors.bgSub,
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              borderLeftWidth: 3,
              borderLeftColor: Colors.green,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: Colors.green,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                {item.memberName[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>
                {item.memberName}
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 1 }}>
                PT 수업 · 잔여 {item.ptRemaining}회
              </Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textSub }}>
              {item.time}
            </Text>
          </TouchableOpacity>
        ))
      ) : (
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 12,
            padding: 20,
            alignItems: "center",
            borderWidth: 1,
            borderColor: Colors.border,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontSize: 14, color: Colors.textMuted }}>오늘 예정된 PT가 없어요</Text>
        </View>
      )}

      {/* 조율 대기 배너 */}
      {(data?.pendingSchedules ?? 0) > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/trainer/schedule")}
          style={{
            backgroundColor: Colors.greenLight,
            borderWidth: 1,
            borderColor: Colors.green + "44",
            borderRadius: 12,
            padding: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 13, color: Colors.green, fontWeight: "700" }}>
              📋 조율 대기 {data?.pendingSchedules}건
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
              미확정 일정 처리가 필요합니다
            </Text>
          </View>
          <Text style={{ fontSize: 16, color: Colors.green }}>›</Text>
        </TouchableOpacity>
      )}

      {/* 식단 달성률 경고 배너 */}
      {(data?.lowDietMembers ?? 0) > 0 && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/trainer/diet")}
          style={{
            backgroundColor: Colors.redBg,
            borderRadius: 14,
            padding: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            borderWidth: 1,
            borderColor: Colors.red + "33",
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 13,
                color: Colors.red,
                fontWeight: "700",
                marginBottom: 4,
              }}
            >
              ⚠ 식단 달성률 60% 이하 회원
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.text }}>
              {data?.lowDietMembers}명
            </Text>
          </View>
          <View
            style={{
              backgroundColor: Colors.red,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
              확인하기
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

function SummaryCard({
  value,
  label,
  color,
  pct,
}: {
  value: string;
  label: string;
  color: string;
  pct: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: color,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color, marginBottom: 2 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 8 }}>
        {label}
      </Text>
      <ProgressBar pct={pct} color={color} />
    </View>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 5 }}>
      <View
        style={{
          width: `${Math.min(pct, 100)}%` as any,
          height: 5,
          backgroundColor: color,
          borderRadius: 99,
        }}
      />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      <View
        style={{ width: 3, height: 16, backgroundColor: Colors.green, borderRadius: 2 }}
      />
      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>
        {title}
      </Text>
    </View>
  );
}
