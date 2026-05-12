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
    }

    const NOTI_ICON: Record<string, string> = {
    WORKOUT_LOG: "💪",
    DIET_LOG: "🍽️",
    SCHEDULE_REQUEST: "📅",
    SCHEDULE_CANCEL_REQ: "↩️",
    SCHEDULE_CONFIRM: "✅",
    SCHEDULE_CANCEL: "❌",
    SCHEDULE_OPEN: "📆",
    FEEDBACK: "💬",
    PT_EXPIRY: "⏰",
    GENERAL: "🔔",
    };

    export default function NotificationsScreen() {
    const [notifications, setNotifications] = useState<Noti[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
        const jwt = await AsyncStorage.getItem("jwt");
        const res = await fetch(`${API_URL}/api/notifications`, {
            headers: { Authorization: `Bearer ${jwt}` },
        });

        if (res.ok) setNotifications(await res.json());
        } catch {
        } finally {
        setLoading(false);
        setRefreshing(false);
        }
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
            prev.map(n =>
            n.notificationId === id ? { ...n, isRead: true } : n
            )
        );
        } catch {}
    };

    const handleNotificationPress = async (n: Noti) => {
        await markOneRead(n.notificationId);

        // 트레이너가 회원에게 보낸 운동기록 알림
        if (n.targetType === "WORKOUT_LOG") {
            router.push("/(tabs)/member/workout");
            return;
        }
        // 트레이너가 회원에게 보낸 식단 피드백 알림
        if (n.type === "FEEDBACK" || n.targetType === "FEEDBACK") {
            router.push("/(tabs)/member/diet");
            return;
        }
        // 예약 확정/취소 등 스케줄 관련 알림
        if (n.targetType === "SCHEDULE") {
            router.push("/(tabs)/member/schedule");
            return;
        }
        // 다음 주 스케줄 오픈 알림
        if (n.targetType === "SCHEDULE_OPEN") {
            router.push("/(tabs)/member/schedule");
            return;
        }
        // 일반 알림 / 이동 대상 없는 알림
        router.push("/(tabs)/member/home");
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
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
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} tintColor={Colors.green} />}
        >
            {notifications.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 80 }}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
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
                    gap: 12,
                    backgroundColor: n.isRead ? Colors.bgSub : Colors.greenLight,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: n.isRead ? Colors.border : Colors.green + "44",
                }}
                >
                {/* 아이콘 */}
                <View style={{
                    width: 42, height: 42, borderRadius: 12,
                    backgroundColor: n.isRead ? Colors.border : Colors.green + "22",
                    justifyContent: "center", alignItems: "center",
                }}>
                    <Text style={{ fontSize: 20 }}>{NOTI_ICON[n.type] ?? "🔔"}</Text>
                </View>

                {/* 내용 */}
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: Colors.text, fontWeight: n.isRead ? "400" : "700", lineHeight: 20 }}>
                    {n.content}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 6 }}>
                    {n.createdAt?.slice(0, 16).replace("T", " ")}
                    </Text>
                </View>

                {/* 읽지 않음 표시 */}
                {!n.isRead && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green, marginTop: 6 }} />
                )}
                </TouchableOpacity>
            ))
            )}
        </ScrollView>
        </View>
    );
    }
