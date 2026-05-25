import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface DisplayMember {
  key: string;
  isLinked: boolean;
  id: number;
  name: string;
  ptRemaining: number;
  ptTotal: number;
  goal?: string;
  phone?: string;
}

interface Memo {
  id: number;
  content: string;
  createdAt: string;
}

type SortKey = "ptAsc" | "ptDesc";
type FilterKey = "all" | "linked" | "unlinked";

function ptColor(ptRemaining: number, ptTotal: number): string {
  if (ptTotal === 0) return Colors.textMuted;
  if (ptRemaining < 5) return "#EF4444";
  if (ptRemaining < 10) return "#F97316";
  return Colors.blue;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function TrainerMembersScreen() {
  const [allMembers, setAllMembers] = useState<DisplayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("ptAsc");
  const [filter, setFilter] = useState<FilterKey>("all");

  // 메모 모달
  const [memoModal, setMemoModal] = useState(false);
  const [memoTarget, setMemoTarget] = useState<DisplayMember | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memosLoading, setMemosLoading] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [addingMemo, setAddingMemo] = useState(false);

  // 회원 추가 모달
  const [addModal, setAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPt, setAddPt] = useState("");
  const [adding, setAdding] = useState(false);

  // ── 데이터 조회 ────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      if (!jwt) throw new Error("로그인 정보가 없어요.");
      const headers = { Authorization: `Bearer ${jwt}` };

      const [linkedRes, manualRes] = await Promise.all([
        fetch(`${API_URL}/api/trainer/members`, { headers }),
        fetch(`${API_URL}/api/trainer/manual-members`, { headers }),
      ]);

      const linked: DisplayMember[] = linkedRes.ok
        ? (await linkedRes.json()).map((m: any) => ({
            key: `linked-${m.id}`,
            isLinked: true,
            id: m.id,
            name: m.user?.name ?? "-",
            ptRemaining: m.ptRemaining ?? 0,
            ptTotal: m.ptTotal ?? 0,
            goal: m.goal,
          }))
        : [];

      const manual: DisplayMember[] = manualRes.ok
        ? (await manualRes.json()).map((m: any) => ({
            key: `manual-${m.id}`,
            isLinked: false,
            id: m.id,
            name: m.name ?? "-",
            ptRemaining: m.ptRemaining ?? 0,
            ptTotal: m.ptTotal ?? 0,
            phone: m.phone,
          }))
        : [];

      setAllMembers([...linked, ...manual]);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "회원 목록을 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
    }, [fetchMembers]),
  );

  // ── 메모 조회 ──────────────────────────────────────────────────────────────
  const openMemos = async (m: DisplayMember) => {
    setMemoTarget(m);
    setMemoInput("");
    setMemos([]);
    setMemosLoading(true);
    setMemoModal(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const url = m.isLinked
        ? `${API_URL}/api/trainer/memos/member/${m.id}`
        : `${API_URL}/api/trainer/memos/manual/${m.id}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) setMemos(await res.json());
    } catch {
    } finally {
      setMemosLoading(false);
    }
  };

  // ── 메모 추가 ──────────────────────────────────────────────────────────────
  const submitMemo = async () => {
    if (!memoInput.trim() || !memoTarget) return;
    setAddingMemo(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const url = memoTarget.isLinked
        ? `${API_URL}/api/trainer/memos/member/${memoTarget.id}`
        : `${API_URL}/api/trainer/memos/manual/${memoTarget.id}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ content: memoInput.trim() }),
      });
      if (res.ok) {
        const newMemo: Memo = await res.json();
        setMemos((prev) => [newMemo, ...prev]);
        setMemoInput("");
      }
    } catch {
    } finally {
      setAddingMemo(false);
    }
  };

  // ── 메모 삭제 ──────────────────────────────────────────────────────────────
  const deleteMemo = (memoId: number) => {
    Alert.alert("메모 삭제", "이 메모를 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          const jwt = await AsyncStorage.getItem("jwt");
          await fetch(`${API_URL}/api/trainer/memos/${memoId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${jwt}` },
          });
          setMemos((prev) => prev.filter((m) => m.id !== memoId));
        },
      },
    ]);
  };

  // ── 미연동 회원 추가 ───────────────────────────────────────────────────────
  const addManualMember = async () => {
    if (!addName.trim()) {
      Alert.alert("알림", "이름을 입력해주세요.");
      return;
    }
    setAdding(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/manual-members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          name: addName.trim(),
          phone: addPhone.trim() || null,
          ptTotal: addPt ? parseInt(addPt) : 0,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      setAddModal(false);
      setAddName("");
      setAddPhone("");
      setAddPt("");
      fetchMembers();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAdding(false);
    }
  };

  // ── 정렬 / 필터 ────────────────────────────────────────────────────────────
  const displayed = allMembers
    .filter((m) =>
      filter === "all" ? true : filter === "linked" ? m.isLinked : !m.isLinked,
    )
    .filter((m) => m.name.includes(search))
    .sort((a, b) =>
      sortBy === "ptAsc"
        ? a.ptRemaining - b.ptRemaining
        : b.ptRemaining - a.ptRemaining,
    );

  const linkedCount = allMembers.filter((m) => m.isLinked).length;
  const unlinkedCount = allMembers.filter((m) => !m.isLinked).length;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 32,
        }}
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
          <View>
            <Text
              style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}
            >
              회원
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}
            >
              연동 {linkedCount}명 · 미연동 {unlinkedCount}명
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setAddName("");
              setAddPhone("");
              setAddPt("");
              setAddModal(true);
            }}
            style={{
              backgroundColor: Colors.green,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: "#fff",
                fontWeight: "700",
                lineHeight: 16,
              }}
            >
              +
            </Text>
            <Text style={{ fontSize: 12, color: "#fff", fontWeight: "700" }}>
              회원 추가
            </Text>
          </TouchableOpacity>
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
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            placeholder="회원 이름 검색"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              fontSize: 14,
              color: Colors.text,
              paddingVertical: 12,
            }}
          />
        </View>

        {/* 필터 + 정렬 */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          {(["all", "linked", "unlinked"] as FilterKey[]).map((f) => {
            const label =
              f === "all" ? "전체" : f === "linked" ? "연동" : "미연동";
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: active ? Colors.green : Colors.border,
                  backgroundColor: active ? Colors.greenLight : Colors.bgSub,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: active ? Colors.green : Colors.textMuted,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() =>
              setSortBy((s) => (s === "ptAsc" ? "ptDesc" : "ptAsc"))
            }
            style={{
              marginLeft: "auto",
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: Colors.border,
              backgroundColor: Colors.bgSub,
            }}
          >
            <Text style={{ fontSize: 12, color: Colors.textMuted }}>
              {sortBy === "ptAsc" ? "잔여 적은순 ↑" : "잔여 많은순 ↓"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 색상 범례 */}
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginBottom: 14,
            paddingHorizontal: 2,
          }}
        >
          {[
            ["#EF4444", "5회 미만"],
            ["#F97316", "10회 미만"],
            [Colors.blue, "10회 이상"],
          ].map(([c, l]) => (
            <View
              key={l}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: c,
                }}
              />
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>{l}</Text>
            </View>
          ))}
        </View>

        {/* 회원 목록 */}
        {displayed.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>👥</Text>
            <Text style={{ fontSize: 15, color: Colors.textMuted }}>
              {search ? "검색 결과가 없어요" : "등록된 회원이 없어요"}
            </Text>
          </View>
        ) : (
          displayed.map((m) => {
            const color = ptColor(m.ptRemaining, m.ptTotal);
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() =>
                  m.isLinked
                    ? router.push(`/(tabs)/trainer/member-detail?id=${m.id}`)
                    : openMemos(m)
                }
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: !m.isLinked ? "#FED7AA" : Colors.border,
                  borderLeftWidth: 3,
                  borderLeftColor: !m.isLinked ? "#F97316" : Colors.green,
                }}
              >
                {/* 아바타 */}
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: m.isLinked ? Colors.green : "#F97316",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <Text
                    style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}
                  >
                    {m.name[0]}
                  </Text>
                </View>

                {/* 이름 + 뱃지 + 메모 버튼 */}
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: Colors.text,
                      }}
                    >
                      {m.name}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: m.isLinked
                          ? Colors.greenLight
                          : "#FFF7ED",
                        borderWidth: 1,
                        borderColor: m.isLinked
                          ? Colors.green + "44"
                          : "#FDBA7455",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "800",
                          color: m.isLinked ? Colors.green : "#F97316",
                        }}
                      >
                        {m.isLinked ? "연동" : "미연동"}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    {m.isLinked
                      ? m.goal || "목표 미설정"
                      : m.phone || "전화번호 미입력"}
                  </Text>
                  {/* 메모 버튼 */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      openMemos(m);
                    }}
                    style={{
                      alignSelf: "flex-start",
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      backgroundColor: Colors.bgSub,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: Colors.textSub,
                        fontWeight: "700",
                      }}
                    >
                      메모
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* PT 잔여 */}
                <View style={{ alignItems: "flex-end" }}>
                  {m.ptTotal > 0 ? (
                    <>
                      <Text style={{ fontSize: 22, fontWeight: "900", color }}>
                        {m.ptRemaining}
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
            );
          })
        )}
      </ScrollView>

      {/* ── 메모 모달 ─────────────────────────────────────────────────────────── */}
      <Modal
        visible={memoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setMemoModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setMemoModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableOpacity activeOpacity={1}>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingHorizontal: 24,
                  paddingTop: 20,
                  paddingBottom: Platform.OS === "ios" ? 40 : 24,
                }}
              >
                {/* 핸들 */}
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                    alignSelf: "center",
                    marginBottom: 16,
                  }}
                />

                {/* 헤더 */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: memoTarget?.isLinked
                        ? Colors.green
                        : "#F97316",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}
                    >
                      {memoTarget?.name[0]}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: "800",
                      color: Colors.text,
                    }}
                  >
                    {memoTarget?.name}님 메모
                  </Text>
                </View>

                {/* 메모 목록 */}
                <View style={{ maxHeight: 280, marginBottom: 16 }}>
                  {memosLoading ? (
                    <View style={{ alignItems: "center", paddingVertical: 24 }}>
                      <ActivityIndicator size="small" color={Colors.green} />
                    </View>
                  ) : memos.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 24 }}>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                        아직 작성된 메모가 없어요
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {memos.map((memo, i) => (
                        <View
                          key={memo.id}
                          style={{
                            backgroundColor: Colors.bgSub,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: i < memos.length - 1 ? 8 : 0,
                            borderWidth: 1,
                            borderColor: Colors.border,
                            borderLeftWidth: 3,
                            borderLeftColor: Colors.green,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                color: Colors.text,
                                flex: 1,
                                lineHeight: 20,
                              }}
                            >
                              {memo.content}
                            </Text>
                            <TouchableOpacity
                              onPress={() => deleteMemo(memo.id)}
                              style={{ padding: 4, marginLeft: 8 }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: Colors.textMuted,
                                }}
                              >
                                ✕
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 6,
                            }}
                          >
                            {memo.createdAt}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* 입력창 */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <TextInput
                    value={memoInput}
                    onChangeText={setMemoInput}
                    placeholder="메모를 입력하세요..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    style={{
                      flex: 1,
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: 12,
                      fontSize: 14,
                      color: Colors.text,
                      maxHeight: 100,
                      minHeight: 44,
                    }}
                  />
                  <TouchableOpacity
                    onPress={submitMemo}
                    disabled={addingMemo || !memoInput.trim()}
                    style={{
                      backgroundColor: memoInput.trim()
                        ? Colors.green
                        : Colors.border,
                      borderRadius: 12,
                      width: 44,
                      height: 44,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {addingMemo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 18, color: "#fff" }}>↑</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── 미연동 회원 추가 모달 ──────────────────────────────────────────── */}
      <Modal
        visible={addModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setAddModal(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableOpacity activeOpacity={1}>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingHorizontal: 28,
                  paddingTop: 20,
                  paddingBottom: Platform.OS === "ios" ? 40 : 24,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                    alignSelf: "center",
                    marginBottom: 20,
                  }}
                />

                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: Colors.text,
                    marginBottom: 4,
                  }}
                >
                  회원 추가
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginBottom: 20,
                  }}
                >
                  앱 미연동 회원을 직접 추가할 수 있어요
                </Text>

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  이름 *
                </Text>
                <TextInput
                  value={addName}
                  onChangeText={setAddName}
                  placeholder="예: 홍길동"
                  placeholderTextColor={Colors.textMuted}
                  style={inputStyle}
                />

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  전화번호 (선택)
                </Text>
                <TextInput
                  value={addPhone}
                  onChangeText={setAddPhone}
                  placeholder="예: 010-1234-5678"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  style={inputStyle}
                />

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 8,
                  }}
                >
                  초기 PT 수 (선택)
                </Text>
                <TextInput
                  value={addPt}
                  onChangeText={setAddPt}
                  placeholder="예: 20"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                  style={{ ...inputStyle, marginBottom: 24 }}
                />

                <TouchableOpacity
                  onPress={addManualMember}
                  disabled={adding}
                  style={{
                    backgroundColor: Colors.green,
                    borderRadius: 12,
                    paddingVertical: 15,
                    alignItems: "center",
                    opacity: adding ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}
                  >
                    {adding ? "추가 중..." : "추가하기"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const inputStyle = {
  backgroundColor: Colors.bgSub,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: Colors.border,
  padding: 14,
  fontSize: 16,
  color: Colors.text,
  marginBottom: 16,
} as const;
