import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { PRIVACY_TEXT, TERMS_TEXT } from "../../../constants/terms";
import { apiGet } from "../../../hooks/useApi";
import { syncAllData, saveSheetConfigToDB, deleteSheetConfigFromDB, restoreSheetConfigFromDB, initializeSpreadsheet } from "../../../hooks/useGoogleSheets";
import { TrainerProfile } from "../../../types";

WebBrowser.maybeCompleteAuthSession();

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 30분 단위 시간 옵션 (05:00 ~ 24:00)
const TIME_OPTIONS: string[] = [];
for (let h = 5; h <= 24; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 24) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}

export default function TrainerMoreScreen() {
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    gymName: "",
    workDays: [] as number[],
    startTime: "09:00",
    endTime: "22:00",
    affiliateCode: "",
    verifiedGymName: "",
  });
  const [affiliateVerifying, setAffiliateVerifying] = useState(false);
  const [isAffiliated, setIsAffiliated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<"FREE" | "PRO">("FREE");
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [trialNoticeVisible, setTrialNoticeVisible] = useState(false);
  const [trialNoticePending, setTrialNoticePending] = useState<(() => void) | null>(null);

  // 구글 시트 연동
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [syncingSheets, setSyncingSheets] = useState(false);
  const googleHandledRef = React.useRef(false); // 알림 중복 방지

  // Google OAuth (expo-auth-session/providers/google — 시스템 브라우저 사용, Google 정책 준수)
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: "419852916314-onsu7560soqob0037r4plm62902rgh1l.apps.googleusercontent.com",
    webClientId: "419852916314-pendk3p11p1eam9acjulj9gclraheejv.apps.googleusercontent.com",
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
    extraParams: {
      access_type: "offline",
      prompt: "consent",
    },
  });

  // 이용약관 / 개인정보처리방침 모달
  const [termsVisible, setTermsVisible] = useState(false);
  const [termsContent, setTermsContent] = useState({ title: "", text: "" });

  // 사용가이드 열기
  const openGuide = () => {
    router.push("/(tabs)/trainer/guide" as any);
  };


  // 문의하기
  const [inquiryVisible, setInquiryVisible] = useState(false);
  const [inquiryTab, setInquiryTab] = useState<"write" | "list">("write");
  const [inquiryTitle, setInquiryTitle] = useState("");
  const [inquiryContent, setInquiryContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inquiries, setInquiries] = useState<any[]>([]);

  const fetchProfile = async () => {
      // 백엔드 plan 기준으로 설정
      try {
        const jwt = await AsyncStorage.getItem("jwt");
        const homeRes = await fetch(`${API_URL}/api/trainer/home`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (homeRes.ok) {
          const homeData = await homeRes.json();
          // trialEndDate가 있으면 무료체험 중 → FREE로 표시
          if (homeData.trialEndDate) {
            setTrialEndDate(homeData.trialEndDate);
            setPlan("FREE");
          } else {
            setPlan((homeData.plan ?? "FREE").toUpperCase() === "PRO" ? "PRO" : "FREE");
          }
        }
      } catch {}

      try {
        const data = await apiGet<TrainerProfile>(ENDPOINTS.profile.trainer);
        setProfile(data);
        setIsAffiliated(data.gymAffiliated ?? false);
        const workDayIndices = (data.workDays || "")
          .split(",")
          .map((d) => DAYS.indexOf(d.trim()))
          .filter((i) => i >= 0);
        setEditForm({
          gymName: data.gymName,
          workDays: workDayIndices,
          startTime: data.startTime,
          endTime: data.endTime,
          affiliateCode: "",
          verifiedGymName: data.affiliatedGymName ?? "",
        });
      } catch {
        setProfile({
          id: 1,
          name: "트레이너",
          gymName: "",
          workDays: "월,화,수,목,금",
          startTime: "09:00",
          endTime: "22:00",
          trainerCode: "---",
        });
        setEditForm({
          gymName: "",
          workDays: [0, 1, 2, 3, 4],
          startTime: "09:00",
          endTime: "22:00",
          affiliateCode: "",
          verifiedGymName: "",
        });
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchProfile();
    checkSheetsConnection();
  }, []);

  // Google OAuth 응답 처리
  useEffect(() => {
    if (!googleResponse) return;
    if (googleHandledRef.current) return; // 중복 처리 방지
    googleHandledRef.current = true;

    if (googleResponse.type === "success") {
      const { authentication } = googleResponse;
      if (authentication?.accessToken) {
        handleGoogleAuthSuccess(authentication.accessToken, authentication.refreshToken ?? null);
      } else {
        Alert.alert("연동 실패", "Google 인증에 실패했어요. 다시 시도해주세요.");
      }
    } else if (googleResponse.type === "error") {
      Alert.alert("연동 실패", googleResponse.error?.message ?? "Google 인증 오류");
    }
    // dismissed / cancel은 알림 없이 조용히 무시
  }, [googleResponse]);

  const handleGoogleAuthSuccess = async (accessToken: string, refreshToken: string | null) => {
    try {
      await AsyncStorage.setItem("google_sheets_token", accessToken);
      await AsyncStorage.setItem("google_sheets_token_expiry", String(Date.now() + 3500 * 1000));
      if (refreshToken) {
        await AsyncStorage.setItem("google_sheets_refresh_token", refreshToken);
      }

      // 연동 즉시 스프레드시트 생성 (FitLog_000트레이너)
      const trainerName = profile?.name ?? "트레이너";
      const sheetId = await initializeSpreadsheet(trainerName);
      if (sheetId) setSpreadsheetId(sheetId);

      setSheetsConnected(true);
      Alert.alert(
        "연동 완료",
        `Google Sheets가 연동됐어요.\nFitLog_${trainerName}트레이너 시트가 생성됐어요.\n\n기존 데이터를 동기화하려면 '기존 데이터 동기화'를 눌러주세요.`
      );
    } catch {
      Alert.alert("오류", "토큰 저장 중 오류가 발생했어요.");
    }
  };

  const checkSheetsConnection = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      if (!jwt) { setSheetsConnected(false); setSpreadsheetId(null); return; }

      // 항상 서버 DB 상태를 우선 확인
      const res = await fetch(`${API_URL}/api/trainer/sheets-config`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected && data.token && data.spreadsheetId) {
          // DB에 연동 정보 있음 → AsyncStorage 동기화
          await AsyncStorage.setItem("google_sheets_token", data.token);
          await AsyncStorage.setItem("google_sheets_spreadsheet_id", data.spreadsheetId);
          setSheetsConnected(true);
          setSpreadsheetId(data.spreadsheetId);
        } else {
          // DB에 연동 정보 없음 → 로컬 캐시도 정리
          await AsyncStorage.multiRemove([
            "google_sheets_token",
            "google_sheets_token_expiry",
            "google_sheets_refresh_token",
            "google_sheets_spreadsheet_id",
          ]);
          setSheetsConnected(false);
          setSpreadsheetId(null);
        }
      } else {
        // 서버 오류 시 로컬 AsyncStorage 폴백
        const token = await AsyncStorage.getItem("google_sheets_token");
        const id = await AsyncStorage.getItem("google_sheets_spreadsheet_id");
        setSheetsConnected(!!token);
        setSpreadsheetId(id);
      }
    } catch {
      // 네트워크 오류 시 로컬 AsyncStorage 폴백
      const token = await AsyncStorage.getItem("google_sheets_token");
      const id = await AsyncStorage.getItem("google_sheets_spreadsheet_id");
      setSheetsConnected(!!token);
      setSpreadsheetId(id);
    }
  };

  const connectGoogleSheets = async () => {
    googleHandledRef.current = false; // 새 연동 시도마다 리셋
    await googlePromptAsync();
  };

  const disconnectGoogleSheets = () => {
    Alert.alert("연동 해제", "Google Sheets 연동을 해제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "해제",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "google_sheets_token",
            "google_sheets_token_expiry",
            "google_sheets_refresh_token",
            "google_sheets_spreadsheet_id",
          ]);
          // DB에서도 삭제
          await deleteSheetConfigFromDB();
          setSheetsConnected(false);
          setSpreadsheetId(null);
        },
      },
    ]);
  };

  const openSpreadsheet = async () => {
    const id = await AsyncStorage.getItem("google_sheets_spreadsheet_id");
    if (id) {
      Linking.openURL(`https://docs.google.com/spreadsheets/d/${id}`);
    } else {
      Alert.alert("시트 없음", "아직 동기화된 데이터가 없어요.\n기존 데이터 동기화를 먼저 실행해주세요.");
    }
  };

  const handleSyncAllData = async () => {
    if (syncingSheets) return;
    setSyncingSheets(true);
    try {
      const trainerName = profile?.name ?? "트레이너";
      const result = await syncAllData(trainerName);
      const id = await AsyncStorage.getItem("google_sheets_spreadsheet_id");
      setSpreadsheetId(id);

      Alert.alert(result.success ? "동기화 완료" : "동기화 실패", result.message);
    } catch {
      Alert.alert("오류", "동기화 중 오류가 발생했어요.");
    } finally {
      setSyncingSheets(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);

    try {
      const jwt = await AsyncStorage.getItem("jwt");

      const res = await fetch(`${API_URL}${ENDPOINTS.profile.trainer}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          gymName: editForm.gymName,
          workDays: editForm.workDays.map((i) => DAYS[i]).join(","),
          startTime: editForm.startTime,
          endTime: editForm.endTime,
          // 새로 확인된 코드가 있으면 전송, 없으면 null (기존 유지)
          affiliateCode: editForm.verifiedGymName && editForm.affiliateCode
            ? editForm.affiliateCode.trim().toUpperCase()
            : null,
        }),
      });

      if (!res.ok) throw new Error("프로필 수정 실패");

      const newAffiliated = !!(editForm.verifiedGymName && editForm.affiliateCode);
      setIsAffiliated(newAffiliated || isAffiliated);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              gymName: editForm.gymName,
              workDays: editForm.workDays.map((i) => DAYS[i]).join(","),
              startTime: editForm.startTime,
              endTime: editForm.endTime,
              gymAffiliated: newAffiliated || isAffiliated,
              affiliatedGymName: editForm.verifiedGymName || prev.affiliatedGymName,
            }
          : prev,
      );

      setShowEditModal(false);
      Alert.alert("완료", "프로필이 수정됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSaving(false);
    }
  };

  const fetchInquiries = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/inquiry`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) setInquiries(await res.json());
    } catch {}
  };

  const submitInquiry = async () => {
    if (!inquiryTitle.trim()) {
      Alert.alert("오류", "제목을 입력해주세요.");
      return;
    }
    if (!inquiryContent.trim()) {
      Alert.alert("오류", "내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/inquiry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          title: inquiryTitle.trim(),
          content: inquiryContent.trim(),
        }),
      });
      if (!res.ok) throw new Error("문의 등록 실패");
      setInquiryTitle("");
      setInquiryContent("");
      await fetchInquiries();
      setInquiryTab("list");
      Alert.alert(
        "접수 완료 ✓",
        "문의가 접수됐어요.\n순서대로 답변해드릴게요!",
      );
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["jwt", "pendingName"]);
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const copyCode = () => {
    Clipboard.setString(profile?.trainerCode ?? "");
    Alert.alert("복사 완료", `트레이너 코드 ${profile?.trainerCode}가 복사됐어요.`);
  };

  return (
    <>
      {/* 이용약관 / 개인정보처리방침 모달 */}
      <Modal
        visible={termsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTermsVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85%",
              paddingBottom: 32,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 18,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "800", color: Colors.text }}
              >
                {termsContent.title}
              </Text>
              <TouchableOpacity onPress={() => setTermsVisible(false)}>
                <Text style={{ fontSize: 22, color: Colors.textMuted }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text
                style={{ fontSize: 14, color: Colors.text, lineHeight: 22 }}
              >
                {termsContent.text}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{
          padding: 16,
          paddingTop: 52,
          paddingBottom: 36,
        }}
      >
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color: Colors.text,
            marginBottom: 16,
          }}
        >
          더보기
        </Text>

        {/* 프로필 + 코드 통합 카드 */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 20,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {/* 상단: 아바타 + 이름/헬스장 + 수정 */}
          <View style={{ flexDirection: "row", alignItems: "center", padding: 18, gap: 14 }}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 17,
                backgroundColor: Colors.green,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 22, fontWeight: "900", color: "#fff" }}>
                {profile?.name?.[0] ?? "T"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.text }}>
                  {profile?.name ?? "-"}
                </Text>
                {trialEndDate ? (() => {
                  const d = Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  return (
                    <View style={{ backgroundColor: d > 0 ? "#FFF0E6" : "#FEF9C3", borderWidth: 1, borderColor: d > 0 ? "#F97316" : "#FDE047", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: d > 0 ? "#EA6C00" : "#CA8A04" }}>{d > 0 ? `무료체험 ${d}일` : "FREE"}</Text>
                    </View>
                  );
                })() : plan === "PRO" ? (
                  <View style={{ backgroundColor: Colors.green, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: "900", color: "#fff" }}>PRO</Text>
                  </View>
                ) : (
                  <View style={{ backgroundColor: "#FEF9C3", borderWidth: 1, borderColor: "#FDE047", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#CA8A04" }}>FREE</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>{profile?.gymName ?? "-"}</Text>
                {isAffiliated && (
                  <View style={{ backgroundColor: Colors.green + "20", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.green }}>제휴</Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowEditModal(true)}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub }}>수정</Text>
            </TouchableOpacity>
          </View>

          {/* 요일 + 시간 */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 14, gap: 6, flexWrap: "wrap" }}>
            {(profile?.workDays || "").split(",").map((d) => (
              <View
                key={d}
                style={{
                  backgroundColor: Colors.greenLight,
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>{d.trim()}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginLeft: 2 }}>
              {profile?.startTime} ~ {profile?.endTime}
            </Text>
          </View>

          {/* 구분선 */}
          <View style={{ height: 1, backgroundColor: Colors.border }} />

          {/* 트레이너 코드 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 }}>
            <View>
              <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600", marginBottom: 4, letterSpacing: 0.3 }}>
                내 트레이너 코드
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: Colors.text, letterSpacing: 4 }}>
                {profile?.trainerCode ?? "---"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={copyCode}
              style={{
                backgroundColor: Colors.green,
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>복사</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 플랜 */}
        <FlatSectionHeader title="플랜" />
        {(() => {
          const daysLeft = trialEndDate
            ? Math.max(0, Math.ceil((new Date(trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
            : null;
          return plan === "PRO" && !trialEndDate ? (
            <View style={{
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: Colors.green + "66",
              backgroundColor: Colors.greenLight,
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.green }}>PRO 플랜</Text>
                <View style={{ backgroundColor: Colors.green, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ fontSize: 10, fontWeight: "900", color: "#fff" }}>구독 중</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() =>
                  Platform.OS === "android"
                    ? Linking.openURL("https://play.google.com/store/account/subscriptions")
                    : Linking.openURL("https://apps.apple.com/account/subscriptions")
                }
                style={{
                  borderWidth: 1,
                  borderColor: "#ef4444" + "88",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#ef4444" }}>구독 취소</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: "#FDE047",
              backgroundColor: "#FEF9C3",
              paddingHorizontal: 16,
              paddingVertical: 14,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: Colors.text }}>무료 플랜</Text>
                {daysLeft !== null && daysLeft > 0 && (
                  <View style={{ backgroundColor: "#FFF0E6", borderWidth: 1, borderColor: "#F97316", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: "#EA6C00" }}>무료체험 {daysLeft}일 남음</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setPaymentVisible(true)}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#fff" }}>업그레이드</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* 연동 */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 20, marginBottom: 4, paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.textMuted }}>연동</Text>
          <TouchableOpacity
            onPress={() => Alert.alert(
              "Google Sheets 연동 안내",
              "연동 시 Google 인증 화면에서\n① '고급'을 누르세요\n② 'FitLog(으)로 이동'을 눌러 실행하세요\n\nGoogle 앱 검증 진행 중으로 일시적으로 표시되는 안내입니다.\n\n연동 후 '기존 데이터 동기화'를 눌러 지금까지의 데이터를 업로드하세요."
            )}
            style={{ width: 15, height: 15, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.textMuted, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: Colors.textMuted, lineHeight: 13 }}>?</Text>
          </TouchableOpacity>
        </View>
        <View style={{ backgroundColor: "#fff", marginBottom: 8 }}>
          <FlatRow
            label="Google Sheets"
            sublabel={sheetsConnected ? "매출/운동일지 자동 업로드 중" : "연동하면 데이터를 자동으로 시트에 저장해요"}
            right={
              sheetsConnected ? (
                <TouchableOpacity
                  onPress={disconnectGoogleSheets}
                  style={{ borderWidth: 1, borderColor: Colors.red + "88", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.red }}>연동 해제</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={connectGoogleSheets}
                  style={{ backgroundColor: Colors.green, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>연동하기</Text>
                </TouchableOpacity>
              )
            }
          />
          {sheetsConnected && (
            <>
              <FlatRow label="FitLog 데이터 시트 열기" onPress={openSpreadsheet} showArrow />
              <FlatRow
                label={syncingSheets ? "동기화 중..." : "기존 데이터 동기화"}
                onPress={handleSyncAllData}
                showArrow
                right={
                  <TouchableOpacity
                    onPress={() => Alert.alert(
                      "기존 데이터 동기화",
                      "처음 연동했다면 이 버튼을 눌러 지금까지의 데이터를 시트에 업로드하세요.\n\n이후 신규 데이터는 자동으로 업로드됩니다."
                    )}
                    style={{ width: 18, height: 18, borderRadius: 3, borderWidth: 1.5, borderColor: Colors.textMuted, alignItems: "center", justifyContent: "center", marginRight: 4 }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.textMuted, lineHeight: 14 }}>?</Text>
                  </TouchableOpacity>
                }
              />
            </>
          )}
        </View>

        {/* 앱 정보 */}
        <FlatSectionHeader title="앱 정보" />
        <View style={{ backgroundColor: "#fff", marginBottom: 8 }}>
          <FlatRow label="버전" right={<Text style={{ fontSize: 13, color: Colors.textMuted }}>1.0.5</Text>} />
          <FlatRow label="사용가이드" onPress={openGuide} showArrow />
          <FlatRow label="이용약관" onPress={() => Linking.openURL("https://dlatoquf.github.io/FitLogApp/docs/terms.html")} showArrow />
          <FlatRow label="개인정보처리방침" onPress={() => Linking.openURL("https://dlatoquf.github.io/FitLogApp/docs/privacy.html")} showArrow />
          <FlatRow
            label="문의하기"
            onPress={() => { setInquiryTab("write"); setInquiryVisible(true); fetchInquiries(); }}
            showArrow
            last
          />
        </View>

        {/* 로그아웃 */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ paddingVertical: 16, borderTopWidth: 1, borderColor: Colors.border, marginTop: 8 }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.red, textAlign: "center" }}>
            로그아웃
          </Text>
        </TouchableOpacity>

        {/* 계정 삭제 */}
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "계정 삭제",
              "정말 계정을 삭제할까요?\n삭제 후 복구는 불가능해요.",
              [
                { text: "취소", style: "cancel" },
                {
                  text: "삭제",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const jwt = await AsyncStorage.getItem("jwt");
                      const res = await fetch(`${API_URL}/api/trainer/me`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${jwt}` },
                      });
                      if (!res.ok) throw new Error("계정 삭제 실패");
                      await AsyncStorage.multiRemove(["jwt", "pendingName"]);
                      router.replace("/auth/login");
                    } catch (e: any) {
                      Alert.alert(
                        "오류",
                        e.message ?? "계정 삭제 중 오류가 발생했어요.",
                      );
                    }
                  },
                },
              ],
            );
          }}
          style={{ alignItems: "center", marginTop: 12, paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 12, color: Colors.textMuted }}>
            계정삭제
          </Text>
        </TouchableOpacity>

        {/* 프로필 수정 모달 */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <KeyboardAvoidingView
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setShowEditModal(false)}
            />
            <GestureDetector
              gesture={Gesture.Pan().onEnd((e) => {
                if (e.translationY > 60) setShowEditModal(false);
              })}
            >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
                maxHeight: "80%",
              }}
            >
              <ScrollView keyboardShouldPersistTaps="handled">
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
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                >
                  프로필 수정
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  헬스장명
                </Text>
                <TextInput
                  value={editForm.gymName}
                  onChangeText={(v) =>
                    setEditForm((f) => ({ ...f, gymName: v }))
                  }
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 14,
                  }}
                />

                {/* 제휴 코드 */}
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 6 }}>
                  제휴 코드 {profile?.gymAffiliated ? "(변경 시 입력)" : "(선택)"}
                </Text>
                {profile?.gymAffiliated && !editForm.verifiedGymName && (
                  <View style={{ backgroundColor: Colors.greenLight, borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.green + "44" }}>
                    <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "600" }}>
                      현재 제휴: {profile.affiliatedGymName}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: editForm.verifiedGymName ? 6 : 14 }}>
                  <TextInput
                    value={editForm.affiliateCode}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, affiliateCode: v, verifiedGymName: "" }))}
                    placeholder={profile?.gymAffiliated ? "새 코드 입력" : "제휴 코드 입력"}
                    autoCapitalize="characters"
                    style={{
                      flex: 1,
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: editForm.verifiedGymName ? Colors.green : Colors.border,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                      color: Colors.text,
                    }}
                  />
                  <TouchableOpacity
                    onPress={async () => {
                      if (!editForm.affiliateCode.trim()) return;
                      setAffiliateVerifying(true);
                      try {
                        const jwt = await AsyncStorage.getItem("jwt");
                        const res = await fetch(`${API_URL}/api/gym/verify?code=${encodeURIComponent(editForm.affiliateCode.trim().toUpperCase())}`, {
                          headers: { Authorization: `Bearer ${jwt}` },
                        });
                        const data = await res.json();
                        if (data.valid) {
                          setEditForm((f) => ({ ...f, verifiedGymName: data.gymName }));
                        } else {
                          Alert.alert("확인 실패", data.message ?? "유효하지 않은 제휴 코드예요.");
                          setEditForm((f) => ({ ...f, verifiedGymName: "" }));
                        }
                      } catch {
                        Alert.alert("오류", "제휴 코드 확인 중 오류가 발생했어요.");
                      } finally {
                        setAffiliateVerifying(false);
                      }
                    }}
                    disabled={!editForm.affiliateCode.trim() || affiliateVerifying}
                    style={{
                      backgroundColor: editForm.verifiedGymName ? Colors.green : Colors.bgSub,
                      borderWidth: 1,
                      borderColor: editForm.verifiedGymName ? Colors.green : Colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: editForm.verifiedGymName ? "#fff" : Colors.textMuted }}>
                      {affiliateVerifying ? "..." : editForm.verifiedGymName ? "✓" : "확인"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {editForm.verifiedGymName ? (
                  <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "600", marginBottom: 14 }}>
                    제휴 헬스장: {editForm.verifiedGymName}
                  </Text>
                ) : null}

                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  근무 요일
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}
                >
                  {DAYS.map((d, i) => (
                    <TouchableOpacity
                      key={d}
                      onPress={() =>
                        setEditForm((f) => ({
                          ...f,
                          workDays: f.workDays.includes(i)
                            ? f.workDays.filter((x) => x !== i)
                            : [...f.workDays, i],
                        }))
                      }
                      style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 8,
                        backgroundColor: editForm.workDays.includes(i)
                          ? Colors.green
                          : Colors.bgSub,
                        borderWidth: 1,
                        borderColor: editForm.workDays.includes(i)
                          ? Colors.green
                          : Colors.border,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: editForm.workDays.includes(i)
                            ? "#fff"
                            : Colors.textMuted,
                        }}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}
                >
                  {(["startTime", "endTime"] as const).map((key) => (
                    <View key={key} style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: Colors.textMuted,
                          marginBottom: 6,
                        }}
                      >
                        {key === "startTime" ? "출근" : "퇴근"}
                      </Text>
                      <ScrollView
                        style={{
                          height: 120,
                          backgroundColor: Colors.bgSub,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          borderRadius: 10,
                        }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {TIME_OPTIONS.map((t) => (
                          <TouchableOpacity
                            key={t}
                            onPress={() =>
                              setEditForm((f) => ({ ...f, [key]: t }))
                            }
                            style={{
                              padding: 10,
                              backgroundColor:
                                editForm[key] === t
                                  ? Colors.green
                                  : "transparent",
                              borderRadius: 8,
                              marginHorizontal: 4,
                              marginVertical: 2,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: editForm[key] === t ? "700" : "400",
                                color:
                                  editForm[key] === t ? "#fff" : Colors.text,
                              }}
                            >
                              {t}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setShowEditModal(false)}
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ fontSize: 14, color: Colors.textSub }}>
                      취소
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSaveProfile}
                    disabled={saving}
                    style={{
                      flex: 2,
                      backgroundColor: Colors.green,
                      borderRadius: 12,
                      padding: 14,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                    >
                      {saving ? "저장 중..." : "저장"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
            </GestureDetector>
          </KeyboardAvoidingView>
        </Modal>

        {/* 무료체험 구독 안내 팝업 */}
        <Modal visible={trialNoticeVisible} transparent animationType="fade" onRequestClose={() => setTrialNoticeVisible(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 28, width: "100%" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.text, marginBottom: 8, textAlign: "center" }}>
                지금 구독하기
              </Text>
              {trialEndDate && (() => {
                const trialEnd = new Date(trialEndDate);
                const billingStart = new Date(trialEnd);
                billingStart.setDate(billingStart.getDate() + 1);
                const fmt = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
                return (
                  <View style={{ backgroundColor: Colors.greenLight, borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <Text style={{ fontSize: 13, color: Colors.textSub, lineHeight: 22, textAlign: "center" }}>
                      <Text style={{ fontWeight: "800", color: Colors.green }}>{fmt(trialEnd)}</Text>
                      {"까지 무료체험이 제공됩니다.\n이후 "}
                      <Text style={{ fontWeight: "800", color: Colors.green }}>{fmt(billingStart)}</Text>
                      {"부터 구독이 자동 시작되며\n언제든 해지할 수 있어요."}
                    </Text>
                  </View>
                );
              })()}
              <TouchableOpacity
                onPress={() => {
                  setTrialNoticeVisible(false);
                  if (trialNoticePending) trialNoticePending();
                }}
                style={{ backgroundColor: Colors.green, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 10 }}
              >
                <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>구독 시작하기</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTrialNoticeVisible(false)} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>취소</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* 업그레이드 바텀시트 */}
        <Modal
          visible={paymentVisible}
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
                {isAffiliated && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: Colors.textMuted,
                      marginBottom: 20,
                      lineHeight: 20,
                    }}
                  >
                    제휴 헬스장 회원 특별가가 적용됐어요.
                  </Text>
                )}

                {/* PRO 단일 카드 */}
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
                        {isAffiliated ? "11,900" : "14,900"}
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
                      const doPurchase = async () => {
                        try {
                          if (
                            !Purchases ||
                            typeof Purchases.getOfferings !== "function"
                          ) {
                            Alert.alert("오류", "결제 모듈을 불러오지 못했어요.");
                            return;
                          }
                          const offerings = await Purchases.getOfferings();
                          const pkg = isAffiliated
                            ? offerings.current?.availablePackages.find(
                                (p: any) => p.identifier === "pro_monthly_affiliate",
                              ) ?? offerings.current?.monthly
                            : offerings.current?.monthly ??
                              offerings.current?.availablePackages[0];
                          if (!pkg) {
                            Alert.alert("오류", "구독 상품을 불러오지 못했어요.");
                            return;
                          }
                          await Purchases.purchasePackage(pkg);
                          setPlan("PRO");
                          setPaymentVisible(false);
                          Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                          setTimeout(() => fetchProfile(), 3000);
                        } catch (e: any) {
                          if (!e.userCancelled)
                            Alert.alert(
                              "결제 실패",
                              e.message ?? "다시 시도해주세요.",
                            );
                        }
                      };

                      if (trialEndDate) {
                        setTrialNoticePending(() => doPurchase);
                        setTrialNoticeVisible(true);
                      } else {
                        doPurchase();
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
                        setTimeout(() => fetchProfile(), 2000);
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
                  style={{ marginTop: 16 }}
                  onPress={() =>
                    Platform.OS === "android"
                      ? Linking.openURL("https://play.google.com/store/account/subscriptions")
                      : Linking.openURL("https://apps.apple.com/account/subscriptions")
                  }
                >
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      color: "#ef4444",
                      marginBottom: 4,
                    }}
                  >
                    구독 취소하기
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      color: Colors.textMuted,
                      lineHeight: 16,
                    }}
                  >
                    취소 후에도 현재 구독 기간이 끝날 때까지 PRO를 사용할 수 있어요.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{ marginTop: 16 }}
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
        {/* ── 문의하기 모달 ───────────────────────────────────────────────────── */}
        <Modal
          visible={inquiryVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setInquiryVisible(false);
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              activeOpacity={1}
              onPress={() => setInquiryVisible(false)}
            />
            <GestureDetector
              gesture={Gesture.Pan().onEnd((e) => {
                if (e.translationY > 60) setInquiryVisible(false);
              })}
            >
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                paddingBottom: 40,
                maxHeight: "90%",
              }}
            >
              <View style={{ alignItems: "center", paddingBottom: 8 }}>
                <View
                  style={{
                    width: 40,
                    height: 4,
                    backgroundColor: Colors.border,
                    borderRadius: 99,
                  }}
                />
              </View>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 16,
                }}
              >
                문의하기
              </Text>

              {/* 탭 */}
              <View
                style={{
                  flexDirection: "row",
                  backgroundColor: Colors.bgSub,
                  borderRadius: 10,
                  padding: 3,
                  marginBottom: 20,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                {(
                  [
                    { key: "write", label: "문의 작성" },
                    { key: "list", label: "내 문의" },
                  ] as const
                ).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => {
                      setInquiryTab(tab.key);
                      if (tab.key === "list") fetchInquiries();
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor:
                        inquiryTab === tab.key ? "#fff" : "transparent",
                      alignItems: "center",
                      elevation: inquiryTab === tab.key ? 2 : 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color:
                          inquiryTab === tab.key
                            ? Colors.text
                            : Colors.textMuted,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {inquiryTab === "write" ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    제목
                  </Text>
                  <TextInput
                    value={inquiryTitle}
                    onChangeText={setInquiryTitle}
                    placeholder="문의 제목을 입력해주세요"
                    placeholderTextColor={Colors.textMuted}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: Colors.text,
                      marginBottom: 14,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    내용
                  </Text>
                  <TextInput
                    value={inquiryContent}
                    onChangeText={setInquiryContent}
                    placeholder="문의 내용을 자세히 입력해주세요"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: Colors.text,
                      minHeight: 140,
                      marginBottom: 20,
                    }}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setInquiryVisible(false)}
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 12,
                        padding: 14,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 14, color: Colors.textSub }}>
                        취소
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={submitInquiry}
                      disabled={submitting}
                      style={{
                        flex: 2,
                        backgroundColor: Colors.green,
                        borderRadius: 12,
                        padding: 14,
                        alignItems: "center",
                        opacity: submitting ? 0.6 : 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#fff",
                        }}
                      >
                        {submitting ? "접수 중..." : "문의 접수"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {inquiries.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 40 }}>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                        아직 문의 내역이 없어요
                      </Text>
                    </View>
                  ) : (
                    inquiries.map((inq) => (
                      <View
                        key={inq.id}
                        style={{
                          backgroundColor: Colors.bgSub,
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: Colors.border,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 14,
                              fontWeight: "800",
                              color: Colors.text,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {inq.title}
                          </Text>
                          <View
                            style={{
                              backgroundColor:
                                inq.status === "ANSWERED"
                                  ? Colors.green
                                  : "#F59E0B",
                              borderRadius: 6,
                              paddingHorizontal: 7,
                              paddingVertical: 2,
                              marginLeft: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "700",
                                color: "#fff",
                              }}
                            >
                              {inq.status === "ANSWERED"
                                ? "답변완료"
                                : "검토중"}
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
                          {inq.createdAt}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: Colors.textSub,
                            lineHeight: 20,
                          }}
                          numberOfLines={3}
                        >
                          {inq.content}
                        </Text>
                        {inq.status === "ANSWERED" && inq.answer && (
                          <View
                            style={{
                              marginTop: 10,
                              backgroundColor: Colors.greenLight,
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: "700",
                                color: Colors.green,
                                marginBottom: 4,
                              }}
                            >
                              답변
                            </Text>
                            <Text
                              style={{
                                fontSize: 13,
                                color: Colors.text,
                                lineHeight: 19,
                              }}
                            >
                              {inq.answer}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                  <TouchableOpacity
                    onPress={() => setInquiryVisible(false)}
                    style={{ marginTop: 8, alignItems: "center", padding: 14 }}
                  >
                    <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                      닫기
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
            </GestureDetector>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "800",
        color: Colors.textSub,
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {title}
    </Text>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>
      {value ? (
        <Text style={{ fontSize: 13, color: Colors.textMuted }}>{value}</Text>
      ) : (
        <Text style={{ fontSize: 16, color: Colors.textMuted }}>›</Text>
      )}
    </View>
  );
}

function FlatSectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "700",
        color: Colors.textMuted,
        marginTop: 20,
        marginBottom: 4,
        paddingHorizontal: 4,
      }}
    >
      {title}
    </Text>
  );
}

function FlatRow({
  label,
  sublabel,
  right,
  onPress,
  showArrow,
  last,
}: {
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  showArrow?: boolean;
  last?: boolean;
}) {
  const inner = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: Colors.border,
      }}
    >
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 14, color: Colors.text }}>{label}</Text>
        {sublabel ? (
          <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>
      {right ?? (showArrow ? <Text style={{ fontSize: 18, color: Colors.textMuted }}>›</Text> : null)}
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  }
  return inner;
}
