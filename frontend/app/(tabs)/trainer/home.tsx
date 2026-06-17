import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncAllData } from "../../../hooks/useGoogleSheets";
import { useFocusEffect } from "@react-navigation/native";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Purchases from "react-native-purchases";
import { shareTextTemplate } from "@react-native-kakao/share";
import { Colors } from "../../../constants/Colors";
import { API_URL, APP_STORE_URL, PLAY_STORE_URL } from "../../../constants/api";

interface TodayPt {
  scheduleId?: number;
  memberId: number;
  memberName: string;
  time: string;
  ptRemaining: number;
  completed?: boolean;
  isManual?: boolean;
  sessionType?: string; // "PT" | "OT"
  isNoShow?: boolean;   // 명시적 NO_SHOW 처리됨
  otSessionCount?: number; // OT 누적 횟수
}

interface HomeData {
  trainerId: number;
  trainerName: string;
  totalMembers: number;
  todaySchedules: number;
  todayPtList: TodayPt[];
  trainerCode: string;
  plan: string;
  goalSessions: number | null;
  goalRevenue: number | null;
  monthSessions: number;
  monthRevenue: number;
  monthRevenueDetails: {
    memberName: string;
    sessions: number;
    amount: number;
    memo?: string;
    date?: string;
    contractId?: number;
    manualMemberId?: number;
  }[];
  noShowCount: number;
  trialEndDate?: string | null; // 무료 체험 중일 때만 "YYYY-MM-DD", 정식 PRO면 null
}

interface Member {
  id: number;
  user: { name: string };
  ptRemaining: number;
  connected?: boolean;
}

interface ManualMemberItem {
  id: number;
  name: string;
  ptRemaining: number | null;
}

interface CombinedPayMember {
  id: number;
  name: string;
  ptRemaining: number;
  isManual: boolean;
  isDisconnected: boolean;
  originalLinked: Member | null;
  originalManual: ManualMemberItem | null;
}

interface Noti {
  notificationId: number;
  type: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

const NOTI_ICON: Record<string, string> = {
  WORKOUT_LOG: "💪",
  SCHEDULE: "📅",
  FEEDBACK: "💬",
  PT_EXPIRY: "⏰",
  GENERAL: "🔔",
};

export default function TrainerHomeScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [actionModal, setActionModal] = useState<{ visible: boolean; item: TodayPt | null }>({ visible: false, item: null });
  const [notifications, setNotifications] = useState<Noti[]>([]);
  const [paymentVisible, setPaymentVisible] = useState(false);

  // 목표 설정 모달
  const [goalModal, setGoalModal] = useState(false);
  const [goalSessionsInput, setGoalSessionsInput] = useState("");
  const [goalRevenueInput, setGoalRevenueInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalNudgeVisible, setGoalNudgeVisible] = useState(false);
  const [pendingPayAfterGoal, setPendingPayAfterGoal] = useState(false);

  // 메모 확인/수정 팝업 (contractId가 null이면 읽기 전용)
  const [memoPopup, setMemoPopup] = useState<{
    contractId: number | null;
    memo: string;
  } | null>(null);
  const [memoEditText, setMemoEditText] = useState("");
  const [savingMemo, setSavingMemo] = useState(false);

  // 결제 삭제 / 위약금 모달
  const [penaltyModal, setPenaltyModal] = useState<{ contractId: number; memberName: string } | null>(null);
  const [penaltyAmountInput, setPenaltyAmountInput] = useState("");
  const [savingPenalty, setSavingPenalty] = useState(false);

