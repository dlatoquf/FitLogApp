import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
    WORKOUT_LOG:       "💪",
    FEEDBACK:          "💬",
    DIET_FEEDBACK:     "🍽️",
    SCHEDULE_CONFIRM:  "✅",
    SCHEDULE_CANCEL:   "❌",
    SCHEDULE_REMINDER: "⏰",
    SCHEDULE_OPEN:     "📆",
    SCHEDULE_CHANGE:   "🔄",
    PT_ADD:            "➕",
    PT_EXPIRY:         "⏰",
    BODY_LOG:          "📊",
    GENERAL:           "🔔",
};

type TabKey = "전체" | "수업" | "기록/피드백" | "결제/공지";

const TABS: { key: TabKey; label: string }[] = [
    { key: "전체",      label: "전체" },
    { key: "수업",      label: "수업" },
    { key: "기록/피드백", label: "기록/피드백" },
    { key: "결제/공지",  label: "결제/공지" },
];

const TAB_TYPES: Record<TabKey, string[]> = {
    전체:       [],
    수업:       ["SCHEDULE_CONFIRM", "SCHEDULE_CANCEL", "SCHEDULE_REMINDER", "SCHEDULE_OPEN", "SCHEDULE_CHANGE"],
    "기록/피드백": ["WORKOUT_LOG", "FEEDBACK", "DIET_FEEDBACK", "BODY_LOG"],
    "결제/공지":  ["PT_ADD", "PT_EXPIRY", "GENERAL"],
};

function formatTime(createdAt: string) {
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const min = String(date.getMinutes()).padStart(2, "0");
    const ampm = hour < 12 ? "오전" : "오후";
    const h = hour % 12 || 12;
    return `${month}.${day} ${ampm} ${h}:${min}`;
}

