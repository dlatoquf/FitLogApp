import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

export default function MemberScheduleScreen() {
  const [thisWeek, setThisWeek] = useState<any[]>([]);
  const [nextWeek, setNextWeek] = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSchedules = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };

      const [thisRes, nextRes] = await Promise.all([
        fetch(`${API_URL}/api/member/schedule/this-week`, { headers }),
        fetch(`${API_URL}/api/schedule/next-week-slots`, { headers }),
      ]);

      if (thisRes.ok) setThisWeek(await thisRes.json());

      if (nextRes.ok) {
        setNextWeek(await nextRes.json());
      }
    } catch (e) {
      console.log("schedule fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchSchedules(); }, []));

  // 이미 지난 수업 필터링
  const now = new Date();
  const activeThisWeek = thisWeek.filter((s) => {
    const end = new Date(`${s.date}T${String(s.endTime ?? "23:59").slice(0, 5)}:00`);
    return end > now;
  });

  const renderItem = (s: any, key: string) => (
    <View
      key={key}
      style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: Colors.blueBg, borderRadius: 14,
        padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: Colors.blue + "44",
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.blue, marginRight: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.text }}>
          {s.date}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}>
          {String(s.startTime ?? "").slice(0, 5)} ~ {String(s.endTime ?? "").slice(0, 5)}
        </Text>
      </View>
      <View style={{
        backgroundColor: Colors.blue, borderRadius: 8,
        paddingHorizontal: 10, paddingVertical: 4,
      }}>
        <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>확정</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSchedules(true)}
            tintColor={Colors.green}
          />
        }
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>내 수업</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 24 }}>확정된 수업 일정이에요</Text>

        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── 이번 주 ────────────────────────────────────────────── */}
            <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.textSub, marginBottom: 10 }}>이번 주</Text>
            {activeThisWeek.length === 0 ? (
              <View style={{
                backgroundColor: Colors.bgSub, borderRadius: 12,
                borderWidth: 1, borderColor: Colors.border,
                padding: 16, alignItems: "center", marginBottom: 24,
              }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>이번 주 확정된 수업이 없어요</Text>
              </View>
            ) : (
              <View style={{ marginBottom: 24 }}>
                {activeThisWeek.map((s) =>
                  renderItem(s, `this-${s.scheduleId ?? s.id}-${s.date}`)
                )}
              </View>
            )}

            {/* ── 다음 주 ────────────────────────────────────────────── */}
            <Text style={{ fontSize: 13, fontWeight: "800", color: Colors.textSub, marginBottom: 10 }}>다음 주</Text>
            {nextWeek.length === 0 ? (
              <View style={{
                backgroundColor: Colors.bgSub, borderRadius: 12,
                borderWidth: 1, borderColor: Colors.border,
                padding: 16, alignItems: "center",
              }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>다음 주 확정된 수업이 없어요</Text>
              </View>
            ) : (
              nextWeek.map((s, i) =>
                renderItem(s, `next-${s.id ?? s.scheduleId ?? i}`)
              )
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