  const handleDeleteContract = (contractId: number) => {
    Alert.alert(
      "결제내역 삭제",
      "결제내역이 사라집니다. 정말 삭제하시겠어요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(`${API_URL}/api/payment/contracts/${contractId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${jwt}` },
              });
              if (!res.ok) throw new Error("삭제 실패");
              fetchHome();
            } catch (e: any) {
              Alert.alert("오류", e.message);
            }
          },
        },
        {
          text: "환불 및 위약금",
          onPress: () => {
            setPenaltyAmountInput("");
            setPenaltyModal({ contractId, memberName: "" });
          },
        },
      ],
    );
  };

  const handleDeleteContractWithName = (contractId: number, memberName: string) => {
    Alert.alert(
      "결제내역 삭제",
      "결제내역이 사라집니다. 정말 삭제하시겠어요?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(`${API_URL}/api/payment/contracts/${contractId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${jwt}` },
              });
              if (!res.ok) throw new Error("삭제 실패");
              fetchHome();
            } catch (e: any) {
              Alert.alert("오류", e.message);
            }
          },
        },
        {
          text: "환불 및 위약금",
          onPress: () => {
            setPenaltyAmountInput("");
            setPenaltyModal({ contractId, memberName });
          },
        },
      ],
    );
  };

  const savePenalty = async () => {
    if (!penaltyModal) return;
    setSavingPenalty(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/payment/contracts/${penaltyModal.contractId}/penalty`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ amount: parseInt(penaltyAmountInput.replace(/,/g, "")) || 0 }),
      });
      if (!res.ok) throw new Error("위약금 적용 실패");
      setPenaltyModal(null);
      fetchHome();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSavingPenalty(false);
    }
  };

  // 결제 수정 모달
  const [editModal, setEditModal] = useState(false);
  const [editContractId, setEditContractId] = useState<number | null>(null);
  const [editManualMemberId, setEditManualMemberId] = useState<number | null>(
    null,
  );
  const [editSessionsInput, setEditSessionsInput] = useState("");
  const [editAmountInput, setEditAmountInput] = useState("");
  const [editMemoInput, setEditMemoInput] = useState("");
  const [editOriginalSessions, setEditOriginalSessions] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (d: {
    contractId?: number;
    manualMemberId?: number;
    sessions: number;
    amount: number;
    memo?: string;
  }) => {
    if (!d.contractId && !d.manualMemberId) return;
    setEditContractId(d.contractId ?? null);
    setEditManualMemberId(d.manualMemberId ?? null);
    setEditOriginalSessions(d.sessions);
    setEditSessionsInput(String(d.sessions));
    setEditAmountInput(d.amount.toLocaleString());
    setEditMemoInput(d.memo ?? "");
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editContractId && !editManualMemberId) return;
    setSavingEdit(true);
    const body = {
      sessions: parseInt(editSessionsInput) || editOriginalSessions,
      amount: parseInt(editAmountInput.replace(/,/g, "")),
      memo: editMemoInput.trim() || null,
    };
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const url = editContractId
        ? `${API_URL}/api/trainer/members/contracts/${editContractId}`
        : `${API_URL}/api/trainer/manual-members/${editManualMemberId}`;
      const method = editContractId ? "PUT" : "PUT";
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("수정 실패");
      setEditModal(false);
      fetchHome();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // 결제 추가 모달
  const [payAddModal, setPayAddModal] = useState(false);
  const [payMembers, setPayMembers] = useState<Member[]>([]);
  const [payManualMembers, setPayManualMembers] = useState<ManualMemberItem[]>(
    [],
  );
  const [payCombinedMembers, setPayCombinedMembers] = useState<CombinedPayMember[]>([]);
  const [payMembersLoading, setPayMembersLoading] = useState(false);
  const [paySelectedMember, setPaySelectedMember] = useState<Member | null>(
    null,
  );
  const [paySelectedManualMember, setPaySelectedManualMember] =
    useState<ManualMemberItem | null>(null);
  const [paySessionsInput, setPaySessionsInput] = useState("");
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payMemoInput, setPayMemoInput] = useState("");
  const [addingPay, setAddingPay] = useState(false);
  const [payContractDateInput, setPayContractDateInput] = useState("");

  // 신규 회원 모드
  const [payMemberType, setPayMemberType] = useState<"existing" | "new">(
    "existing",
  );
  const [payNewName, setPayNewName] = useState("");
  const [payNewPhone, setPayNewPhone] = useState("");

  // 월별 매출 네비게이션
  const [revenueMonthOffset, setRevenueMonthOffset] = useState(0); // 0 = 이번 달
  const [selectedMonthRevenue, setSelectedMonthRevenue] = useState<{
    monthRevenue: number;
    monthRevenueDetails: any[];
  } | null>(null);
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  // ── 월 레이블 / 키 헬퍼 ────────────────────────────────────────────────────
  const getMonthLabel = (offset: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  };
  const getMonthKey = (offset: number): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const getTodayStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // ── 특정 월 매출 조회 ────────────────────────────────────────────────────
  const fetchMonthRevenue = async (offset: number) => {
    setLoadingRevenue(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const month = getMonthKey(offset);
      const res = await fetch(`${API_URL}/api/trainer/revenue?month=${month}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const d = await res.json();
        setSelectedMonthRevenue({
          monthRevenue: d.monthRevenue,
          monthRevenueDetails: d.monthRevenueDetails ?? [],
        });
      }
    } catch {
    } finally {
      setLoadingRevenue(false);
    }
  };

  // ── PDF 생성 & 공유 ──────────────────────────────────────────────────────
  const generatePdf = async () => {
    const monthLabel = getMonthLabel(revenueMonthOffset);
    const revenue =
      revenueMonthOffset === 0
        ? (data?.monthRevenue ?? 0)
        : (selectedMonthRevenue?.monthRevenue ?? 0);
    const details: any[] =
      revenueMonthOffset === 0
        ? (data?.monthRevenueDetails ?? [])
        : (selectedMonthRevenue?.monthRevenueDetails ?? []);

    const totalSessions = details.reduce(
      (sum, d) => sum + (d.sessions ?? 0),
      0,
    );

    const rows = details
      .map(
        (d, i) => `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8faf8"};">
          <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;color:#555;font-size:13px;">${d.date ?? "-"}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;font-weight:600;font-size:13px;">${d.memberName}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:center;font-size:13px;">${d.sessions}회</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;text-align:right;font-weight:700;color:#2E7D32;font-size:13px;">${Number(d.amount).toLocaleString()}원</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e8e8e8;color:#888;font-size:12px;">${d.memo ?? "-"}</td>
        </tr>
      `,
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; background: #fff; color: #111; padding: 40px 48px; }
    .header { border-bottom: 3px solid #2E7D32; padding-bottom: 20px; margin-bottom: 28px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 22px; font-weight: 800; color: #111; }
    .subtitle { font-size: 13px; color: #888; margin-top: 4px; }
    .badge { background: #2E7D32; color: #fff; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    .summary { display: flex; gap: 16px; margin-bottom: 28px; }
    .summary-card { flex: 1; background: #f6fbf7; border: 1.5px solid #c8e6c9; border-radius: 12px; padding: 18px 20px; }
    .summary-label { font-size: 11px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .summary-value { font-size: 24px; font-weight: 800; color: #2E7D32; }
    .summary-value.dark { color: #111; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #2E7D32; }
    thead th { padding: 11px 12px; color: #fff; font-weight: 700; font-size: 12px; text-align: left; }
    thead th.center { text-align: center; }
    thead th.right { text-align: right; }
    tfoot tr { background: #f0f7f0; }
    tfoot td { padding: 11px 12px; font-weight: 800; font-size: 13px; border-top: 2px solid #2E7D32; }
    tfoot td.right { text-align: right; color: #2E7D32; }
    tfoot td.center { text-align: center; }
    .empty { text-align: center; padding: 48px; color: #bbb; font-size: 14px; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
    .footer-brand { font-size: 13px; font-weight: 800; color: #2E7D32; }
    .footer-date { font-size: 11px; color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div>
        <div class="title">${monthLabel} 매출 리포트</div>
        <div class="subtitle">${data?.trainerName ?? ""} 트레이너</div>
      </div>
      <div class="badge">FitLog</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="summary-label">이달 총 매출</div>
      <div class="summary-value">${Number(revenue).toLocaleString()}원</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">결제 건수</div>
      <div class="summary-value dark">${details.length}건</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">총 수업 수</div>
      <div class="summary-value dark">${totalSessions}회</div>
    </div>
  </div>

  ${
    rows.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th style="width:70px;">날짜</th>
        <th>회원명</th>
        <th class="center" style="width:60px;">수업</th>
        <th class="right" style="width:110px;">결제금액</th>
        <th style="width:140px;">메모</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="font-weight:800;">합계</td>
        <td class="center">${totalSessions}회</td>
        <td class="right">${Number(revenue).toLocaleString()}원</td>
        <td></td>
      </tr>
    </tfoot>
  </table>
  `
      : `<div class="empty">이 달 결제 내역이 없어요</div>`
  }

  <div class="footer">
    <div class="footer-brand">FitLog</div>
    <div class="footer-date">생성일: ${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</div>
  </div>
</body>
</html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `FitLog_${data?.trainerName ?? "트레이너"}_${monthLabel}_매출리포트.pdf`;
      const destUri = (FileSystem.cacheDirectory ?? "") + fileName;
      await FileSystem.moveAsync({ from: uri, to: destUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(destUri, {
          mimeType: "application/pdf",
          dialogTitle: `${monthLabel} 매출 리포트`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("알림", "이 기기에서는 공유를 지원하지 않아요.");
      }
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "PDF 생성 실패");
    }
  };

  // ── 초대 버튼 핸들러 ──────────────────────────────────────────────────────
  const handleInvitePress = () => {
    // 전체 무료 제공 중 - 제한 없음
    setInviteVisible(true);
  };

  const inviteDragGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationY > 60) setInviteVisible(false);
    });
  const payScrollRef = useRef<ScrollView>(null);

  const payAddDragGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationY > 60) setPayAddModal(false);
    });
  const editDragGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationY > 60) setEditModal(false);
    });
  const goalDragGesture = Gesture.Pan()
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationY > 60) setGoalModal(false);
    });

  const fetchHome = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = { Authorization: `Bearer ${jwt}` };
      const [homeRes, notiRes] = await Promise.all([
        fetch(`${API_URL}/api/trainer/home`, { headers }),
        fetch(`${API_URL}/api/notifications`, { headers }),
      ]);
      if (!homeRes.ok) throw new Error("홈 데이터 조회 실패");
      const homeData = await homeRes.json();
      setData(homeData);

      // 결제 추가용 회원 목록 미리 로드
      try {
        const membersRes = await fetch(`${API_URL}/api/trainer/members`, {
          headers,
        });
        if (membersRes.ok) {
          const members = await membersRes.json();

          console.log("[결제추가 fetchHome 회원목록 원본]", members);

          members.sort((a: any, b: any) => {
            const aDisconnected = a.connected === false ? 1 : 0;
            const bDisconnected = b.connected === false ? 1 : 0;

            if (aDisconnected !== bDisconnected) {
              return aDisconnected - bDisconnected;
            }

            return (a.ptRemaining ?? 0) - (b.ptRemaining ?? 0);
          });

          console.log("[결제추가 fetchHome 회원목록 정렬후]", members);
          setPayMembers(members);
        }
      } catch {}

      // RevenueCat 비활성화 (전체 무료 제공 중)
      if (notiRes.ok) setNotifications((await notiRes.json()).slice(0, 10));
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const saveGoals = async () => {
    setSavingGoal(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/goals`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          goalSessions: goalSessionsInput ? parseInt(goalSessionsInput) : null,
          goalRevenue: goalRevenueInput
            ? parseInt(goalRevenueInput.replace(/,/g, ""))
            : null,
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setGoalModal(false);
      if (pendingPayAfterGoal) {
        setPendingPayAfterGoal(false);
        openPayModal();
      }
      fetchHome();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSavingGoal(false);
    }
  };

  const openPayModal = async () => {
    setPaySelectedMember(null);
    setPaySelectedManualMember(null);
    setPaySessionsInput("");
    setPayAmountInput("");
    setPayMemoInput("");
    setPayContractDateInput(getTodayStr());
    setPayMemberType("existing");
    setPayNewName("");
    setPayNewPhone("");
    setPayMembers([]);
    setPayManualMembers([]);
    setPayCombinedMembers([]);
    setPayMembersLoading(true);
    setPayAddModal(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const [membersRes, manualRes] = await Promise.all([
        fetch(`${API_URL}/api/trainer/members`, {
          headers: { Authorization: `Bearer ${jwt}` },
        }),
        fetch(`${API_URL}/api/trainer/manual-members`, {
          headers: { Authorization: `Bearer ${jwt}` },
        }),
      ]);

      const combined: CombinedPayMember[] = [];

      if (membersRes.ok) {
        const members = await membersRes.json();
        setPayMembers(members);
        members.forEach((m: any) => {
          combined.push({
            id: m.id,
            name: m.user?.name ?? "",
            ptRemaining: m.ptRemaining ?? 0,
            isManual: false,
            isDisconnected: m.connected === false,
            originalLinked: m as Member,
            originalManual: null,
          });
        });
      }
      if (manualRes.ok) {
        const manualMembers = await manualRes.json();
        setPayManualMembers(manualMembers);
        manualMembers.forEach((m: any) => {
          combined.push({
            id: m.id,
            name: m.name ?? "",
            ptRemaining: m.ptRemaining ?? 0,
            isManual: true,
            isDisconnected: false,
            originalLinked: null,
            originalManual: m as ManualMemberItem,
          });
        });
      }

      // 연결해제 회원은 맨 끝, 나머지는 ptRemaining 오름차순 (0→1→3→5...)
      combined.sort((a, b) => {
        if (a.isDisconnected !== b.isDisconnected) return a.isDisconnected ? 1 : -1;
        return a.ptRemaining - b.ptRemaining;
      });

      setPayCombinedMembers(combined);
    } catch {
    } finally {
      setPayMembersLoading(false);
    }
  };

  const handlePayButtonPress = () => {
    if (data?.goalSessions == null && data?.goalRevenue == null) {
      setGoalNudgeVisible(true);
    } else {
      openPayModal();
    }
  };

  const addPayment = async () => {
    if (!paySelectedMember && !paySelectedManualMember) {
      Alert.alert("알림", "회원을 선택해주세요.");
      return;
    }
    if (!paySessionsInput) {
      Alert.alert("알림", "수업 수를 입력해주세요.");
      return;
    }
    if (!payAmountInput) {
      Alert.alert("알림", "금액을 입력해주세요.");
      return;
    }
    setAddingPay(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      let memberName = "";

      if (paySelectedManualMember) {
        // 미연동 회원 — PT 추가 엔드포인트 사용
        const res = await fetch(
          `${API_URL}/api/trainer/manual-members/${paySelectedManualMember.id}/pt`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              sessions: parseInt(paySessionsInput),
              amount: parseInt(payAmountInput.replace(/,/g, "")),
              memo: payMemoInput.trim() || undefined,
              paymentDate: payContractDateInput.trim() || undefined,
            }),
          },
        );
        if (!res.ok) throw new Error("결제 추가 실패");
        memberName = paySelectedManualMember.name;
      } else if (paySelectedMember) {
        // 연동 회원 — 기존 pt/add 엔드포인트 사용
        const res = await fetch(
          `${API_URL}/api/trainer/members/${paySelectedMember.id}/pt/add`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              sessions: parseInt(paySessionsInput),
              amount: parseInt(payAmountInput.replace(/,/g, "")),
              memo: payMemoInput.trim() || undefined,
              contractDate: payContractDateInput.trim() || undefined,
              startDate: payContractDateInput.trim() || getTodayStr(),
            }),
          },
        );
        if (!res.ok) throw new Error("결제 추가 실패");
        memberName = paySelectedMember.user.name;
      }

      setPayAddModal(false);
      setPaySelectedMember(null);
      setPaySelectedManualMember(null);
      setPaySessionsInput("");
      setPayAmountInput("");
      setPayMemoInput("");
      fetchHome();
      // Google Sheets 자동 동기화 (백그라운드)
      syncAllData().catch(() => {});
      Alert.alert("완료", `${memberName}님 결제가 추가됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAddingPay(false);
    }
  };

  // 신규 회원 결제 등록 (manual_members 테이블에 저장)
  const addNewMemberPayment = async () => {
    // 전체 무료 제공 중 - 제한 없음
    if (!payNewName.trim()) {
      Alert.alert("알림", "회원 이름을 입력해주세요.");
      return;
    }
    if (!payNewPhone.trim()) {
      Alert.alert(
        "알림",
        "전화번호를 입력해주세요.\n운동 기록 문자(SMS) 발송에 사용됩니다.",
      );
      return;
    }
    if (!paySessionsInput) {
      Alert.alert("알림", "수업 수를 입력해주세요.");
      return;
    }
    if (!payAmountInput) {
      Alert.alert("알림", "금액을 입력해주세요.");
      return;
    }
    setAddingPay(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/manual-members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          name: payNewName.trim(),
          phone: payNewPhone.trim(), // 필수값으로 변경
          ptTotal: parseInt(paySessionsInput),
          amount: parseInt(payAmountInput.replace(/,/g, "")),
          paymentDate: payContractDateInput.trim() || null,
          memo: payMemoInput.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("등록 실패");
      setPayAddModal(false);
      setPayMemberType("existing");
      setPayNewName("");
      setPayNewPhone("");
      setPaySessionsInput("");
      setPayAmountInput("");
      setPayMemoInput("");
      fetchHome();
      Alert.alert("완료", `${payNewName.trim()}님이 신규 회원으로 등록됐어요!`);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAddingPay(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHome();
    }, []),
  );

  const updateChecked = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (updateChecked.current) return;
      updateChecked.current = true;
      (async () => {
        try {
          const CURRENT_VERSION = "1.0.2";
          console.log("[업데이트 체크] 시작 - 현재 버전:", CURRENT_VERSION);
          const res = await fetch("https://itunes.apple.com/lookup?id=6769366090&country=kr");
          const json = await res.json();
          const latest = json.results?.[0]?.version;
          console.log("[업데이트 체크] App Store 최신 버전:", latest);
          if (latest && latest > CURRENT_VERSION) {
            console.log("[업데이트 체크] 업데이트 Alert 표시");
            Alert.alert(
              "업데이트 안내",
              `새 버전(${latest})이 출시됐어요!\n업데이트 후 이용해주세요.`,
              [
                { text: "나중에" },
                { text: "업데이트", onPress: () => Linking.openURL(APP_STORE_URL) },
              ],
            );
          }
        } catch (e) {
          console.log("[업데이트 체크] 오류:", e);
        }
      })();
    }, []),
  );

  const handleCopy = () => {
    const code = data?.trainerCode ?? "";
    Clipboard.setString(code);
    Alert.alert("복사됐어요!", `트레이너 코드 ${code} 가 복사됐어요.`);
  };

  const handleKakaoShare = async () => {
    const code = data?.trainerCode ?? "";
    const trainerName = data?.trainerName ?? "트레이너";
    const installUrl = Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
    const safeText = String(`안녕하세요! ${trainerName} 트레이너입니다.\n\nFitLog 앱에서 아래 코드를 입력하면 바로 연결돼요!\n\n트레이너 코드: ${code}` ?? "");
    const safeUrl = String(installUrl ?? "https://fitlog.app");
    const safeWebUrl = String(APP_STORE_URL ?? "https://fitlog.app");
    console.log("[Kakao] shareTextTemplate 시작");
    try {
      const result = await shareTextTemplate({
        template: {
          text: safeText,
          link: {
            mobileWebUrl: APP_STORE_URL,
            webUrl: APP_STORE_URL,
            androidExecutionParams: `code=${code}`,
            iosExecutionParams: `code=${code}`,
          },
          buttonTitle: "FitLog 앱 설치하기",
        },
      });
      console.log("[Kakao] 성공:", JSON.stringify(result));
    } catch (e: any) {
      console.log("[Kakao] 실패 전체:", JSON.stringify(e));
      console.log("[Kakao] code:", e?.code);
      console.log("[Kakao] message:", e?.message);
      console.log("[Kakao] domain:", e?.domain);
      console.log("[Kakao] userInfo:", JSON.stringify(e?.userInfo));
      Alert.alert(
        "카카오 공유 실패",
        `code: ${e?.code ?? "-"}\ndomain: ${e?.domain ?? "-"}\nmessage: ${e?.message ?? String(e)}\nuserInfo: ${JSON.stringify(e?.userInfo ?? {})}`,
      );
    }
  };

  const markAllRead = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      await fetch(`${API_URL}/api/notifications/read-all`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 32,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchHome(true)}
            tintColor={Colors.green}
          />
        }
      >
        {/* 인사 + 알림 버튼 */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <View>
            <Text
              style={{ fontSize: 14, color: Colors.textMuted, marginBottom: 2 }}
            >
              안녕하세요 👋
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={{ fontSize: 24, fontWeight: "800", color: Colors.text }}
              >
                {data?.trainerName ?? "-"}님
              </Text>
              {/* 무료체험 카운트다운 - App Store 심사 대응으로 비활성화 */}
              {/* {data?.trialEndDate && (() => {
                const days = Math.max(0, Math.ceil((new Date(data.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                return (
                  <View style={{ backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>무료체험 {days}일 남음</Text>
                  </View>
                );
              })()} */}
            </View>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginTop: 6,
            }}
          >
            {/* 회원 초대 버튼 (compact) */}
            <TouchableOpacity
              onPress={handleInvitePress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: Colors.bgSub,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textSub,
                  fontWeight: "700",
                }}
              >
                회원초대
              </Text>
            </TouchableOpacity>
            {/* 알림 버튼 */}
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/trainer/notifications")}
              style={{
                width: 36,
                height: 36,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor:
                  unreadCount > 0 ? Colors.greenLight : Colors.bgSub,
                borderRadius: 18,
                borderWidth: 1,
                borderColor:
                  unreadCount > 0 ? Colors.green + "44" : Colors.border,
              }}
            >
              {/* 종 아이콘 */}
              <View
                style={{
                  width: 16,
                  height: 16,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 10,
                    height: 8,
                    backgroundColor:
                      unreadCount > 0 ? Colors.green : Colors.textMuted,
                    borderRadius: 5,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }}
                />
                <View
                  style={{
                    width: 12,
                    height: 2.5,
                    backgroundColor:
                      unreadCount > 0 ? Colors.green : Colors.textMuted,
                    borderRadius: 1,
                  }}
                />
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    borderWidth: 1.5,
                    borderColor:
                      unreadCount > 0 ? Colors.green : Colors.textMuted,
                    marginTop: 1,
                  }}
                />
              </View>
              {unreadCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: Colors.green,
                  }}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 상단 요약: 총 회원 + 오늘 PT */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.bgSub,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.green }}>
              {data?.totalMembers ?? 0}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
              총 회원
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.bgSub,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.green }}>
              {data?.todayPtList?.filter(item => item.sessionType === "PT" || item.sessionType === "OT").length ?? 0}
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>
              오늘 수업
            </Text>
          </View>
        </View>

        {/* 목표 미설정 시 입력 유도 */}
        {data?.goalSessions == null && data?.goalRevenue == null ? (
          <>
            <TouchableOpacity
              onPress={() => {
                setGoalSessionsInput("");
                setGoalRevenueInput("");
                setGoalModal(true);
              }}
              style={{
                backgroundColor: Colors.greenLight,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: Colors.green + "55",
                borderStyle: "dashed",
                padding: 18,
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: Colors.green,
                  marginBottom: 4,
                }}
              >
                목표를 설정해주세요
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                목표 수업 수와 목표 매출을 입력하면 진행률을 볼 수 있어요
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePayButtonPress}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.border,
                paddingVertical: 12,
                marginBottom: 16,
                backgroundColor: Colors.bgSub,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: Colors.textSub,
                }}
              >
                + 결제 추가
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* 이번 달 수업 수 — 수업 목표가 설정된 경우만 표시 */}
            {data?.goalSessions != null && (
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: Colors.text,
                    }}
                  >
                    이번 달 수업
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setGoalSessionsInput(String(data?.goalSessions ?? ""));
                      setGoalRevenueInput(
                        (data?.goalRevenue ?? 0) > 0
                          ? data!.goalRevenue!.toLocaleString()
                          : "",
                      );
                      setGoalModal(true);
                    }}
                  >
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                      목표 수정
                    </Text>
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 4,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 28,
                      fontWeight: "900",
                      color: Colors.green,
                    }}
                  >
                    {data?.monthSessions ?? 0}
                  </Text>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                    / {data.goalSessions}회
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: Colors.green,
                      marginLeft: "auto",
                    }}
                  >
                    {Math.round(
                      ((data?.monthSessions ?? 0) / data.goalSessions) * 100,
                    )}
                    %
                  </Text>
                </View>
                {(data?.noShowCount ?? 0) > 0 && (
                  <Text style={{ fontSize: 11, color: "#EF4444", marginBottom: 8 }}>
                    노쇼 {data?.noShowCount}회
                  </Text>
                )}
                <ProgressBar
                  pct={Math.round(
                    ((data?.monthSessions ?? 0) / data.goalSessions) * 100,
                  )}
                  color={Colors.green}
                />
              </View>
            )}


            {/* 이번 달 매출 — 월별 네비게이션 포함 */}
            {(() => {
              const isCurrentMonth = revenueMonthOffset === 0;
              const displayRevenue = isCurrentMonth
                ? (data?.monthRevenue ?? 0)
                : (selectedMonthRevenue?.monthRevenue ?? 0);
              const displayDetails: any[] = isCurrentMonth
                ? (data?.monthRevenueDetails ?? [])
                : (selectedMonthRevenue?.monthRevenueDetails ?? []);
              return (
                <View
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  {/* 월 네비게이션 */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          const next = revenueMonthOffset - 1;
                          setRevenueMonthOffset(next);
                          setSelectedMonthRevenue(null);
                          fetchMonthRevenue(next);
                        }}
                        style={{ padding: 4 }}
                      >
                        <Text style={{ fontSize: 18, color: Colors.textSub }}>
                          ‹
                        </Text>
                      </TouchableOpacity>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: Colors.text,
                        }}
                      >
                        {isCurrentMonth
                          ? "이번 달 매출"
                          : `${getMonthLabel(revenueMonthOffset)} 매출`}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const next = revenueMonthOffset + 1;
                          if (next > 0) return;
                          setRevenueMonthOffset(next);
                          if (next === 0) {
                            setSelectedMonthRevenue(null);
                          } else {
                            fetchMonthRevenue(next);
                          }
                        }}
                        disabled={revenueMonthOffset >= 0}
                        style={{
                          padding: 4,
                          opacity: revenueMonthOffset >= 0 ? 0.3 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 18, color: Colors.textSub }}>
                          ›
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {/* PDF 버튼 */}
                      <TouchableOpacity
                        onPress={generatePdf}
                        style={{
                          backgroundColor: "#EEF2FF",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderWidth: 1,
                          borderColor: "#C7D2FE",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#4338CA",
                          }}
                        >
                          📄 PDF
                        </Text>
                      </TouchableOpacity>
                      {/* 목표 수정 & 결제 추가 (이번 달만) */}
                      {isCurrentMonth && (
                        <>
                          {data?.goalSessions == null && (
                            <TouchableOpacity
                              onPress={() => {
                                setGoalSessionsInput("");
                                setGoalRevenueInput(
                                  data?.goalRevenue != null
                                    ? data.goalRevenue.toLocaleString()
                                    : "",
                                );
                                setGoalModal(true);
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: Colors.textMuted,
                                }}
                              >
                                목표 수정
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={handlePayButtonPress}
                            style={{
                              backgroundColor: Colors.green,
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: "#fff",
                              }}
                            >
                              + 결제 추가
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>

                  {loadingRevenue ? (
                    <View style={{ paddingVertical: 20, alignItems: "center" }}>
                      <ActivityIndicator size="small" color={Colors.green} />
                    </View>
                  ) : (
                    <>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "baseline",
                          gap: 4,
                          marginBottom: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 24,
                            fontWeight: "900",
                            color: "#F59E0B",
                          }}
                        >
                          {Number(displayRevenue).toLocaleString()}원
                        </Text>
                        {isCurrentMonth && data?.goalRevenue != null && (
                          <>
                            <Text
                              style={{ fontSize: 14, color: Colors.textMuted }}
                            >
                              / {data.goalRevenue.toLocaleString()}원
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: "#F59E0B",
                                marginLeft: "auto",
                              }}
                            >
                              {Math.round(
                                (displayRevenue / data.goalRevenue) * 100,
                              )}
                              %
                            </Text>
                          </>
                        )}
                      </View>
                      {isCurrentMonth && data?.goalRevenue != null && (
                        <ProgressBar
                          pct={Math.round(
                            (displayRevenue / data.goalRevenue) * 100,
                          )}
                          color="#F59E0B"
                        />
                      )}
                      {displayDetails.length > 0 && (
                        <View
                          style={{
                            marginTop: 12,
                            borderTopWidth: 1,
                            borderTopColor: Colors.border,
                            paddingTop: 10,
                          }}
                        >
                          <ScrollView
                            style={{ maxHeight: 132 }}
                            showsVerticalScrollIndicator={false}
                            nestedScrollEnabled
                          >
                            {displayDetails.map((d, i) => (
                              <View
                                key={i}
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  paddingVertical: 8,
                                  borderBottomWidth:
                                    i < displayDetails.length - 1 ? 1 : 0,
                                  borderBottomColor: Colors.border + "55",
                                  gap: 6,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: Colors.textMuted,
                                    width: 32,
                                  }}
                                >
                                  {d.date}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    color: Colors.textSub,
                                    fontWeight: "600",
                                    flex: 1,
                                  }}
                                >
                                  {d.memberName}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: Colors.textMuted,
                                  }}
                                >
                                  {d.sessions}회{"  "}
                                  {Number(d.amount).toLocaleString()}원
                                </Text>
                                {(d.contractId != null ||
                                  d.manualMemberId != null) &&
                                isCurrentMonth ? (
                                  <>
                                    <TouchableOpacity
                                      onPress={() => {
                                        setMemoPopup({
                                          contractId: d.contractId ?? null,
                                          memo: d.memo ?? "",
                                        });
                                        setMemoEditText(d.memo ?? "");
                                      }}
                                      style={{
                                        backgroundColor: d.memo
                                          ? Colors.bgSub
                                          : "transparent",
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: d.memo
                                          ? Colors.border
                                          : Colors.border + "66",
                                        paddingHorizontal: 7,
                                        paddingVertical: 3,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 10,
                                          color: d.memo
                                            ? Colors.textSub
                                            : Colors.textMuted,
                                          fontWeight: "700",
                                        }}
                                      >
                                        {d.memo ? "메모" : "+ 메모"}
                                      </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() => openEditModal(d)}
                                      style={{
                                        borderRadius: 6,
                                        borderWidth: 1,
                                        borderColor: Colors.border,
                                        paddingHorizontal: 7,
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
                                        수정
                                      </Text>
                                    </TouchableOpacity>
                                    {d.contractId != null && (
                                      <TouchableOpacity
                                        onPress={() => handleDeleteContractWithName(d.contractId!, d.memberName ?? "")}
                                        style={{
                                          borderRadius: 6,
                                          borderWidth: 1,
                                          borderColor: "#ffcccc",
                                          paddingHorizontal: 7,
                                          paddingVertical: 3,
                                          backgroundColor: "#fff5f5",
                                        }}
                                      >
                                        <Text style={{ fontSize: 10, color: "#e53e3e" }}>🗑</Text>
                                      </TouchableOpacity>
                                    )}
                                  </>
                                ) : (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setMemoPopup({
                                        contractId: null,
                                        memo: d.memo ?? "",
                                      });
                                      setMemoEditText(d.memo ?? "");
                                    }}
                                    style={{
                                      backgroundColor: d.memo
                                        ? Colors.bgSub
                                        : "transparent",
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      borderColor: d.memo
                                        ? Colors.border
                                        : Colors.border + "66",
                                      paddingHorizontal: 7,
                                      paddingVertical: 3,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 10,
                                        color: d.memo
                                          ? Colors.textSub
                                          : Colors.textMuted,
                                        fontWeight: "700",
                                      }}
                                    >
                                      {d.memo ? "메모" : "메모 없음"}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            ))}
                          </ScrollView>
                          {displayDetails.length > 3 && (
                            <Text
                              style={{
                                fontSize: 11,
                                color: Colors.textMuted,
                                textAlign: "center",
                                marginTop: 4,
                              }}
                            >
                              스크롤해서 더 보기
                            </Text>
                          )}
                        </View>
                      )}
                      {displayDetails.length === 0 && !isCurrentMonth && (
                        <Text
                          style={{
                            fontSize: 13,
                            color: Colors.textMuted,
                            textAlign: "center",
                            paddingVertical: 16,
                          }}
                        >
                          이 달 결제 내역이 없어요
                        </Text>
                      )}
                    </>
                  )}
                </View>
              );
            })()}

            {/* 수업 목표만 있고 매출 목표가 없을 때 목표 수정 버튼 */}
            {data?.goalRevenue == null && data?.goalSessions != null && (
              <TouchableOpacity
                onPress={() => {
                  setGoalSessionsInput(String(data?.goalSessions ?? ""));
                  setGoalRevenueInput("");
                  setGoalModal(true);
                }}
                style={{
                  alignItems: "center",
                  paddingVertical: 8,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  목표 수정
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* 오늘 수업 일정 */}
        <SectionTitle title="오늘 수업 일정" />
        {data?.todayPtList && data.todayPtList.length > 0 && (
          <Text
            style={{
              fontSize: 11,
              color: Colors.textMuted,
              marginBottom: 8,
              marginTop: -4,
            }}
          >
            회원을 탭하면 PT 일지를 등록할 수 있어요
          </Text>
        )}
        {data?.todayPtList && data.todayPtList.length > 0 ? (
          [...data.todayPtList]
            .sort((a, b) => {
              const now = new Date();
              const [ah, am] = a.time.split(":").map(Number);
              const [bh, bm] = b.time.split(":").map(Number);

              // 시작 시간
              const aStartTime = new Date();
              aStartTime.setHours(ah, am, 0, 0);
              const bStartTime = new Date();
              bStartTime.setHours(bh, bm, 0, 0);

              // 종료 시간: PT 시작 + 1시간
              // 예: 14:00 수업은 15:00이 지나야 지난 일정으로 내려감
              const aEndTime = new Date();
              aEndTime.setHours(ah + 1, am, 0, 0);
              const bEndTime = new Date();
              bEndTime.setHours(bh + 1, bm, 0, 0);

              const aPast = a.completed || a.isNoShow || now > aEndTime;
              const bPast = b.completed || b.isNoShow || now > bEndTime;

              // 지난 일정은 아래로
              if (aPast && !bPast) return 1;
              if (!aPast && bPast) return -1;

              // 같은 그룹 안에서는 시작 시간순
              return aStartTime.getTime() - bStartTime.getTime();
            })
            .map((item) => {
              const isOt = item.sessionType === "OT";
              const isActualNoShow = item.isNoShow; // 명시적 노쇼 처리만

              const avatarColor = isActualNoShow ? "#9CA3AF" : isOt ? "#F97316" : Colors.green;
              const bgColor = isActualNoShow ? "#F3F4F6" : isOt ? "#FFF7ED" : Colors.bgSub;
              const borderColor = isActualNoShow ? "#D1D5DB" : isOt ? "#F9731644" : Colors.border;

              return (
                <TouchableOpacity
                  key={`${item.isManual ? "manual" : "linked"}-${item.memberId}-${item.time}`}
                  onPress={() => {
                    console.log("[홈 일정 클릭]", {
                      name: item.memberName,
                      memberId: item.memberId,
                      isManual: item.isManual,
                      isOt,
                      sessionType: item.sessionType,
                    });
                    if (isOt) {
                      router.push(
                        `/(tabs)/trainer/member-detail?id=${item.memberId}&type=manual&initialTab=1`,
                      );
                    } else if (item.isManual) {
                      router.push(
                        `/(tabs)/trainer/member-detail?id=${item.memberId}&type=manual&initialTab=1`,
                      );
                    } else {
                      router.push(
                        `/(tabs)/trainer/member-detail?id=${item.memberId}&initialTab=1`,
                      );
                    }
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: bgColor,
                    borderRadius: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: borderColor,
                    opacity: item.completed || isActualNoShow ? 0.65 : 1,
                  }}
                >
                  {/* 성 이니셜 아바타 */}
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: avatarColor,
                      justifyContent: "center",
                      alignItems: "center",
                      marginRight: 10,
                    }}
                  >
                    <Text
                      style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}
                    >
                      {item.memberName[0]}
                    </Text>
                  </View>

                  {/* 이름 + 구분 */}
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.text,
                        }}
                      >
                        {item.memberName}
                      </Text>
                      {isOt && (
                        <View
                          style={{
                            backgroundColor: "#F9731622",
                            borderRadius: 4,
                            paddingHorizontal: 5,
                            paddingVertical: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 9,
                              fontWeight: "800",
                              color: "#F97316",
                            }}
                          >
                            {`OT ${item.otSessionCount ?? 1}회차`}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      {isOt ? `체험 수업` : `잔여 ${item.ptRemaining}회`}
                    </Text>
                  </View>

                  {/* 시간 + 상태 */}
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: Colors.textSub,
                      }}
                    >
                      {item.time}
                    </Text>
                    {item.completed ? (
                      // 운동 로그 등록됨 → 완료
                      <View style={{ backgroundColor: Colors.green + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.green }}>완료 ✓</Text>
                      </View>
                    ) : item.isNoShow ? (
                      // 노쇼 — 명시적 노쇼만 취소 가능
                      <TouchableOpacity
                        disabled={!item.isNoShow || !item.scheduleId}
                        onPress={() => {
                          Alert.alert(
                            `${item.memberName}님 ${item.time} 수업`,
                            "수업을 취소하면 PT 잔여 횟수가 복구돼요.",
                            [
                              {
                                text: "수업 취소",
                                style: "destructive",
                                onPress: async () => {
                                  const jwt = await AsyncStorage.getItem("jwt");
                                  await fetch(`${API_URL}/api/schedule/confirm/${item.scheduleId}`, {
                                    method: "DELETE",
                                    headers: { Authorization: `Bearer ${jwt}` },
                                  });
                                  fetchHome();
                                },
                              },
                              { text: "닫기", style: "cancel" },
                            ],
                          );
                        }}
                        style={{ backgroundColor: Colors.textMuted + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "800", color: Colors.textMuted }}>
                          {item.isNoShow ? "노쇼 ›" : "노쇼"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      // 확정 → 탭해서 바텀시트 모달 오픈
                      <TouchableOpacity
                        onPress={() => {
                          if (!item.scheduleId) return;
                          setActionModal({ visible: true, item });
                        }}
                        style={{ backgroundColor: isOt ? "#F9731618" : Colors.blue + "18", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "800", color: isOt ? "#F97316" : Colors.blue }}>확정 ›</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
        ) : (
          <View
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 12,
              padding: 20,
              alignItems: "center",
              borderWidth: 1,
              borderColor: Colors.border,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>
              오늘 예정된 PT가 없어요
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── 메모 수정 팝업 ──────────────────────────────────────────────── */}
      <Modal
        visible={memoPopup !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMemoPopup(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "center",
              alignItems: "center",
              padding: 28,
            }}
            activeOpacity={1}
            onPress={() => setMemoPopup(null)}
          >
            <TouchableOpacity activeOpacity={1} style={{ width: "100%" }}>
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 18,
                  padding: 22,
                  shadowColor: "#000",
                  shadowOpacity: 0.15,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
                {/* 헤더 */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "800",
                      color: Colors.text,
                    }}
                  >
                    결제 메모
                  </Text>
                  <TouchableOpacity
                    onPress={() => setMemoPopup(null)}
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
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* 메모 입력/표시 */}
                <TextInput
                  value={memoEditText}
                  onChangeText={
                    memoPopup?.contractId != null ? setMemoEditText : undefined
                  }
                  editable={memoPopup?.contractId != null}
                  placeholder="메모 없음"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    padding: 14,
                    fontSize: 14,
                    color: Colors.text,
                    minHeight: 90,
                    textAlignVertical: "top",
                    marginBottom: 16,
                  }}
                />
                {memoPopup?.contractId != null ? (
                  /* 연동 회원 — 저장하기 */
                  <TouchableOpacity
                    onPress={async () => {
                      if (!memoPopup) return;
                      setSavingMemo(true);
                      try {
                        const jwt = await AsyncStorage.getItem("jwt");
                        const res = await fetch(
                          `${API_URL}/api/trainer/members/contracts/${memoPopup.contractId}/memo`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${jwt}`,
                            },
                            body: JSON.stringify({
                              memo: memoEditText.trim() || null,
                            }),
                          },
                        );
                        if (!res.ok) throw new Error("저장 실패");
                        setMemoPopup(null);
                        fetchHome();
                      } catch (e: any) {
                        Alert.alert("오류", e.message);
                      } finally {
                        setSavingMemo(false);
                      }
                    }}
                    disabled={savingMemo}
                    style={{
                      backgroundColor: Colors.green,
                      borderRadius: 12,
                      paddingVertical: 13,
                      alignItems: "center",
                      opacity: savingMemo ? 0.6 : 1,
                    }}
                  >
                    <Text
                      style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}
                    >
                      {savingMemo ? "저장 중..." : "저장하기"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  /* 미연동 회원 — 확인 (읽기 전용, 수정은 수정 버튼 이용) */
                  <TouchableOpacity
                    onPress={() => setMemoPopup(null)}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      paddingVertical: 13,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: Colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: Colors.textSub,
                        fontSize: 14,
                        fontWeight: "800",
                      }}
                    >
                      확인
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 위약금 입력 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={penaltyModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPenaltyModal(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 28 }}
            activeOpacity={1}
            onPress={() => setPenaltyModal(null)}
          >
            <TouchableOpacity activeOpacity={1} style={{ width: "100%" }}>
              <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 22, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>환불 및 위약금</Text>
                  <TouchableOpacity
                    onPress={() => setPenaltyModal(null)}
                    style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, justifyContent: "center", alignItems: "center" }}
                  >
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 13, color: Colors.textSub, marginBottom: 12 }}>
                  기존 결제내역이 위약금 내역으로 변경됩니다.{"\n"}위약금으로 받은 금액을 입력하세요.
                </Text>
                <TextInput
                  value={penaltyAmountInput}
                  onChangeText={(v) => setPenaltyAmountInput(v.replace(/[^0-9]/g, ""))}
                  placeholder="위약금 금액 (원)"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  style={{ backgroundColor: Colors.bgSub, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 14, fontSize: 16, color: Colors.text, marginBottom: 16 }}
                />
                <TouchableOpacity
                  onPress={savePenalty}
                  disabled={savingPenalty}
                  style={{ backgroundColor: "#e53e3e", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                    {savingPenalty ? "저장 중..." : "위약금 적용"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 결제 수정 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={editModal}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModal(false)}
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
            onPress={() => setEditModal(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              maxHeight: "90%",
            }}
          >
            <GestureDetector gesture={editDragGesture}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setEditModal(false)}
                style={{ alignItems: "center", paddingBottom: 12 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                  }}
                />
              </TouchableOpacity>
            </GestureDetector>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 28,
                paddingBottom: Math.max(insets.bottom, 28),
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 4,
                }}
              >
                결제 수정
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textMuted,
                  marginBottom: 24,
                }}
              >
                수업 수, 금액, 메모를 수정할 수 있어요
              </Text>

              {/* 수업 수 */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                PT 수업 수 (회)
              </Text>
              <TextInput
                value={editSessionsInput}
                onChangeText={setEditSessionsInput}
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 16,
                  color: Colors.text,
                  marginBottom: 16,
                }}
              />

              {/* 금액 */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                결제 금액 (원)
              </Text>
              <TextInput
                value={editAmountInput}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, "");
                  setEditAmountInput(
                    digits ? Number(digits).toLocaleString() : "",
                  );
                }}
                keyboardType="number-pad"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 16,
                  color: Colors.text,
                  marginBottom: 16,
                }}
              />

              {/* 메모 */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                메모 (선택)
              </Text>
              <TextInput
                value={editMemoInput}
                onChangeText={setEditMemoInput}
                placeholder="메모를 입력해주세요"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 14,
                  color: Colors.text,
                  marginBottom: 24,
                  minHeight: 66,
                  textAlignVertical: "top",
                }}
              />

              <TouchableOpacity
                onPress={saveEdit}
                disabled={savingEdit}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  paddingVertical: 15,
                  alignItems: "center",
                  opacity: savingEdit ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}
                >
                  {savingEdit ? "저장 중..." : "저장하기"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 목표 미설정 넛지 팝업 ──────────────────────────────────────── */}
      <Modal
        visible={goalNudgeVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalNudgeVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            alignItems: "center",
            padding: 32,
          }}
          activeOpacity={1}
          onPress={() => setGoalNudgeVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: 24,
                width: "100%",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
                목표를 설정해보세요
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 20 }}>
                수업·매출 진행률을 한눈에 확인할 수 있어요
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setGoalNudgeVisible(false);
                  setPendingPayAfterGoal(true);
                  setGoalSessionsInput("");
                  setGoalRevenueInput("");
                  setGoalModal(true);
                }}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>목표 설정하기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── 목표 설정 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={goalModal}
        transparent
        animationType="slide"
        onRequestClose={() => setGoalModal(false)}
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
            onPress={() => setGoalModal(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 28,
              paddingBottom: Math.max(insets.bottom, 28),
            }}
          >
            {/* 핸들 바 */}
            <GestureDetector gesture={goalDragGesture}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setGoalModal(false)}
                style={{ alignItems: "center", paddingBottom: 12 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                  }}
                />
              </TouchableOpacity>
            </GestureDetector>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>
                목표 설정
              </Text>
              <View style={{ backgroundColor: Colors.greenLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.green + "44" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.green }}>월 단위</Text>
              </View>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: Colors.textMuted,
                marginBottom: 24,
              }}
            >
              매달 초기화돼요 · 목표 수업 수와 목표 매출을 입력해주세요
            </Text>

            {/* 목표 수업 수 */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: Colors.textSub,
                marginBottom: 8,
              }}
            >
              월 목표 수업 수 (회)
            </Text>
            <TextInput
              value={goalSessionsInput}
              onChangeText={setGoalSessionsInput}
              keyboardType="number-pad"
              placeholder="예: 80"
              placeholderTextColor={Colors.textMuted}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 14,
                fontSize: 16,
                color: Colors.text,
                marginBottom: 16,
              }}
            />

            {/* 목표 매출 */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: Colors.textSub,
                marginBottom: 8,
              }}
            >
              월 목표 매출 (원)
            </Text>
            <TextInput
              value={goalRevenueInput}
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, "");
                setGoalRevenueInput(
                  digits ? Number(digits).toLocaleString() : "",
                );
              }}
              keyboardType="number-pad"
              placeholder="예: 3,000,000"
              placeholderTextColor={Colors.textMuted}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: Colors.border,
                padding: 14,
                fontSize: 16,
                color: Colors.text,
                marginBottom: 24,
              }}
            />

            <TouchableOpacity
              onPress={saveGoals}
              disabled={savingGoal}
              style={{
                backgroundColor: Colors.green,
                borderRadius: 12,
                paddingVertical: 15,
                alignItems: "center",
                opacity: savingGoal ? 0.6 : 1,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}>
                {savingGoal ? "저장 중..." : "저장하기"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── 결제 추가 모달 ──────────────────────────────────────────────── */}
      <Modal
        visible={payAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setPayAddModal(false)}
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
            onPress={() => setPayAddModal(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              maxHeight: "88%",
            }}
          >
            {/* 핸들 바 */}
            <GestureDetector gesture={payAddDragGesture}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setPayAddModal(false)}
                style={{ alignItems: "center", paddingBottom: 12 }}
              >
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                  }}
                />
              </TouchableOpacity>
            </GestureDetector>

            <ScrollView
              ref={payScrollRef}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingBottom: 48,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 16,
                }}
              >
                결제 추가
              </Text>

              {/* 기존 회원 / 신규 회원 탭 */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  padding: 4,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                {(["existing", "new"] as const).map((type) => {
                  const active = payMemberType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => {
                        setPayMemberType(type);
                        if (type === "existing") {
                          setPayNewName("");
                          setPayNewPhone("");
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        borderRadius: 9,
                        alignItems: "center",
                        backgroundColor: active ? "#fff" : "transparent",
                        shadowColor: active ? "#000" : "transparent",
                        shadowOpacity: active ? 0.06 : 0,
                        shadowRadius: active ? 4 : 0,
                        elevation: active ? 2 : 0,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "800",
                          color: active ? Colors.green : Colors.textMuted,
                        }}
                      >
                        {type === "existing" ? "기존 회원" : "신규 회원"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {payMemberType === "existing" ? (
                <>
                  {/* 기존 연동 회원 선택 */}
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: Colors.textSub,
                      marginBottom: 10,
                    }}
                  >
                    회원 선택
                  </Text>
                  {payMembersLoading ? (
                    <View
                      style={{
                        height: 80,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 20,
                      }}
                    >
                      <ActivityIndicator size="small" color={Colors.green} />
                    </View>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      style={{ height: 90, marginBottom: 20 }}
                      contentContainerStyle={{
                        gap: 8,
                        paddingRight: 4,
                        alignItems: "center",
                      }}
                    >
                      {payCombinedMembers.map((m) => {
                        const selected = m.isManual
                          ? paySelectedManualMember?.id === m.id
                          : paySelectedMember?.id === m.id;
                        return (
                          <TouchableOpacity
                            key={`${m.isManual ? "manual" : "linked"}-${m.id}`}
                            onPress={() => {
                              if (m.isManual) {
                                setPaySelectedManualMember(m.originalManual);
                                setPaySelectedMember(null);
                              } else {
                                setPaySelectedMember(m.originalLinked);
                                setPaySelectedManualMember(null);
                              }
                            }}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 8,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: selected
                                ? Colors.green
                                : Colors.border,
                              backgroundColor: selected
                                ? Colors.greenLight
                                : Colors.bgSub,
                              alignItems: "center",
                              minWidth: 68,
                            }}
                          >
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 10,
                                backgroundColor: selected
                                  ? Colors.green
                                  : "#D1D5DB",
                                justifyContent: "center",
                                alignItems: "center",
                                marginBottom: 4,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 15,
                                  fontWeight: "800",
                                  color: "#fff",
                                }}
                              >
                                {m.name[0]}
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: selected ? Colors.green : Colors.text,
                              }}
                            >
                              {m.name}
                            </Text>
                            {m.isDisconnected && (
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: "#9CA3AF",
                                  marginTop: 1,
                                }}
                              >
                                연결해제
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {payCombinedMembers.length === 0 && (
                          <TouchableOpacity
                            onPress={() => {
                              setPayAddModal(false);
                              router.push("/(tabs)/trainer/members");
                            }}
                            style={{
                              backgroundColor: Colors.bgSub,
                              borderRadius: 12,
                              borderWidth: 1.5,
                              borderColor: Colors.border,
                              borderStyle: "dashed",
                              paddingHorizontal: 20,
                              paddingVertical: 14,
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "700",
                                color: Colors.text,
                              }}
                            >
                              등록된 회원이 없어요
                            </Text>
                            <Text
                              style={{
                                fontSize: 12,
                                color: Colors.textMuted,
                                textAlign: "center",
                              }}
                            >
                              회원 관리에서 먼저 추가해주세요
                            </Text>
                            <View
                              style={{
                                marginTop: 6,
                                backgroundColor: Colors.green,
                                borderRadius: 8,
                                paddingHorizontal: 14,
                                paddingVertical: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: "#fff",
                                }}
                              >
                                회원 관리로 이동 →
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}
                    </ScrollView>
                  )}
                </>
              ) : (
                <>
                  {/* 신규 회원 이름 / 전화번호 */}
                  <Text
                    style={{
                      fontSize: 13,
                      color: Colors.textMuted,
                      marginBottom: 16,
                      lineHeight: 18,
                    }}
                  >
                    앱 미가입 신규 회원을 바로 등록하고 결제까지 한 번에
                    처리해요
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
                    value={payNewName}
                    onChangeText={setPayNewName}
                    placeholder="예: 홍길동"
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: 14,
                      fontSize: 15,
                      color: Colors.text,
                      marginBottom: 14,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: Colors.textSub,
                      marginBottom: 8,
                    }}
                  >
                    전화번호 * (문자(SMS) 발송용)
                  </Text>
                  <TextInput
                    value={payNewPhone}
                    onChangeText={(text) => {
                      const digits = text.replace(/[^0-9]/g, "").slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 3) formatted = digits.slice(0, 3) + "-" + digits.slice(3);
                      if (digits.length > 7) formatted = digits.slice(0, 3) + "-" + digits.slice(3, 7) + "-" + digits.slice(7);
                      setPayNewPhone(formatted);
                    }}
                    placeholder="예: 010-1234-5678"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      padding: 14,
                      fontSize: 15,
                      color: Colors.text,
                      marginBottom: 14,
                    }}
                  />
                </>
              )}

              {/* ── 공통: 수업 수, 금액, 메모 ── */}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                PT 수업 수 (회) *
              </Text>
              <TextInput
                value={paySessionsInput}
                onChangeText={setPaySessionsInput}
                keyboardType="number-pad"
                placeholder="예: 20"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 16,
                  color: Colors.text,
                  marginBottom: 16,
                }}
              />

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                결제 금액 (원) *
              </Text>
              <TextInput
                value={payAmountInput}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, "");
                  setPayAmountInput(
                    digits ? Number(digits).toLocaleString() : "",
                  );
                }}
                keyboardType="number-pad"
                placeholder="예: 600,000"
                placeholderTextColor={Colors.textMuted}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 16,
                  color: Colors.text,
                  marginBottom: 16,
                }}
              />

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 4,
                }}
              >
                결제 날짜
              </Text>
              <TextInput
                value={payContractDateInput}
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
                  setPayContractDateInput(formatted);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 15,
                  color: Colors.text,
                  marginBottom: 16,
                }}
              />

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Colors.textSub,
                  marginBottom: 8,
                }}
              >
                메모 (선택)
              </Text>
              <TextInput
                value={payMemoInput}
                onChangeText={setPayMemoInput}
                onFocus={() => setTimeout(() => payScrollRef.current?.scrollToEnd({ animated: true }), 150)}
                placeholder="결제 관련 메모를 입력해주세요"
                placeholderTextColor={Colors.textMuted}
                multiline
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  padding: 14,
                  fontSize: 14,
                  color: Colors.text,
                  marginBottom: 24,
                  minHeight: 66,
                  textAlignVertical: "top",
                }}
              />

              <TouchableOpacity
                onPress={
                  payMemberType === "existing"
                    ? addPayment
                    : addNewMemberPayment
                }
                disabled={addingPay}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  paddingVertical: 15,
                  alignItems: "center",
                  opacity: addingPay ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "800" }}
                >
                  {addingPay ? "추가 중..." : "결제 추가하기"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 수업 처리 모달 */}
      <Modal
        visible={actionModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionModal({ visible: false, item: null })}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setActionModal({ visible: false, item: null })}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 28,
                paddingBottom: Math.max(insets.bottom, 28),
              }}
            >
              {/* 드래그 핸들 */}
              <TouchableOpacity
                onPress={() => setActionModal({ visible: false, item: null })}
                activeOpacity={0.8}
                style={{ alignItems: "center", paddingBottom: 12, marginTop: -8 }}
              >
                <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99 }} />
              </TouchableOpacity>

              {/* 헤더 */}
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
                {actionModal.item?.memberName}님 수업
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 24 }}>
                {actionModal.item?.time} · PT 잔여 {actionModal.item?.ptRemaining ?? 0}회
              </Text>

              {/* 완료 처리 */}
              <TouchableOpacity
                onPress={async () => {
                  const jwt = await AsyncStorage.getItem("jwt");
                  await fetch(`${API_URL}/api/schedule/${actionModal.item?.scheduleId}/complete`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${jwt}` },
                  });
                  setActionModal({ visible: false, item: null });
                  fetchHome();
                }}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>완료 처리</Text>
              </TouchableOpacity>

              {/* 노쇼 처리 */}
              <TouchableOpacity
                onPress={async () => {
                  const jwt = await AsyncStorage.getItem("jwt");
                  await fetch(`${API_URL}/api/schedule/${actionModal.item?.scheduleId}/no-show`, {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${jwt}` },
                  });
                  setActionModal({ visible: false, item: null });
                  fetchHome();
                }}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#FECACA",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#EF4444" }}>노쇼 처리</Text>
              </TouchableOpacity>

              {/* 닫기 */}
              <TouchableOpacity
                onPress={() => setActionModal({ visible: false, item: null })}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: Colors.textMuted }}>닫기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 초대 모달 */}
      <Modal
        visible={inviteVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setInviteVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 28,
                paddingBottom: Math.max(insets.bottom, 28),
              }}
            >
              <GestureDetector gesture={inviteDragGesture}>
                <TouchableOpacity
                  onPress={() => setInviteVisible(false)}
                  activeOpacity={0.8}
                  style={{
                    alignItems: "center",
                    paddingBottom: 12,
                    marginTop: -8,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 4,
                      backgroundColor: Colors.border,
                      borderRadius: 99,
                    }}
                  />
                </TouchableOpacity>
              </GestureDetector>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 6,
                }}
              >
                회원 초대하기 🔗
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: Colors.textMuted,
                  marginBottom: 24,
                }}
              >
                아래 코드를 회원에게 공유하면 자동으로 연결돼요
              </Text>
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  padding: 20,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: 20,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  🔑 내 트레이너 코드
                </Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: Colors.green,
                    letterSpacing: 4,
                  }}
                >
                  {data?.trainerCode ?? "-"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleKakaoShare}
                style={{
                  backgroundColor: "#FEE500",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#3C1E1E" }}
                >
                  카카오톡으로 공유하기
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.text,
                  }}
                >
                  코드 복사하기
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* ── 결제 바텀시트 ──────────────────────────────────────────────────────
          TODO: 실제 결제 연동 시 각 버튼 onPress에 아래 연동 추가
          - 애플 인앱결제: react-native-iap 라이브러리 사용
          - 카카오페이: 카카오페이 SDK 또는 웹뷰 연동
          - 토스페이먼츠: 토스페이먼츠 SDK 연동
          현재는 UI만 구현된 상태 (Alert으로 준비 중 표시)
      ──────────────────────────────────────────────────────────────────────── */}
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
              {/* 핸들 바 */}
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
                무료 플랜은 회원 5명까지 연결할 수 있어요.
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
                      setPaymentVisible(false);
                      Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                      setTimeout(() => fetchHome(), 3000);
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
                      setPaymentVisible(false);
                      Alert.alert("복원 완료", "구독이 복원됐어요.");
                      setTimeout(() => fetchHome(), 2000);
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
    </>
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
    <View
      style={{ backgroundColor: Colors.border, borderRadius: 99, height: 5 }}
    >
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

