import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { ENDPOINTS } from "../../../constants/api";
import { apiGet } from "../../../hooks/useApi";
import { Member } from "../../../types";

export default function TrainerMembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "inactive">("all");

  const fetchMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await apiGet<Member[]>(ENDPOINTS.trainer.members);
      setMembers(data);
    } catch {
      // 더미 데이터
      setMembers([
        {
          id: 1,
          user: { id: 1, name: "김지수" },
          ptRemaining: 12,
          ptTotal: 20,
          ptStartDate: "2025-03-01",
          ptExpDate: "2025-06-30",
          goal: "체지방 감량",
          status: "ACTIVE",
        },
        {
          id: 2,
          user: { id: 2, name: "이준호" },
          ptRemaining: 18,
          ptTotal: 30,
          goal: "근육 증가",
          status: "ACTIVE",
        },
        {
          id: 3,
          user: { id: 3, name: "박민지" },
          ptRemaining: 3,
          ptTotal: 10,
          goal: "체력 향상",
          status: "ACTIVE",
        },
        {
          id: 4,
          user: { id: 4, name: "최영호" },
          ptRemaining: 0,
          ptTotal: 0,
          goal: "다이어트",
          status: "INACTIVE",
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filtered = members.filter((m) => {
    const matchSearch = m.user.name.includes(search);
    const matchTab =
      tab === "all" ||
      (tab === "active" && m.status === "ACTIVE") ||
      (tab === "inactive" && m.status === "INACTIVE");
    return matchSearch && matchTab;
  });

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
            onRefresh={() => fetchMembers(true)}
            tintColor={Colors.green}
          />
        }
      >
        {/* 헤더 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>
            회원 관리
          </Text>
          <View
            style={{
              backgroundColor: Colors.green,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderRadius: 99,
            }}
          >
            <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>
              {members.length}명
            </Text>
          </View>
        </View>

        {/* 검색 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderWidth: 1.5,
            borderColor: Colors.border,
            borderRadius: 12,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            placeholder="회원 이름 검색"
            placeholderTextColor={Colors.textPlaceholder}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 12 }}
          />
        </View>

        {/* 탭 */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {(["all", "active", "inactive"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: tab === t ? Colors.green : Colors.bgSub,
                borderWidth: 1,
                borderColor: tab === t ? Colors.green : Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: tab === t ? "#fff" : Colors.textMuted,
                }}
              >
                {t === "all" ? "전체" : t === "active" ? "활성" : "비활성"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 회원 목록 */}
        {filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>👥</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>
              {search ? "검색 결과가 없어요" : "등록된 회원이 없어요"}
            </Text>
          </View>
        ) : (
          filtered.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() =>
                router.push(`/(tabs)/trainer/member-detail?id=${m.id}`)
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              {/* 아바타 */}
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor:
                    m.status === "ACTIVE" ? Colors.green : Colors.border,
                  justifyContent: "center",
                  alignItems: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
                  {m.user.name[0]}
                </Text>
              </View>

              {/* 정보 */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.text,
                    marginBottom: 2,
                  }}
                >
                  {m.user.name}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  {m.goal || "목표 미설정"}
                </Text>
              </View>

              {/* PT 잔여 */}
              <View style={{ alignItems: "flex-end" }}>
                {m.ptTotal > 0 ? (
                  <>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color:
                          m.ptRemaining <= 3 ? Colors.red : Colors.blue,
                      }}
                    >
                      {m.ptRemaining}회
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      / {m.ptTotal}회
                    </Text>
                  </>
                ) : (
                  <View
                    style={{
                      backgroundColor: Colors.goldBg,
                      borderWidth: 1,
                      borderColor: Colors.gold + "44",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color: Colors.gold,
                        fontWeight: "700",
                      }}
                    >
                      PT 미등록
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
