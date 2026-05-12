import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

interface MemberUser {
  id: number;
  name: string;
}

interface Member {
  id: number;
  user: MemberUser;
  ptRemaining: number | null;
  ptTotal: number | null;
  goal: string | null;
}

export default function TrainerMembersScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const fetchMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
  
    try {
      const jwt = await AsyncStorage.getItem("jwt");
  
      if (!jwt) {
        throw new Error("로그인 정보가 없어요. 다시 로그인해주세요.");
      }
  
      const res = await fetch(`${API_URL}/api/trainer/members`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
  
      const text = await res.text();
  
      console.log("회원관리 status:", res.status);
      console.log("회원관리 raw 응답:", text);
  
      if (!res.ok) {
        throw new Error(`회원 목록 조회 실패 (${res.status}): ${text}`);
      }
  
      let data: Member[];
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`서버 응답이 JSON이 아니에요: ${text}`);
      }
  
      setMembers(data);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "회원 목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filtered = members.filter((m) =>
    m.user.name.includes(search)
  );

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
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}>회원 관리</Text>
          <View style={{ backgroundColor: Colors.green, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99 }}>
            <Text style={{ fontSize: 13, color: "#fff", fontWeight: "700" }}>{members.length}명</Text>
          </View>
        </View>

        {/* 검색 */}
        <View style={{
          backgroundColor: Colors.bgSub,
          borderWidth: 1.5,
          borderColor: Colors.border,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          marginBottom: 16,
        }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            placeholder="회원 이름 검색"
            placeholderTextColor={Colors.textPlaceholder}
            value={search}
            onChangeText={setSearch}
            style={{ flex: 1, fontSize: 14, color: Colors.text, paddingVertical: 12 }}
          />
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
              onPress={() => router.push(`/(tabs)/trainer/member-detail?id=${m.id}`)}
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
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: Colors.green,
                justifyContent: "center",
                alignItems: "center",
                marginRight: 12,
              }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
                  {m.user.name[0]}
                </Text>
              </View>

              {/* 이름 + 목표 */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 2 }}>
                  {m.user.name}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  {m.goal || "목표 미설정"}
                </Text>
              </View>

              {/* PT 잔여 */}
              <View style={{ alignItems: "flex-end" }}>
                {m.ptTotal && m.ptTotal > 0 ? (
                  <>
                    <Text style={{
                      fontSize: 18,
                      fontWeight: "900",
                      color: (m.ptRemaining ?? 0) <= 3 ? Colors.red : Colors.blue,
                    }}>
                      {m.ptRemaining ?? 0}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>/ {m.ptTotal}회</Text>
                  </>
                ) : (
                  <View style={{
                    backgroundColor: Colors.goldBg,
                    borderWidth: 1,
                    borderColor: Colors.gold + "44",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 8,
                  }}>
                    <Text style={{ fontSize: 11, color: Colors.gold, fontWeight: "700" }}>PT 미등록</Text>
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