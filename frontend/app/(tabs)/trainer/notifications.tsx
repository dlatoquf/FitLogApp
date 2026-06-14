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
    NEW_MEMBER:        "👋",
    MEMBER_DELETED:    "👋",
    MEMBER_DISCONNECT: "🔗",
    DIET_PHOTO:        "🍽️",
    WORKOUT_LOG:       "💪",
    MISSION_DONE:      "🏆",
    SCHEDULE_REQUEST:  "📅",
    BIRTHDAY_TODAY:    "🎂",
    BIRTHDAY_WEEK:     "🎁",
    GENERAL:           "🔔",
};

type TabKey = "전체" | "운동로그" | "식단" | "회원관리";

const TABS: { key: TabKey; label: string }[] = [
    { key: "전체",    label: "전체" },
    { key: "운동로그", label: "운동로그" },
    { key: "식단",    label: "식단" },
    { key: "회원관리", label: "회원관리" },
];

const TAB_TYPES: Record<TabKey, string[]> = {
    전체:    [],
    운동로그: ["WORKOUT_LOG", "MISSION_DONE"],
    식단:    ["DIET_PHOTO"],
    회원관리: ["NEW_MEMBER", "MEMBER_DELETED", "MEMBER_DISCONNECT", "BIRTHDAY_TODAY", "BIRTHDAY_WEEK", "SCHEDULE_REQUEST"],
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

export default function TrainerNotificationsScreen() {
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
        await markOneRead(n.notificationId);
        if (n.type === "NEW_MEMBER" || n.type === "MEMBER_DELETED" || n.type === "MEMBER_DISCONNECT") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any); return;
        }
        if (n.type === "DIET_PHOTO") {
            const dateParam = n.targetDate ? `&date=${n.targetDate}` : "";
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}&initialTab=0${dateParam}` as any); return;
        }
        if (n.type === "WORKOUT_LOG") {
            const id = n.memberId ?? n.targetId;
            const dateParam = n.targetDate ? `&date=${n.targetDate}` : "";
            router.push(`/(tabs)/trainer/member-detail?id=${id}&initialTab=1${dateParam}` as any); return;
        }
        if (n.type === "MISSION_DONE") {
            const id = n.memberId ?? n.targetId;
            if (id) router.push(`/(tabs)/trainer/member-detail?id=${id}` as any); return;
        }
        if (n.type === "SCHEDULE_REQUEST") {
            router.push("/(tabs)/trainer/schedule?tab=NEXT" as any); return;
        }
        if (n.type === "BIRTHDAY_TODAY" || n.type === "BIRTHDAY_WEEK") {
            const id = n.memberId ?? n.targetId;
            if (id) router.push(`/(tabs)/trainer/member-detail?id=${id}` as any); return;
        }
        if (n.type === "GENERAL") {
            router.push("/(tabs)/trainer/more"); return;
        }
        router.push("/(tabs)/trainer/home");
    };

    useEffect(() => { fetchNotifications(); }, []);

    const filtered = activeTab === "전체"
        ? notifications
        : notifications.filter(n => TAB_TYPES[activeTab].includes(n.type));

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
                paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
                borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        {unreadCount > 0 && (
                            <TouchableOpacity onPress={markAllRead}>
                                <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "600" }}>모두 읽음</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => router.push("/(tabs)/trainer/notification-settings" as any)}>
                            <Text style={{ fontSize: 14, color: Colors.text, fontWeight: "600" }}>설정</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 탭 필터 */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
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
                                        paddingHorizontal: 14, paddingVertical: 7,
                                        borderRadius: 20,
                                        backgroundColor: isActive ? Colors.text : Colors.bgSub,
                                        borderWidth: 1,
                                        borderColor: isActive ? Colors.text : Colors.border,
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: "600", color: isActive ? "#fff" : Colors.textSub }}>
                                        {tab.label}
                                    </Text>
                                    {tabUnread > 0 && (
                                        <View style={{ backgroundColor: Colors.green, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                                            <Text style={{ fontSize: 10, fontWeight: "700", color: "#fff" }}>{tabUnread}</Text>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchNotifications(true)} tintColor={Colors.green} />}
            >
                {filtered.length === 0 ? (
                    <View style={{ alignItems: "center", paddingVertical: 80 }}>
                        <Text style={{ fontSize: 36, marginBottom: 12 }}>🔔</Text>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 6 }}>알림이 없어요</Text>
                        <Text style={{ fontSize: 13, color: Colors.textMuted }}>새 알림이 오면 여기에 표시돼요</Text>
                    </View>
                ) : (
                    filtered.map((n, idx) => (
                        <TouchableOpacity
                            key={n.notificationId}
                            onPress={() => handleNotificationPress(n)}
                            style={{
                                flexDirection: "row",
                                alignItems: "flex-start",
                                gap: 12,
                                paddingHorizontal: 20,
                                paddingVertical: 14,
                                backgroundColor: n.isRead ? "#fff" : Colors.greenLight,
                                borderBottomWidth: idx === filtered.length - 1 ? 0 : 1,
                                borderBottomColor: Colors.border,
                            }}
                        >
                            <View style={{
                                width: 42, height: 42, borderRadius: 21,
                                backgroundColor: n.isRead ? Colors.bgSub : Colors.green + "22",
                                justifyContent: "center", alignItems: "center",
                                marginTop: 1,
                            }}>
                                <Text style={{ fontSize: 18 }}>{NOTI_ICON[n.type] ?? "🔔"}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{
                                    fontSize: 14, color: Colors.text,
                                    fontWeight: n.isRead ? "400" : "600",
                                    lineHeight: 20,
                                }}>
                                    {n.content}
                                </Text>
                                <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 4 }}>
                                    {formatTime(n.createdAt)}
                                </Text>
                            </View>
                            {!n.isRead && (
                                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green, marginTop: 8 }} />
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
