import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { API_URL } from "../constants/api";

interface Comment {
  id: number;
  content: string;
  authorName: string;
  authorRole: "TRAINER" | "MEMBER";
  authorUserId: number;
  createdAt: string;
  updatedAt: string | null;
}

interface Props {
  targetType: "WORKOUT_LOG" | "DIET_PHOTO" | "DIET_DAY";
  targetId: number;
  date?: string;
  trainerId?: number;
  memberId?: number;
  onFocusScroll?: () => void;
}

const Colors = {
  bg: "#fff",
  bgSub: "#f5f5f5",
  border: "#e5e5e5",
  text: "#1a1a1a",
  textSub: "#666",
  textMuted: "#aaa",
  trainer: "#4A90FF",
  member: "#34C759",
  red: "#FF3B30",
};

export default function CommentSection({ targetType, targetId, date, trainerId, memberId, onFocusScroll }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const editRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadMyUserId();
    fetchComments();
  }, [targetType, targetId]);


  const loadMyUserId = async () => {
    const jwt = await AsyncStorage.getItem("jwt");
    if (!jwt) return;
    try {
      const base64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(decodeURIComponent(
        atob(padded).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      ));
      setMyUserId(Number(payload.sub ?? payload.userId ?? payload.id));
    } catch {}
  };

  const buildUrl = (base: string) => {
    let url = `${base}?targetType=${targetType}&targetId=${targetId}`;
    if (date) url += `&date=${date}`;
    if (trainerId) url += `&trainerId=${trainerId}`;
    if (memberId) url += `&memberId=${memberId}`;
    return url;
  };

  const fetchComments = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(buildUrl(`${API_URL}/api/comments`), {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) setComments(await res.json());
    } catch {}
    setLoading(false);
  };

  const sendComment = async () => {
    const content = input.trim();
    if (!content) return;
    setSending(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(buildUrl(`${API_URL}/api/comments`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      const added: Comment = await res.json();
      setComments((prev) => [...prev, added]);
      setInput("");
    } catch {
      Alert.alert("오류", "댓글 작성에 실패했어요.");
    }
    setSending(false);
  };

  const startEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditInput(comment.content);
    setTimeout(() => editRef.current?.focus(), 100);
  };

  const saveEdit = async (commentId: number) => {
    const content = editInput.trim();
    if (!content) return;
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      const updated: Comment = await res.json();
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
    } catch {
      Alert.alert("오류", "수정에 실패했어요.");
    }
  };

  const deleteComment = (commentId: number) => {
    Alert.alert("댓글 삭제", "삭제하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            const jwt = await AsyncStorage.getItem("jwt");
            await fetch(`${API_URL}/api/comments/${commentId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${jwt}` },
            });
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          } catch {
            Alert.alert("오류", "삭제에 실패했어요.");
          }
        },
      },
    ]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <View
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "700",
          color: Colors.textSub,
          marginBottom: 10,
        }}
      >
        댓글 {comments.length > 0 ? `(${comments.length})` : ""}
      </Text>

      {loading ? (
        <ActivityIndicator size="small" color={Colors.textMuted} />
      ) : comments.length === 0 ? (
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 10 }}>
          아직 댓글이 없어요.
        </Text>
      ) : (
        comments.map((c) => (
          <View
            key={c.id}
            style={{
              marginBottom: 10,
              backgroundColor: Colors.bgSub,
              borderRadius: 10,
              padding: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: c.authorRole === "TRAINER" ? Colors.trainer : Colors.member,
                  }}
                >
                  {c.authorName}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  {c.authorRole === "TRAINER" ? "트레이너" : "회원"}
                </Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  {formatTime(c.createdAt)}
                  {c.updatedAt ? " (수정됨)" : ""}
                </Text>
              </View>
              {myUserId === c.authorUserId && (
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <TouchableOpacity onPress={() => startEdit(c)} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                    <Text style={{ fontSize: 13, color: Colors.textSub }}>수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteComment(c.id)} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                    <Text style={{ fontSize: 13, color: Colors.red }}>삭제</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {editingId === c.id ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <TextInput
                  ref={editRef}
                  value={editInput}
                  onChangeText={setEditInput}
                  multiline
                  style={{
                    flex: 1,
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 13,
                    color: Colors.text,
                    textAlignVertical: "top",
                    minHeight: 40,
                  }}
                />
                <TouchableOpacity onPress={() => saveEdit(c.id)} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Text style={{ fontSize: 13, color: Colors.trainer, fontWeight: "700" }}>저장</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingId(null)} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
                  <Text style={{ fontSize: 13, color: Colors.textMuted }}>취소</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>
                {c.content}
              </Text>
            )}
          </View>
        ))
      )}

      {/* 댓글 입력 */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", marginTop: 4 }}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          onFocus={() => {
            setTimeout(() => {
              scrollRef.current?.scrollToEnd({ animated: true });
              onFocusScroll?.();
            }, 300);
          }}
          placeholder="댓글을 입력하세요..."
          placeholderTextColor={Colors.textMuted}
          multiline
          style={{
            flex: 1,
            backgroundColor: Colors.bgSub,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 10,
            padding: 10,
            fontSize: 13,
            color: Colors.text,
            textAlignVertical: "top",
            minHeight: 40,
            maxHeight: 80,
          }}
        />
        <TouchableOpacity
          onPress={sendComment}
          disabled={sending || !input.trim()}
          style={{
            backgroundColor: input.trim() ? Colors.trainer : Colors.border,
            borderRadius: 10,
            width: 40,
            height: 40,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontSize: 18, lineHeight: 22 }}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
