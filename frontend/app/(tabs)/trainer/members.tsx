import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface DisplayMember {
  key: string;
  isLinked: boolean;
  connected: boolean; // false = 연결해제된(INACTIVE) 회원
  moved: boolean; // true = 다른 트레이너로 이동한 전 회원
  disconnectedAt?: string; // 연결 해제일 (기록 열람 기준)
  ptEndedAt?: string; // PT 잔여 0회가 된 날짜 (7일 유예 카운트다운 기준)
  id: number;
  name: string;
  ptRemaining: number;
  ptTotal: number;
  goal?: string;
  phone?: string;
  otCount?: number; // OT 체험 후 PT 전환된 회원의 OT 완료 횟수
  latestMemo?: string;
}

interface Memo {
  id: number;
  content: string;
  createdAt: string;
}

type SortKey = "ptAsc" | "ptDesc" | "nameAsc";
type FilterKey = "all" | "linked" | "unlinked";

function ptColor(ptRemaining: number, ptTotal: number): string {
  if (ptTotal === 0) return Colors.textMuted;
  if (ptRemaining < 5) return "#EF4444";
  if (ptRemaining < 10) return "#F59E0B";
  return Colors.blue;
}

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function TrainerMembersScreen() {
  const insets = useSafeAreaInsets();
  const [allMembers, setAllMembers] = useState<DisplayMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plan, setPlan] = useState<"FREE" | "PRO">("PRO");
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("ptAsc");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [inactiveModal, setInactiveModal] = useState(false);

  // 메모 모달
  const [memoModal, setMemoModal] = useState(false);
  const [memoTarget, setMemoTarget] = useState<DisplayMember | null>(null);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memosLoading, setMemosLoading] = useState(false);
  const [memoInput, setMemoInput] = useState("");
  const [addingMemo, setAddingMemo] = useState(false);

  // 기존 회원 추가 모달
  const [addModal, setAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPt, setAddPt] = useState(""); // 첫 결제 PT 총수
  const [addPtRemaining, setAddPtRemaining] = useState(""); // 현재 잔여 PT 수
  const [addPaymentDate, setAddPaymentDate] = useState(""); // 결제일
  const [addAmount, setAddAmount] = useState(""); // 결제 금액
  const [adding, setAdding] = useState(false);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ── 데이터 조회 ────────────────────────────────────────────────────────────
  const fetchMembers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      if (!jwt) throw new Error("로그인 정보가 없어요.");
      const headers = { Authorization: `Bearer ${jwt}` };

      const [linkedRes, manualRes, homeRes] = await Promise.all([
        fetch(`${API_URL}/api/trainer/members`, { headers }),
        fetch(`${API_URL}/api/trainer/manual-members`, { headers }),
        fetch(`${API_URL}/api/trainer/home`, { headers }),
      ]);

      // 전체 무료 제공 중 - plan 항상 PRO
      setPlan("PRO");

      const linked: DisplayMember[] = linkedRes.ok
        ? (await linkedRes.json()).map((m: any) => ({
            key: `linked-${m.id}`,
            isLinked: true,
            connected: m.connected !== false,
            moved: m.moved === true,
            disconnectedAt: m.disconnectedAt ?? undefined,
            ptEndedAt: m.ptEndedAt ?? undefined,
            id: m.id,
            name: m.user?.name ?? "-",
            ptRemaining: m.ptRemaining ?? 0,
            ptTotal: m.ptTotal ?? 0,
            goal: m.goal,
            latestMemo: m.latestMemo ?? undefined,
          }))
        : [];

      const manual: DisplayMember[] = manualRes.ok
        ? (await manualRes.json()).map((m: any) => ({
            key: `manual-${m.id}`,
            isLinked: false,
            connected: true,
            moved: false,
            id: m.id,
            name: m.name ?? "-",
            ptRemaining: m.ptRemaining ?? 0,
            ptTotal: m.ptTotal ?? 0,
            phone: m.phone,
            ptEndedAt: m.ptEndedAt ?? undefined,
            otCount: m.otCount ?? undefined,
            latestMemo: m.latestMemo ?? undefined,
          }))
        : [];

      // ACTIVE 연동 → 미연동 → INACTIVE 연동 순으로 정렬
      const activeLinked = linked.filter((m) => m.connected);
      const inactiveLinked = linked.filter((m) => !m.connected);
      setAllMembers([...activeLinked, ...manual, ...inactiveLinked]);
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
    Keyboard.dismiss();
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

  // ── 기존 회원 추가 ───────────────────────────────────────────────────────
  const addManualMember = async () => {
    if (!addName.trim()) {
      Alert.alert("알림", "이름을 입력해주세요.");
      return;
    }
    if (!addPhone.trim()) {
      Alert.alert("알림", "전화번호를 입력해주세요.\n연동 시 회원 매칭에 사용됩니다.");
      return;
    }
    if (!addPt.trim()) {
      Alert.alert("알림", "첫 PT 결제 수를 입력해주세요.");
      return;
    }
    if (!addPtRemaining.trim()) {
      Alert.alert("알림", "현재 잔여 PT 수를 입력해주세요.");
      return;
    }
    if (!addPaymentDate.trim()) {
      Alert.alert("알림", "결제일을 입력해주세요. (예: 2026-03-15)");
      return;
    }
    if (!addAmount.trim()) {
      Alert.alert("알림", "결제 금액을 입력해주세요.");
      return;
    }
    const ptTotal = parseInt(addPt);
    const ptRemaining = parseInt(addPtRemaining);
    if (isNaN(ptTotal) || ptTotal < 1) {
      Alert.alert("알림", "PT 결제 수는 1 이상이어야 해요.");
      return;
    }
    if (isNaN(ptRemaining) || ptRemaining < 0) {
      Alert.alert("알림", "잔여 PT 수는 0 이상이어야 해요.");
      return;
    }
    if (ptRemaining > ptTotal) {
      Alert.alert("알림", "잔여 PT 수는 결제 수보다 클 수 없어요.");
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
          phone: addPhone.trim(),
          ptTotal,
          ptRemaining,
          amount: parseInt(addAmount.replace(/,/g, "")),
          paymentDate: addPaymentDate.trim(),
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      setAddModal(false);
      setAddName("");
      setAddPhone("");
      setAddPt("");
      setAddPtRemaining("");
      setAddPaymentDate("");
      setAddAmount("");
      fetchMembers();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAdding(false);
    }
  };

  // PT 종료 여부
  // · 연동/미연동 모두: ptEndedAt 기준 7일 유예 후 비활성
  // · 유예 중에는 활성 목록에 유지
  const isPtEnded = (m: DisplayMember): boolean => {
    if (m.moved || m.ptTotal === 0 || m.ptRemaining !== 0) return false;

    // ptEndedAt 없으면 아직 비활성화 안 됨
    if (!m.ptEndedAt) return false;

    const ended = new Date(m.ptEndedAt);
    const today = new Date();

    today.setHours(0, 0, 0, 0);
    ended.setHours(0, 0, 0, 0);

    // 연동/미연동 모두 PT 종료 후 7일 뒤 비활성화
    return today.getTime() - ended.getTime() >= 7 * 24 * 60 * 60 * 1000;
  };

  // 회원 우선순위 계산 (낮을수록 상단)
  // 0: 활성 연동(pt 있음) / 1: 활성 연동(pt 미등록) / 2: 미연동 / 3: PT 종료 / 4: 연결해제 / 5: 타 트레이너 이동
  const memberPriority = (m: DisplayMember): number => {
    if (m.moved) return 5; // 타 트레이너로 이동 (맨 아래)
    if (!m.connected) return 4; // 연결해제
    if (isPtEnded(m)) return 3; // PT 종료
    if (!m.isLinked) return 2; // 미연동
    if (m.isLinked && m.ptTotal === 0) return 1; // PT 미등록 연동
    return 0; // 일반 활성
  };

  // 미연동 회원 유예 기간 중 남은 일수 (활성 목록에 있는 상태)
  // ptRemaining=0 + ptEndedAt 있음 + 아직 7일 안 지남 → N일 반환
  // 해당 없으면 null
  const ptGraceDaysLeft = (m: DisplayMember): number | null => {
    if (!m.ptEndedAt || m.ptTotal === 0 || m.ptRemaining !== 0) return null;
    const ended = new Date(m.ptEndedAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    ended.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - ended.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysLeft = 7 - diffDays;
    return daysLeft > 0 ? daysLeft : null; // 0 이하면 이미 비활성화됨
  };

  // 비활성 "피티 종료" 회원의 자동 삭제까지 남은 일수
  // ptEndedAt + 37일(유예 7 + 비활성 30) - 오늘
  const ptAutoDeleteDaysLeft = (m: DisplayMember): number => {
    if (!m.ptEndedAt) return 30;
    const ended = new Date(m.ptEndedAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    ended.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - ended.getTime()) / (1000 * 60 * 60 * 24),
    );
    return Math.max(0, 37 - diffDays);
  };

  // 비활성: PT종료 / 연결해제 / 이동 — 메인 목록에서 제외, ⋮ 모달로 관리
  const isInactive = (m: DisplayMember) =>
    isPtEnded(m) || (!m.connected && !m.moved) || m.moved;

  // 메인 목록: 활성 회원만
  const activeMembers = allMembers.filter((m) => !isInactive(m));

  const displayed = activeMembers
    .filter((m) => {
      if (filter === "linked") return m.isLinked;
      if (filter === "unlinked") return !m.isLinked;
      return true;
    })
    .filter((m) => m.name.includes(search))
    .sort((a, b) => {
      if (sortBy === "nameAsc") return a.name.localeCompare(b.name, "ko");
      // 잔여 적은순/많은순: PT 미등록 회원(ptTotal=0)은 맨 뒤
      const aHasPt = a.ptTotal > 0;
      const bHasPt = b.ptTotal > 0;
      if (aHasPt !== bHasPt) return aHasPt ? -1 : 1;
      return sortBy === "ptAsc"
        ? a.ptRemaining - b.ptRemaining
        : b.ptRemaining - a.ptRemaining;
    });

  // 비활성 그룹 (⋮ 모달용)
  const ptEndedMembers = allMembers.filter((m) => isPtEnded(m));
  // 연결해제: PT없음으로 분류된 회원은 제외 (이미 ptEndedMembers에 포함)
  const disconnectedMembers = allMembers.filter(
    (m) => m.isLinked && !m.connected && !m.moved && !isPtEnded(m),
  );
  const movedMembers = allMembers.filter((m) => m.moved);
  const inactiveCount =
    ptEndedMembers.length + disconnectedMembers.length + movedMembers.length;

  const linkedCount = allMembers.filter(
    (m) => m.isLinked && m.connected && !isPtEnded(m) && !m.moved,
  ).length;
  const unlinkedCount = allMembers.filter(
    (m) => !m.isLinked && !isPtEnded(m),
  ).length;

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
          padding: 16,
          paddingTop: 52,
          paddingBottom: 28,
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
            marginBottom: 12,
          }}
        >
          <View>
            <Text
              style={{ fontSize: 22, fontWeight: "800", color: Colors.text }}
            >
              회원
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}
            >
              연동 {linkedCount}명 · 미연동 {unlinkedCount}명
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* 회원 추가 버튼 */}
            <TouchableOpacity
              onPress={() => {
                setAddName("");
                setAddPhone("");
                setAddPt("");
                setAddPtRemaining("");
                setAddPaymentDate(getTodayStr());
                setAddModal(true);
              }}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textSub,
                  fontWeight: "700",
                }}
              >
                +
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textSub,
                  fontWeight: "600",
                }}
              >
                기존 회원 추가
              </Text>
            </TouchableOpacity>
            {/* 비활성 회원 보기 버튼 */}
            <TouchableOpacity
              onPress={() => setInactiveModal(true)}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textSub,
                  fontWeight: "600",
                }}
              >
                비활성
              </Text>
              {inactiveCount > 0 && (
                <View
                  style={{
                    backgroundColor: "#9CA3AF",
                    borderRadius: 8,
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}
                  >
                    {inactiveCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 검색 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderWidth: 1,
            borderColor: Colors.border,
            borderRadius: 10,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            marginBottom: 10,
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
              paddingVertical: 10,
            }}
          />
        </View>

        {/* 필터 + 정렬 */}
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            marginBottom: 10,
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
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: active ? Colors.green : Colors.border,
                  backgroundColor: active ? Colors.greenLight : Colors.bgSub,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: active ? Colors.green : Colors.textMuted,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
            <TouchableOpacity
              onPress={() => setSortBy("ptAsc")}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: sortBy === "ptAsc" ? Colors.green : Colors.border,
                backgroundColor: sortBy === "ptAsc" ? Colors.greenLight : Colors.bgSub,
              }}
            >
              <Text style={{ fontSize: 11, color: sortBy === "ptAsc" ? Colors.green : Colors.textMuted }}>잔여 적은순</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSortBy("nameAsc")}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: sortBy === "nameAsc" ? Colors.green : Colors.border,
                backgroundColor: sortBy === "nameAsc" ? Colors.greenLight : Colors.bgSub,
              }}
            >
              <Text style={{ fontSize: 11, color: sortBy === "nameAsc" ? Colors.green : Colors.textMuted }}>ㄱㄴㄷ순</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 색상 범례 */}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            marginBottom: 10,
            paddingHorizontal: 2,
          }}
        >
          {[
            ["#EF4444", "5회 미만"],
            ["#F59E0B", "10회 미만"],
            [Colors.blue, "10회 이상"],
          ].map(([c, l]) => (
            <View
              key={l}
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
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
          displayed.map((m, index) => {
            const color = ptColor(m.ptRemaining, m.ptTotal);
            const graceDaysLeft = ptGraceDaysLeft(m);

            return (
            <React.Fragment key={m.key}>
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  marginBottom: 6,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  overflow: "hidden",
                }}
              >
                {/* 왼쪽: 회원상세로 이동 */}
                <TouchableOpacity
                  onPress={() => {
                    if (m.isLinked) {
                      router.push(`/(tabs)/trainer/member-detail?id=${m.id}` as any);
                    } else {
                      router.push(`/(tabs)/trainer/member-detail?id=${m.id}&type=manual`);
                    }
                  }}
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 12 }}
                >
                  {/* 아바타 */}
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center", marginRight: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>{m.name[0]}</Text>
                  </View>

                  {/* 이름 + 뱃지 + 메모 미리보기 */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.text }}>{m.name}</Text>
                      {!m.isLinked && (
                        <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "33" }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: Colors.green + "AA" }}>미연동</Text>
                        </View>
                      )}
                    </View>
                    {m.latestMemo ? (
                      <Text numberOfLines={1} style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                        {m.latestMemo.length > 18 ? m.latestMemo.slice(0, 18) + "..." : m.latestMemo}
                      </Text>
                    ) : null}
                  </View>

                  {/* PT 잔여 */}
                  <View style={{ alignItems: "center", minWidth: 44 }}>
                    {m.ptTotal > 0 ? (
                      <>
                        <Text style={{ fontSize: 20, fontWeight: "900", color }}>{m.ptRemaining}</Text>
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>/ {m.ptTotal}회</Text>
                      </>
                    ) : (
                      <View style={{ backgroundColor: Colors.goldBg, borderWidth: 1, borderColor: Colors.gold + "44", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, color: Colors.gold, fontWeight: "700" }}>미등록</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                {/* 오른쪽: 메모 칸 (완전히 분리) */}
                <TouchableOpacity
                  onPress={() => openMemos(m)}
                  style={{
                    width: 46,
                    borderLeftWidth: 1,
                    borderLeftColor: Colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {m.latestMemo ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green, marginBottom: 3 }} />
                  ) : null}
                  <Text style={{ fontSize: 10, fontWeight: "700", color: m.latestMemo ? Colors.green : Colors.textMuted }}>메모</Text>
                </TouchableOpacity>
              </View>
            </React.Fragment>
            );
          })
        )}
      </ScrollView>

      {/* ── 비활성 회원 관리 모달 ────────────────────────────────────────────── */}
      <Modal
        visible={inactiveModal}
        transparent
        animationType="slide"
        onRequestClose={() => setInactiveModal(false)}
      >
        <TouchableOpacity
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
          activeOpacity={1}
          onPress={() => setInactiveModal(false)}
        />
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 20,
            paddingBottom: 48,
            maxHeight: "85%",
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
          >
            {/* 헤더 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  비활성 회원
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  PT 없음 · 연결해제 · 이동 회원 관리
                </Text>
              </View>
              <TouchableOpacity onPress={() => setInactiveModal(false)}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                    ✕
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {inactiveCount === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 32, marginBottom: 10 }}>✅</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                  비활성 회원이 없어요
                </Text>
              </View>
            ) : (
              <>
                {/* PT 종료 섹션 */}
                {ptEndedMembers.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 3,
                          height: 14,
                          backgroundColor: "#9CA3AF",
                          borderRadius: 2,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.textSub,
                        }}
                      >
                        피티 종료
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                        — 30일 후 자동 삭제
                      </Text>
                    </View>
                    {ptEndedMembers.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => {
                          setInactiveModal(false);
                          const url = m.isLinked
                            ? `/(tabs)/trainer/member-detail?id=${m.id}`
                            : `/(tabs)/trainer/member-detail?id=${m.id}&type=manual`;
                          router.push(url as any);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#F9FAFB",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 6,
                          borderWidth: 1,
                          borderColor: "#E5E7EB",
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: "#D1D5DB",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#fff",
                            }}
                          >
                            {m.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: Colors.textMuted,
                            }}
                          >
                            {m.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 2,
                            }}
                          >
                            PT 0 / {m.ptTotal}회
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                          {m.isLinked && (
                            <TouchableOpacity
                              onPress={async (e) => {
                                e.stopPropagation();
                                Alert.alert("회원 복귀", `${m.name}님을 활성 회원으로 복귀시킬까요?`, [
                                  { text: "취소", style: "cancel" },
                                  {
                                    text: "복귀",
                                    onPress: async () => {
                                      const jwt = await AsyncStorage.getItem("jwt");
                                      const res = await fetch(`${API_URL}/api/trainer/members/${m.id}/reactivate`, {
                                        method: "POST",
                                        headers: { Authorization: `Bearer ${jwt}` },
                                      });
                                      const result = await res.json();
                                      if (res.ok) {
                                        Alert.alert("완료", result.message);
                                        setInactiveModal(false);
                                        fetchMembers();
                                      } else {
                                        Alert.alert("오류", result.message);
                                      }
                                    },
                                  },
                                ]);
                              }}
                              style={{
                                backgroundColor: Colors.greenLight,
                                borderRadius: 6,
                                paddingHorizontal: 7,
                                paddingVertical: 3,
                                borderWidth: 1,
                                borderColor: Colors.green + "44",
                              }}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.green }}>회원 복귀</Text>
                            </TouchableOpacity>
                          )}
                          <View
                            style={{
                              backgroundColor: "#F3F4F6",
                              borderRadius: 6,
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                              borderWidth: 1,
                              borderColor: "#D1D5DB",
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B7280" }}>
                              피티 종료
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* 연결해제 섹션 */}
                {disconnectedMembers.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 3,
                          height: 14,
                          backgroundColor: "#9CA3AF",
                          borderRadius: 2,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.textSub,
                        }}
                      >
                        연결해제
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                        — 30일 후 자동 삭제
                      </Text>
                    </View>
                    {disconnectedMembers.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => {
                          setInactiveModal(false);
                          router.push(
                            `/(tabs)/trainer/member-detail?id=${m.id}` as any,
                          );
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#F9FAFB",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 6,
                          borderWidth: 1,
                          borderColor: "#E5E7EB",
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: "#D1D5DB",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#fff",
                            }}
                          >
                            {m.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: Colors.textMuted,
                            }}
                          >
                            {m.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 2,
                            }}
                          >
                            {m.disconnectedAt
                              ? `해제일 ${m.disconnectedAt.replace(/-/g, ".")}`
                              : "연결해제"}
                            {m.ptTotal > 0 ? ` · 잔여 ${m.ptRemaining}회` : ""}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                          <TouchableOpacity
                            onPress={async (e) => {
                              e.stopPropagation();
                              Alert.alert("회원 복귀", `${m.name}님을 활성 회원으로 복귀시킬까요?`, [
                                { text: "취소", style: "cancel" },
                                {
                                  text: "복귀",
                                  onPress: async () => {
                                    const jwt = await AsyncStorage.getItem("jwt");
                                    const res = await fetch(`${API_URL}/api/trainer/members/${m.id}/reactivate`, {
                                      method: "POST",
                                      headers: { Authorization: `Bearer ${jwt}` },
                                    });
                                    const result = await res.json();
                                    if (res.ok) {
                                      Alert.alert("완료", result.message);
                                      setInactiveModal(false);
                                      fetchMembers();
                                    } else {
                                      Alert.alert("오류", result.message);
                                    }
                                  },
                                },
                              ]);
                            }}
                            style={{
                              backgroundColor: Colors.greenLight,
                              borderRadius: 6,
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                              borderWidth: 1,
                              borderColor: Colors.green + "44",
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.green }}>회원 복귀</Text>
                          </TouchableOpacity>
                          <View
                            style={{
                              backgroundColor: "#F3F4F6",
                              borderRadius: 6,
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                              borderWidth: 1,
                              borderColor: "#D1D5DB",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: "#6B7280",
                              }}
                            >
                              연결해제
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* 이동 섹션 */}
                {movedMembers.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 3,
                          height: 14,
                          backgroundColor: "#A78BFA",
                          borderRadius: 2,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.textSub,
                        }}
                      >
                        타 트레이너 이동
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                        — 해제일까지 기록 열람
                      </Text>
                    </View>
                    {movedMembers.map((m) => (
                      <TouchableOpacity
                        key={m.key}
                        onPress={() => {
                          setInactiveModal(false);
                          const params = m.disconnectedAt
                            ? `/(tabs)/trainer/member-detail?id=${m.id}&readOnlyUntil=${m.disconnectedAt}`
                            : `/(tabs)/trainer/member-detail?id=${m.id}`;
                          router.push(params as any);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#F5F3FF",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 6,
                          borderWidth: 1,
                          borderColor: "#DDD6FE",
                        }}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            backgroundColor: "#A78BFA",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: "#fff",
                            }}
                          >
                            {m.name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "700",
                              color: Colors.textMuted,
                            }}
                          >
                            {m.name}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: Colors.textMuted,
                              marginTop: 2,
                            }}
                          >
                            {m.disconnectedAt
                              ? `${m.disconnectedAt.replace(/-/g, ".")}까지 기록 열람 가능`
                              : "이동된 회원"}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: "#EDE9FE",
                            borderRadius: 6,
                            paddingHorizontal: 7,
                            paddingVertical: 3,
                            borderWidth: 1,
                            borderColor: "#DDD6FE",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: "#7C3AED",
                            }}
                          >
                            이동
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── 메모 모달 ─────────────────────────────────────────────────────────── */}
      <Modal
        visible={memoModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setMemoModal(false); fetchMembers(); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
            activeOpacity={1}
            onPress={() => { setMemoModal(false); fetchMembers(); }}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: 40,
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
                    : Colors.green,
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
            <View style={{ maxHeight: 200, marginBottom: 12 }}>
              {memosLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
                  <ActivityIndicator size="small" color={Colors.green} />
                </View>
              ) : memos.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 16 }}>
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
                        backgroundColor: "#fff",
                        borderRadius: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        marginBottom: i < memos.length - 1 ? 6 : 0,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        flexDirection: "row",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 13,
                            color: Colors.text,
                            lineHeight: 18,
                          }}
                        >
                          {memo.content}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            color: Colors.textMuted,
                            marginTop: 4,
                          }}
                        >
                          {memo.createdAt}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => deleteMemo(memo.id)}
                        style={{ padding: 4, marginLeft: 6 }}
                      >
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 업그레이드 바텀시트 (비활성화 - 전체 무료 제공 중) ──────────────────────────────────────────── */}
      <Modal
        visible={false}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setPaymentVisible(false)}
        >
          <GestureDetector
            gesture={Gesture.Pan().onEnd((e) => {
              if (e.translationY > 80) setPaymentVisible(false);
            })}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 28,
                paddingBottom: Math.max(insets.bottom, 28),
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
                  fontSize: 20,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 4,
                }}
              >
                PRO 플랜으로 업그레이드
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textMuted,
                  marginBottom: 20,
                  lineHeight: 20,
                }}
              >
                무료 플랜은 회원을 최대 5명까지 등록할 수 있어요.{"\n"}PRO로
                업그레이드하면 회원 수 제한이 없어져요.
              </Text>
              <View
                style={{
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1.5,
                  borderColor: Colors.green + "55",
                  backgroundColor: Colors.greenLight,
                  marginBottom: 20,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "900",
                      color: Colors.green,
                    }}
                  >
                    PRO
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-end",
                      gap: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 26,
                        fontWeight: "900",
                        color: Colors.green,
                      }}
                    >
                      14,900
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: Colors.green,
                        marginBottom: 3,
                      }}
                    >
                      원/월
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textSub,
                    lineHeight: 22,
                  }}
                >
                  ✓ 회원 무제한{"\n"}(무료 플랜: 최대 5명)
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      if (
                        !Purchases ||
                        typeof Purchases.getOfferings !== "function"
                      ) {
                        Alert.alert("오류", "결제 모듈을 불러오지 못했어요.");
                        return;
                      }
                      const offerings = await Purchases.getOfferings();
                      const pkg =
                        offerings.current?.monthly ??
                        offerings.current?.availablePackages[0];
                      if (!pkg) {
                        Alert.alert("오류", "구독 상품을 불러오지 못했어요.");
                        return;
                      }
                      await Purchases.purchasePackage(pkg);
                      setPlan("PRO");
                      setPaymentVisible(false);
                      Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                      setTimeout(() => fetchMembers(), 3000);
                    } catch (e: any) {
                      if (!e.userCancelled)
                        Alert.alert(
                          "결제 실패",
                          e.message ?? "다시 시도해주세요.",
                        );
                    }
                  }}
                  style={{
                    marginTop: 16,
                    backgroundColor: Colors.green,
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}
                  >
                    시작하기
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    const customerInfo = await Purchases.restorePurchases();
                    if (customerInfo.entitlements.active["FitLogApp Pro"]) {
                      setPlan("PRO");
                      setPaymentVisible(false);
                      Alert.alert("복원 완료", "구독이 복원됐어요.");
                      setTimeout(() => fetchMembers(), 2000);
                    } else {
                      Alert.alert("복원 없음", "복원할 구독이 없어요.");
                    }
                  } catch (e: any) {
                    Alert.alert("오류", e?.message ?? "복원에 실패했어요.");
                  }
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 14,
                    color: Colors.textMuted,
                  }}
                >
                  구독 복원하기
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginTop: 12 }}
                onPress={() => setPaymentVisible(false)}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 14,
                    color: Colors.textMuted,
                  }}
                >
                  나중에 할게요
                </Text>
              </TouchableOpacity>
            </View>
          </GestureDetector>
        </TouchableOpacity>
      </Modal>

      {/* ── 기존 회원 추가 모달 ──────────────────────────────────────────── */}
      <Modal
        visible={addModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <TouchableOpacity
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
            activeOpacity={1}
            onPress={() => setAddModal(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              maxHeight: "92%",
            }}
          >
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
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 28,
                paddingBottom: 48,
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
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  기존 회원 추가
                </Text>
                <TouchableOpacity
                  onPress={() => setAddModal(false)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: Colors.textMuted,
                      lineHeight: 18,
                    }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textMuted,
                  marginBottom: 20,
                }}
              >
                앱 가입 전 기존 회원을 직접 등록할 수 있어요
              </Text>

              <Text style={labelStyle}>이름 *</Text>
              <TextInput
                value={addName}
                onChangeText={setAddName}
                placeholder="예: 홍길동"
                placeholderTextColor={Colors.textMuted}
                style={inputStyle}
              />

              <Text style={labelStyle}>전화번호 *</Text>
              <TextInput
                value={addPhone}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, "");

                  let formatted = digits;

                  if (digits.length < 4) {
                    formatted = digits;
                  } else if (digits.length < 8) {
                    formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                  } else {
                    formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
                  }

                  setAddPhone(formatted);
                }}
                placeholder="예: 010-1234-5678"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                maxLength={13}
                style={inputStyle}
              />

              {/* 구분선 */}
              <View
                style={{
                  height: 1,
                  backgroundColor: Colors.border,
                  marginVertical: 8,
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 14,
                  lineHeight: 17,
                }}
              >
                아래 항목은 회원 PT 이력 파악을 위해 필수로 입력해주세요
              </Text>

              <Text style={labelStyle}>첫 PT 결제 수 (회) *</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                처음 등록할 때 구매한 총 수업 수
              </Text>
              <TextInput
                value={addPt}
                onChangeText={setAddPt}
                placeholder="예: 20"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={inputStyle}
              />

              <Text style={labelStyle}>현재 잔여 PT 수 (회) *</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                지금까지 수업을 진행하고 남은 횟수
              </Text>
              <TextInput
                value={addPtRemaining}
                onChangeText={setAddPtRemaining}
                placeholder="예: 15"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={inputStyle}
              />

              <Text style={labelStyle}>결제 금액 (원) *</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                첫 PT 결제 금액 — 매출 집계에 사용돼요
              </Text>
              <TextInput
                value={addAmount}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, "");
                  setAddAmount(digits ? Number(digits).toLocaleString() : "");
                }}
                placeholder="예: 500,000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={inputStyle}
              />

              <Text style={labelStyle}>결제일 *</Text>
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                처음 PT를 결제한 날짜
              </Text>
              <TextInput
                value={addPaymentDate}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, "");
                  let formatted = digits;
                  if (digits.length >= 5)
                    formatted = digits.slice(0, 4) + "-" + digits.slice(4);
                  if (digits.length >= 7)
                    formatted =
                      digits.slice(0, 4) +
                      "-" +
                      digits.slice(4, 6) +
                      "-" +
                      digits.slice(6, 8);
                  setAddPaymentDate(formatted);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                style={{ ...inputStyle, marginBottom: 28 }}
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
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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

const labelStyle = {
  fontSize: 13,
  fontWeight: "700" as const,
  color: Colors.textSub,
  marginBottom: 8,
};
