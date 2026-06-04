import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

interface Notice {
  id: number;
  content: string;
  createdAt: string;
}

export default function MemberNoticesScreen() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const res = await fetch(`${API_URL}/api/member/notices`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!res.ok) throw new Error();
        setNotices(await res.json());
      } catch {
        Alert.alert("오류", "공지사항을 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: Platform.OS === "ios" ? 56 : 20,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginRight: 12 }}
        >
          <Text style={{ fontSize: 22, color: Colors.textMuted }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}>
          공지사항
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : notices.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📢</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>
              아직 공지사항이 없어요
            </Text>
          </View>
        ) : (
          notices.map((n) => (
            <View
              key={n.id}
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#FDE68A",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{ fontSize: 11, fontWeight: "700", color: "#B45309" }}
                >
                  📢 공지
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textPlaceholder }}>
                  {n.createdAt}
                </Text>
              </View>
              <Text
                style={{ fontSize: 14, color: Colors.text, lineHeight: 22 }}
              >
                {n.content}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
