import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
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

interface BroadcastNotice {
  broadcastGroupId: number;
  content: string;
  createdAt: string;
}

export default function BroadcastNoticesScreen() {
  const insets = useSafeAreaInsets();
  const [notices, setNotices] = useState<BroadcastNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const fetchNotices = useCallback(async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/notices/broadcasts`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNotices(data);
    } catch {
      Alert.alert("오류", "전체공지를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const postNotice = async () => {
    if (!newContent.trim()) return;
    try {
      setPosting(true);
      Keyboard.dismiss();
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/notices/all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ content: newContent.trim() }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      setNewContent("");
      Alert.alert("완료", `${result.count}명의 회원에게 공지를 보냈어요.`);
      fetchNotices();
    } catch {
      Alert.alert("오류", "공지사항 등록에 실패했어요.");
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async () => {
    if (!editContent.trim() || editingGroupId === null) return;
    try {
      setSaving(true);
      Keyboard.dismiss();
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/notices/broadcasts/${editingGroupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) throw new Error();
      setNotices((prev) =>
        prev.map((n) => n.broadcastGroupId === editingGroupId ? { ...n, content: editContent.trim() } : n)
      );
      setEditingGroupId(null);
      setEditContent("");
    } catch {
      Alert.alert("오류", "수정에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const deleteNotice = (groupId: number) => {
    Alert.alert("전체공지 삭제", "모든 회원의 공지사항에서 삭제돼요. 계속할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/trainer/notices/broadcasts/${groupId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${jwt}` },
            });
            if (!res.ok) throw new Error();
            setNotices((prev) => prev.filter((n) => n.broadcastGroupId !== groupId));
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
          <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}>전체 공지</Text>
          <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>모든 회원의 공지사항에 표시돼요.</Text>
        </View>
      </View>

      {/* 공지 목록 */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 40 }} />
        ) : notices.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <Text style={{ fontSize: 32, marginBottom: 12 }}>📢</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>아직 작성된 전체공지가 없어요</Text>
            <Text style={{ fontSize: 13, color: Colors.textPlaceholder, marginTop: 6 }}>아래 입력창에서 공지를 작성해보세요</Text>
          </View>
        ) : (
          notices.map((n) => (
            <View
              key={n.broadcastGroupId}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                padding: 14,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: editingGroupId === n.broadcastGroupId ? Colors.green : Colors.border,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ backgroundColor: Colors.green + "20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>전체 공지</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: Colors.textPlaceholder }}>{n.createdAt}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                  {editingGroupId === n.broadcastGroupId ? (
                    <>
                      <TouchableOpacity onPress={() => { setEditingGroupId(null); setEditContent(""); }}>
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={saveEdit} disabled={saving}>
                        <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>{saving ? "저장 중..." : "저장"}</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity onPress={() => { setEditingGroupId(n.broadcastGroupId); setEditContent(n.content); }}>
                        <Text style={{ fontSize: 12, color: Colors.green }}>수정</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteNotice(n.broadcastGroupId)}>
                        <Text style={{ fontSize: 12, color: "#EF4444" }}>삭제</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {editingGroupId === n.broadcastGroupId ? (
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
                <Text style={{ fontSize: 14, color: Colors.text, lineHeight: 22 }}>{n.content}</Text>
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
          placeholder="전체 공지 내용을 입력해주세요..."
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
            backgroundColor: posting || !newContent.trim() ? Colors.border : Colors.green,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: "center",
          }}
        >
          <Text style={{ color: posting || !newContent.trim() ? Colors.textMuted : "#fff", fontWeight: "700", fontSize: 15 }}>
            {posting ? "등록 중..." : "전체 공지 등록"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
