import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { ENDPOINTS } from "../../../constants/api";
import { apiGet, apiPost } from "../../../hooks/useApi";
import { syncAllData } from "../../../hooks/useGoogleSheets";
import { Member, PaymentHistory, PtPackage } from "../../../types";

export default function TrainerPaymentScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [packages, setPackages] = useState<PtPackage[]>([]);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [tab, setTab] = useState<"register" | "history">("register");

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [membersData, packagesData, historyData] = await Promise.all([
        apiGet<Member[]>(ENDPOINTS.trainer.members),
        apiGet<PtPackage[]>(ENDPOINTS.payment.packages),
        apiGet<PaymentHistory[]>(ENDPOINTS.payment.history),
      ]);
      setMembers(membersData);
      setPackages(packagesData);
      setHistory(historyData);
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const handlePurchase = async () => {
    if (!selectedMemberId || !selectedPackageId) return;
    setPaying(true);
    try {
      await apiPost(ENDPOINTS.payment.purchase, {
        memberId: selectedMemberId,
        packageId: selectedPackageId,
      });
      setShowModal(false);

      // Google Sheets — 결제 등록 후 전체 동기화 (백그라운드)
      syncAllData().catch(() => {});

      setSelectedMemberId(null);
      setSelectedPackageId(null);
      fetchData(true);

      Alert.alert("완료", "결제가 등록됐어요! 🎉");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setPaying(false);
    }
  };

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
            onRefresh={() => fetchData(true)}
            tintColor={Colors.green}
          />
        }
      >
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 16 }}>결제 관리</Text>

        {/* 탭 */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
          {([["register", "결제 등록"], ["history", "결제 내역"]] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: tab === key ? Colors.green : Colors.bgSub,
                borderWidth: 1,
                borderColor: tab === key ? Colors.green : Colors.border,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: tab === key ? "#fff" : Colors.textMuted }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "register" && (
          <>
            {/* 회원 선택 */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textSub, marginBottom: 10 }}>회원 선택</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {members.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setSelectedMemberId(m.id)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: selectedMemberId === m.id ? Colors.green : Colors.bgSub,
                      borderWidth: 1.5,
                      borderColor: selectedMemberId === m.id ? Colors.green : Colors.border,
                      alignItems: "center",
                      minWidth: 80,
                    }}
                  >
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: selectedMemberId === m.id ? "#ffffff44" : Colors.border, justifyContent: "center", alignItems: "center", marginBottom: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: selectedMemberId === m.id ? "#fff" : Colors.textSub }}>{m.user.name[0]}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: selectedMemberId === m.id ? "#fff" : Colors.textMuted }}>
                      {m.user.name}
                    </Text>
                    {m.ptTotal > 0 && (
                      <Text style={{ fontSize: 10, color: selectedMemberId === m.id ? "#ffffffaa" : Colors.textPlaceholder, marginTop: 2 }}>
                        잔여 {m.ptRemaining}회
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* 패키지 선택 */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.textSub, marginBottom: 10 }}>패키지 선택</Text>
            {packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                onPress={() => setSelectedPackageId(pkg.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: selectedPackageId === pkg.id ? Colors.greenLight : Colors.bgSub,
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                  borderWidth: 1.5,
                  borderColor: selectedPackageId === pkg.id ? Colors.green : Colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text }}>{pkg.name}</Text>
                    {pkg.recommended && (
                      <View style={{ backgroundColor: Colors.gold, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>추천</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: Colors.textMuted }}>{pkg.sessions}회 PT</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: Colors.green }}>
                    {pkg.price.toLocaleString()}원
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    회당 {Math.round(pkg.price / pkg.sessions).toLocaleString()}원
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* 결제 버튼 */}
            <TouchableOpacity
              onPress={() => {
                if (!selectedMemberId) { Alert.alert("오류", "회원을 선택해주세요."); return; }
                if (!selectedPackageId) { Alert.alert("오류", "패키지를 선택해주세요."); return; }
                setShowModal(true);
              }}
              style={{
                backgroundColor: selectedMemberId && selectedPackageId ? Colors.green : Colors.border,
                borderRadius: 14,
                padding: 17,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: selectedMemberId && selectedPackageId ? "#fff" : Colors.textMuted }}>
                결제 등록하기
              </Text>
            </TouchableOpacity>
          </>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>💳</Text>
                <Text style={{ fontSize: 15, color: Colors.textMuted }}>결제 내역이 없어요</Text>
              </View>
            ) : (
              history.map((h) => (
                <View key={h.id} style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: Colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{h.packageName}</Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>{h.paidAt} · {h.sessions}회</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: Colors.green }}>{h.amount.toLocaleString()}원</Text>
                      <View style={{ backgroundColor: h.status === "PAID" ? Colors.greenLight : Colors.redBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: h.status === "PAID" ? Colors.green : Colors.red, fontWeight: "700" }}>
                          {h.status === "PAID" ? "결제완료" : h.status === "CANCELLED" ? "취소됨" : "대기중"}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* 결제 확인 모달 */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 20, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text, marginBottom: 20, textAlign: "center" }}>
              결제 확인
            </Text>
            <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <Row label="회원" value={selectedMember?.user.name ?? "-"} />
              <Row label="패키지" value={selectedPackage?.name ?? "-"} />
              <Row label="횟수" value={`${selectedPackage?.sessions ?? 0}회`} />
              <Row label="금액" value={`${(selectedPackage?.price ?? 0).toLocaleString()}원`} bold color={Colors.green} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={{ flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePurchase}
                disabled={paying}
                style={{ flex: 2, backgroundColor: Colors.green, borderRadius: 12, padding: 14, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                  {paying ? "처리 중..." : "결제 등록"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  color,
}: {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
      <Text style={{ fontSize: 13, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: bold ? "800" : "600", color: color ?? Colors.text }}>
        {value}
      </Text>
    </View>
  );
}
