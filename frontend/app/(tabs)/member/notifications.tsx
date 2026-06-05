import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

interface Noti {
    notificationId: number;
    type: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    targetType?: string | null;
    targetId?: number | null;
    targetDate?: string | null;
}

const NOTI_ICON: Record<string, string> = {
    WORKOUT_LOG:       "💪",  // PT 운동 로그 등록 / PT 운동 로그 + 챌린지
    FEEDBACK:          "💬",  // 운동 피드백
    DIET_FEEDBACK:     "🍽️", // 식단 피드백
    SCHEDULE_CONFIRM:  "✅",  // 수업 확정
    SCHEDULE_CANCEL:   "❌",  // 수업 취소
    SCHEDULE_REMINDER: "⏰",  // 수업 30분 전 알림
    SCHEDULE_OPEN:     "📆",  // 다음 주 스케줄 오픈
    PT_ADD:            "➕",  // PT 추가 등록
    PT_EXPIRY:         "⏰",  // PT 만료
    BODY_LOG:          "📊",  // 바디로그
    GENERAL:           "🔔",  // 공지사항
};

export default function MemberNotificationsScreen() {
    const [notifications, setNotifications] = useState<Noti[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await fetch(`${API_URL}/api/notifications`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (res.ok) setNotifications(await res.json());
        } catch {}
        finally { setLoading(false); setRefreshing(false); }
    };

    const markAllRead = async () => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await fetch(`${API_URL}/api/notifications/read-all`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch {}
    };

    const markOneRead = async (id: number) => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await fetch(`${API_URL}/api/notifications/${id}/read`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setNotifications(prev =>
                prev.map(n => n.notificationId === id ? { ...n, isRead: true } : n)
            );
        } catch {}
    };

    const handleNotificationPress = async (n: Noti) => {
        await markOneRead(n.notificationId);

        // ── PT 운동 로그 등록 / PT 운동 로그 + 챌린지 / 운동 피드백 → 운동 로그 탭 + 해당 날짜
        if (
            n.type === "WORKOUT_LOG" ||
            n.type === "FEEDBACK" ||
            n.targetType === "WORKOUT_LOG"
        ) {
            const date = n.targetDate ?? undefined;
            router.push(
                date
                    ? ({ pathname: "/(tabs)/member/workout", params: { date } } as any)
                    : "/(tabs)/member/workout"
            );
            return;
        }

        // ── 식단 피드백 → 식단 탭 + 해당 날짜
        if (n.type === "DIET_FEEDBACK" || n.targetType === "DIET_FEEDBACK") {
            const date = n.targetDate ?? undefined;
            router.push(
                date
                    ? ({ pathname: "/(tabs)/member/diet", params: { date } } as any)
                    : "/(tabs)/member/diet"
            );
            return;
        }

        // ── 수업 확정 → 홈
        if (n.type === "SCHEDULE_CONFIRM") {
            router.push("/(tabs)/member/home");
            return;
        }

        // ── 수업 취소 → 홈
        if (n.type === "SCHEDULE_CANCEL") {
            router.push("/(tabs)/member/home");
            return;
        }

        // ── 수업 30분 전 알림 → 홈
        if (n.type === "SCHEDULE_REMINDER") {
            router.push("/(tabs)/member/home");
            return;
        }

        // ── 다음 주 스케줄 오픈 → 홈 (수업 신청 모달 오픈)
        if (n.type === "SCHEDULE_OPEN" || n.targetType === "SCHEDULE_OPEN") {
            router.push({
                pathname: "/(tabs)/member/home",
                params: { openSchedule: "true" },
            });
            return;
        }

        // ── PT 추가 등록 → 홈 화면
        if (n.type === "PT_ADD" || n.targetType === "PT") {
            router.push("/(tabs)/member/home");
            return;
        }

        // ── 바디로그 → 바디 탭
        if (n.type === "BODY_LOG" || n.targetType === "BODY_LOG") {
            router.push("/(tabs)/member/growth" as any);
            return;
        }

        // ── 공지사항 (GENERAL) → 공지 화면
        if (n.type === "GENERAL") {
            router.push("/(tabs)/member/notices" as any);
            return;
        }

        // ── 기본 → 홈
        router.push("/(tabs)/member/home");
    };

    useEffect(() => { fetchNotifications(); }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
                <ActivityIndicator color={Colors.green} size="large" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* 헤더 */}
            <View style={{
                flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
                borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 4 }}>
                        <Text style={{ fontSize: 20, color: Colors.text }}>←</Text>
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text }}>알림</Text>
                    {unreadCount > 0 && (
                        <View style={{ backgroundColor: Colors.green, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllRead}>
                        <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "600" }}>모두 읽음</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 32 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} tintColor={Colors.green} />}
            >
                {notifications.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <Text style={{ fontSize: 36, marginBottom: 12 }}>🔔</Text>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 6 }}>알림이 없어요</Text>
                        <Text style={{ fontSize: 13, color: Colors.textMuted }}>새 알림이 오면 여기에 표시돼요</Text>
                    </View>
                ) : (
                    notifications.map(n => (
                        <TouchableOpacity
                            key={n.notificationId}
                            onPress={() => handleNotificationPress(n)}
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 9,
                                backgroundColor: n.isRead ? Colors.bgSub : Colors.greenLight,
                                borderRadius: 12,
                                padding: 12,
                                marginBottom: 7,
                                borderWidth: 1,
                                borderColor: n.isRead ? Colors.border : Colors.green + "44",
                            }}
                        >
                            <View style={{
                                width: 34, height: 34, borderRadius: 10,
                                backgroundColor: n.isRead ? Colors.border : Colors.green + "22",
                                justifyContent: "center", alignItems: "center",
                            }}>
                                <Text style={{ fontSize: 16 }}>{NOTI_ICON[n.type] ?? "🔔"}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 13, color: Colors.text, fontWeight: n.isRead ? "400" : "700", lineHeight: 18 }}>
                                    {n.content}
                                </Text>
                                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4 }}>
                                    {n.createdAt?.slice(0, 16).replace("T", " ")}
                                </Text>
                            </View>
                            {!n.isRead && (
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green, marginTop: 6 }} />
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