function AttendanceCard({ todayPtList }: { todayPtList: TodayPt[] }) {
  const now = new Date();
  const total = todayPtList.length;
  const completed = todayPtList.filter((item) => item.completed).length;
  const noShow = todayPtList.filter((item) => item.isNoShow).length;
  const attendancePct = total > 0 ? Math.round((completed / total) * 100) : 0;
  if (total === 0) return null;
  return (
    <View
      style={{
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 20,
        borderLeftWidth: 3,
        borderLeftColor: Colors.green,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <Text
          style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "700" }}
        >
          하루 출석률
        </Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: Colors.green }}>
          {attendancePct}%
        </Text>
      </View>
      <ProgressBar pct={attendancePct} color={Colors.green} />
      <View style={{ flexDirection: "row", gap: 16, marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: Colors.green,
            }}
          />
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            출석 {completed}명
          </Text>
        </View>
        {noShow > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#EF4444",
              }}
            />
            <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "700" }}>
              노쇼 {noShow}명
            </Text>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: Colors.blue,
            }}
          />
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            전체 {total}명
          </Text>
        </View>
      </View>
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
        style={{
          width: 3,
          height: 16,
          backgroundColor: Colors.green,
          borderRadius: 2,
        }}
      />
      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>
        {title}
      </Text>
    </View>
  );
}
