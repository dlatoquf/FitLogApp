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
    memberId?: number | null;
}

const NOTI_ICON: Record<string, string> = {
    NEW_MEMBER:        "👋",  // 신규 회원 연결
    MEMBER_DELETED:    "👋",  // 회원 탈퇴
    MEMBER_DISCONNECT: "🔗",  // 회원 연결 해제
    DIET_PHOTO:        "🍽️", // 식단 로그 등록
    WORKOUT_LOG:       "💪",  // 개인 운동 로그 등록
    MISSION_DONE:      "🏆",  // 챌린지 완료
    SCHEDULE_REQUEST:  "📅",  // 수업 신청
    BIRTHDAY_TODAY:    "🎂",  // 회원 생일 당일
    BIRTHDAY_WEEK:     "🎁",  // 회원 생일 7일 전
    GENERAL:           "🔔",  // 제휴 코드 만료 / 무료 체험 종료
};

export default function TrainerNotificationsScreen() {
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

        // ── 신규 회원 연결 → 해당 회원 상세 페이지
        if (n.type === "NEW_MEMBER") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }

        // ── 회원 탈퇴 → 해당 회원 상세 페이지
        if (n.type === "MEMBER_DELETED") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }

        // ── 회원 연결 해제 → 해당 회원 상세 페이지
        if (n.type === "MEMBER_DISCONNECT") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }

        // ── 식단 로그 등록 → 해당 회원 식단 탭 + 해당 날짜
        if (n.type === "DIET_PHOTO") {
            const dateParam = n.targetDate ? `&date=${n.targetDate}` : "";
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}&initialTab=0${dateParam}` as any);
            return;
        }

        // ── 개인 운동 로그 등록 → 해당 회원 운동 탭 + 해당 날짜
        if (n.type === "WORKOUT_LOG" && n.targetType === "WORKOUT_LOG") {
            const id = n.memberId ?? n.targetId;
            const dateParam = n.targetDate ? `&date=${n.targetDate}` : "";
            router.push(`/(tabs)/trainer/member-detail?id=${id}&initialTab=1${dateParam}` as any);
            return;
        }

        // ── 챌린지 완료 → 해당 회원 상세 페이지
        if (n.type === "MISSION_DONE") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }

        // ── 수업 신청 → 일정 탭
        if (n.type === "SCHEDULE_REQUEST") {
            router.push("/(tabs)/trainer/schedule?tab=NEXT" as any);
            return;
        }

        // ── 회원 생일 당일 / 7일 전 → 해당 회원 상세 페이지
        if (n.type === "BIRTHDAY_TODAY" || n.type === "BIRTHDAY_WEEK") {
            router.push("/(tabs)/trainer/home");
            return;
        }

        // ── 제휴 코드 만료 예고 / 제휴 코드 만료 / 무료 체험 종료 D-3·D-1·D-0 → 더보기 탭
        if (n.type === "GENERAL") {
            router.push("/(tabs)/trainer/more");
            return;
        }

        // ── 기본 → 홈
        router.push("/(tabs)/trainer/home");
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