export default function MemberNotificationsScreen() {
    const [notifications, setNotifications] = useState<Noti[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>("전체");

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
        console.log("[Notif Press Member]", JSON.stringify({ type: n.type, targetType: n.targetType, targetId: n.targetId, targetDate: n.targetDate }));
        await markOneRead(n.notificationId);
        const from = "notifications";
        if (n.type === "WORKOUT_LOG" || n.type === "FEEDBACK" || n.targetType === "WORKOUT_LOG") {
            const date = n.targetDate ?? undefined;
            router.push(date ? ({ pathname: "/(tabs)/member/workout", params: { date, from } } as any) : ({ pathname: "/(tabs)/member/workout", params: { from } } as any));
            return;
        }
        if (n.type === "DIET_FEEDBACK" || n.targetType === "DIET_FEEDBACK") {
            const date = n.targetDate ?? undefined;
            router.push(date ? ({ pathname: "/(tabs)/member/diet", params: { date, from } } as any) : ({ pathname: "/(tabs)/member/diet", params: { from } } as any));
            return;
        }
        if (n.type === "SCHEDULE_CONFIRM" || n.type === "SCHEDULE_CANCEL" || n.type === "SCHEDULE_REMINDER" || n.type === "SCHEDULE_CHANGE") {
            router.push({ pathname: "/(tabs)/member/home", params: { from } } as any); return;
        }
        if (n.type === "SCHEDULE_OPEN" || n.targetType === "SCHEDULE_OPEN") {
            router.push({ pathname: "/(tabs)/member/home", params: { openSchedule: "true", from } } as any); return;
        }
        if (n.type === "PT_ADD" || n.targetType === "PT") {
            router.push({ pathname: "/(tabs)/member/home", params: { from } } as any); return;
        }
        if (n.type === "BODY_LOG" || n.targetType === "BODY_LOG") {
            router.push({ pathname: "/(tabs)/member/growth", params: { from } } as any); return;
        }
        if (n.type === "GENERAL") {
            router.push({ pathname: "/(tabs)/member/notices", params: { from } } as any); return;
        }
        router.push({ pathname: "/(tabs)/member/home", params: { from } } as any);
    };

    useFocusEffect(useCallback(() => {
        setActiveTab("전체");
        fetchNotifications();
    }, []));

    const filtered = activeTab === "전체"
        ? notifications
        : notifications.filter(n => TAB_TYPES[activeTab].includes(n.type));

    const unreadCount = notifications.filter(n => !n.isRead).length;

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
                <ActivityIndicator color={Colors.blue} size="large" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* 헤더 */}
            <View style={{
                paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10,
                borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 4 }}>
                            <Text style={{ fontSize: 20, color: Colors.text }}>←</Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 20, fontWeight: "800", color: Colors.text }}>알림</Text>
                        {unreadCount > 0 && (
                            <View style={{ backgroundColor: Colors.blue, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>{unreadCount}</Text>
                            </View>
                        )}
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        {unreadCount > 0 && (
                            <TouchableOpacity onPress={markAllRead}>
                                <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "600" }}>모두 읽음</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => router.push("/(tabs)/member/notification-settings" as any)}>
                            <Text style={{ fontSize: 14, color: Colors.text, fontWeight: "600" }}>설정</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 탭 */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.key;
                            const tabUnread = tab.key === "전체"
                                ? unreadCount
                                : notifications.filter(n => TAB_TYPES[tab.key].includes(n.type) && !n.isRead).length;
                            return (
                                <TouchableOpacity
                                    key={tab.key}
                                    onPress={() => setActiveTab(tab.key)}
                                    style={{
                                        flexDirection: "row", alignItems: "center", gap: 4,
                                        paddingHorizontal: 12, paddingVertical: 6,
                                        borderRadius: 20,
                                        backgroundColor: isActive ? Colors.blue : Colors.bgSub,
                                        borderWidth: 1,
                                        borderColor: isActive ? Colors.blue : Colors.border,
                                    }}
                                >
                                    <Text style={{ fontSize: 12, fontWeight: "600", color: isActive ? "#fff" : Colors.textSub }}>
                                        {tab.label}
                                    </Text>
                                    {tabUnread > 0 && (
                                        <View style={{ backgroundColor: isActive ? "rgba(255,255,255,0.3)" : Colors.blue, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff" }}>{tabUnread}</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>

            {/* 알림 목록 */}
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} tintColor={Colors.blue} />}
            >
                {filtered.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 60 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text, marginBottom: 4 }}>알림이 없어요</Text>
                        <Text style={{ fontSize: 12, color: Colors.textMuted }}>새 알림이 오면 여기에 표시돼요</Text>
                    </View>
                ) : (
                    filtered.map((n, idx) => (
                        <TouchableOpacity
                            key={n.notificationId}
                            onPress={() => handleNotificationPress(n)}
                            style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 10,
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                backgroundColor: n.isRead ? "#fff" : "#EFF6FF",
                                borderBottomWidth: 1,
                                borderBottomColor: Colors.border,
                            }}
                        >
                            <View style={{
                                width: 36, height: 36, borderRadius: 18,
                                backgroundColor: n.isRead ? Colors.bgSub : Colors.blue + "22",
                                justifyContent: "center", alignItems: "center",
                                flexShrink: 0,
                            }}>
                                <Text style={{ fontSize: 16 }}>{NOTI_ICON[n.type] ?? "🔔"}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontSize: 13, color: Colors.text,
                                    fontWeight: n.isRead ? "400" : "600",
                                    lineHeight: 18,
                                }} numberOfLines={2}>
                                    {n.content}
                                </Text>
                                <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                                    {formatTime(n.createdAt)}
                                </Text>
                            </View>
                            {!n.isRead && (
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.blue, flexShrink: 0 }} />
                            )}
                        </TouchableOpacity>
                    ))
                )}

                {/* 7일 만료 안내 */}
                {filtered.length > 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 20, gap: 4 }}>
                        <View style={{ width: 40, height: 1, backgroundColor: Colors.border }} />
                        <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 6 }}>
                            알림은 7일 후 자동으로 삭제돼요
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
