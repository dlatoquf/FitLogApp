import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

interface Notice {
  id: number;
  content: string;
  createdAt: string;
  broadcast?: boolean;
}

export default function MemberNoticesScreen() {
  const insets = useSafeAreaInsets();
  const { memberId, memberName, isManual } = useLocalSearchParams<{
    memberId: string;
    memberName: string;
    isManual?: string;
  }>();

  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const isManualMember = isManual === "true";

  const baseUrl = isManualMember
    ? `${API_URL}/api/trainer/manual-members/${memberId}/notices`
    : `${API_URL}/api/trainer/members/${memberId}/notices`;

  const fetchNotices = useCallback(async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotices(data);
    } catch {
      Alert.alert("오류", "공지사항을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const postNotice = async () => {
    if (!newContent.trim()) return;
    try {
      setPosting(true);
      Keyboard.dismiss();
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setNotices((prev) => [created, ...prev]);
      setNewContent("");
    } catch {
      Alert.alert("오류", "공지사항 등록에 실패했어요.");
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async () => {
    if (!editContent.trim() || editingId === null) return;
    try {
      setSaving(true);
      Keyboard.dismiss();
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/notices/${editingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) throw new Error();
      setNotices((prev) =>
        prev.map((n) => (n.id === editingId ? { ...n, content: editContent.trim() } : n))
      );
      setEditingId(null);
      setEditContent("");
    } catch {
      Alert.alert("오류", "수정에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNotice = (id: number) => {
    Alert.alert("공지 삭제", "이 공지사항을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/trainer/notices/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error();
            setNotices((prev) => prev.filter((n) => n.id !== id));
          } catch {
            Alert.alert("오류", "삭제에 실패했어요.");
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
    >
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
          backgroundColor: "#fff",
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, padding: 8, marginLeft: -8 }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={{ fontSize: 26, color: Colors.textMuted }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}>
            공지사항
          </Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>
            {memberName}
          </Text>
        </View>
      </View>

      {/* 공지 목록 */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      >
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : notices.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📢</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>
              아직 작성된 공지사항이 없어요
            </Text>
            <Text style={{ fontSize: 13, color: Colors.textPlaceholder, marginTop: 6 }}>
              아래 입력창에서 공지를 작성해보세요
            </Text>
          </View>
        ) : (
          notices.map((n) => (
            <View
              key={n.id}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: editingId === n.id ? Colors.green : Colors.border,
              }}
            >
              {/* 상단: 날짜 + 수정/삭제 */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {n.broadcast ? (
                    <View style={{ backgroundColor: Colors.green + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>전체 공지</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>📢 공지</Text>
                  )}
                  <Text style={{ fontSize: 11, color: Colors.textPlaceholder }}>{n.createdAt}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  {editingId === n.id ? (
                    <>
                      <TouchableOpacity onPress={() => { setEditingId(null); setEditContent(""); }}>
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveEdit} disabled={saving}>
                        <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>
                          {saving ? "저장 중..." : "저장"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => { setEditingId(n.id); setEditContent(n.content); }}>
                        <Text style={{ fontSize: 12, color: Colors.green }}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteNotice(n.id)}>
                        <Text style={{ fontSize: 12, color: "#EF4444" }}>삭제</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* 내용 or 수정 입력창 */}
              {editingId === n.id ? (
                <TextInput
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  autoFocus
                  style={{
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: Colors.green,
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 14,
                    color: Colors.text,
                    lineHeight: 22,
                    minHeight: 80,
                    textAlignVertical: "top",
                  }}
                />
              ) : (
              <Text
                style={{
                  fontSize: 14,
                  color: Colors.text,
                  lineHeight: 22,
                }}
              >
                {n.content}
              </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 하단 입력창 */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          padding: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: "#fff",
        }}
      >
        <TextInput
          value={newContent}
          onChangeText={setNewContent}
          placeholder="공지사항을 입력해주세요..."
          placeholderTextColor={Colors.textPlaceholder}
          multiline
          style={{
            backgroundColor: Colors.bgSub,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 12,
            padding: 12,
            fontSize: 14,
            color: Colors.text,
            lineHeight: 20,
            minHeight: 80,
            maxHeight: 160,
            textAlignVertical: "top",
            marginBottom: 10,
          }}
        />
        <TouchableOpacity
          onPress={postNotice}
          disabled={posting || !newContent.trim()}
          style={{
            backgroundColor:
              posting || !newContent.trim() ? Colors.border : Colors.green,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: posting || !newContent.trim() ? Colors.textMuted : "#fff",
              fontWeight: "700",
              fontSize: 15,
            }}
          >
            {posting ? "등록 중..." : "공지 등록"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
