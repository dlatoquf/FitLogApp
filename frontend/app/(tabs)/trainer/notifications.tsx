import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    Switch,
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

export default function TrainerNotificationsScreen() {
    const [notifications, setNotifications] = useState<Noti[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const [notifPush, setNotifPush] = useState(true);
    const [notifWorkout, setNotifWorkout] = useState(true);
    const [notifDiet, setNotifDiet] = useState(true);
    const [notifNewMember, setNotifNewMember] = useState(true);
    const [notifBirthday, setNotifBirthday] = useState(true);
    const [notifMissionDone, setNotifMissionDone] = useState(true);
    const [notifPersonalWorkout, setNotifPersonalWorkout] = useState(true);

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

    const fetchNotifSettings = async () => {
        const pairs = await AsyncStorage.multiGet([
            "notif_push",
            "notif_workout",
            "notif_diet",
            "notif_new_member",
        ]);
        if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
        if (pairs[1][1] !== null) setNotifWorkout(pairs[1][1] === "true");
        if (pairs[2][1] !== null) setNotifDiet(pairs[2][1] === "true");
        if (pairs[3][1] !== null) setNotifNewMember(pairs[3][1] === "true");

        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const notifRes = await fetch(`${API_URL}/api/trainer/notif-settings`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            if (notifRes.ok) {
                const notifData = await notifRes.json();
                setNotifBirthday(notifData.notifBirthday !== false);
                setNotifMissionDone(notifData.notifMissionDone !== false);
                if (typeof notifData.notifWorkout === "boolean") {
                    setNotifWorkout(notifData.notifWorkout);
                    await AsyncStorage.setItem("notif_workout", String(notifData.notifWorkout));
                }
                if (typeof notifData.notifPersonalWorkout === "boolean") {
                    setNotifPersonalWorkout(notifData.notifPersonalWorkout);
                }
                if (typeof notifData.notifDiet === "boolean") {
                    setNotifDiet(notifData.notifDiet);
                    await AsyncStorage.setItem("notif_diet", String(notifData.notifDiet));
                }
                if (typeof notifData.notifNewMember === "boolean") {
                    setNotifNewMember(notifData.notifNewMember);
                    await AsyncStorage.setItem("notif_new_member", String(notifData.notifNewMember));
                }
            }
        } catch {}
    };

    const patchNotifSettings = async (body: Record<string, boolean>) => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await fetch(`${API_URL}/api/trainer/notif-settings`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify(body),
            });
        } catch {}
    };

    const handleNotifPush = async (v: boolean) => {
        setNotifPush(v);
        AsyncStorage.setItem("notif_push", String(v));
        if (!v) {
            setNotifWorkout(false);
            setNotifDiet(false);
            setNotifNewMember(false);
            setNotifPersonalWorkout(false);
            AsyncStorage.multiSet([
                ["notif_workout", "false"],
                ["notif_diet", "false"],
                ["notif_new_member", "false"],
            ]);
            await patchNotifSettings({
                notifWorkout: false,
                notifDiet: false,
                notifNewMember: false,
                notifPersonalWorkout: false,
            });
            handleNotifBirthday(false, false);
            handleNotifMissionDone(false, false);
        } else {
            setNotifWorkout(true);
            setNotifDiet(true);
            setNotifNewMember(true);
            setNotifPersonalWorkout(true);
            AsyncStorage.multiSet([
                ["notif_workout", "true"],
                ["notif_diet", "true"],
                ["notif_new_member", "true"],
            ]);
            await patchNotifSettings({
                notifWorkout: true,
                notifDiet: true,
                notifNewMember: true,
                notifPersonalWorkout: true,
            });
            handleNotifBirthday(true, false);
            handleNotifMissionDone(true, false);
        }
    };
    const handleNotifWorkout = async (v: boolean) => {
        setNotifWorkout(v);
        await AsyncStorage.setItem("notif_workout", String(v));
        await patchNotifSettings({ notifWorkout: v });
        if (v && !notifPush) handleNotifPush(true);
    };
    const handleNotifDiet = async (v: boolean) => {
        setNotifDiet(v);
        await AsyncStorage.setItem("notif_diet", String(v));
        await patchNotifSettings({ notifDiet: v });
        if (v && !notifPush) handleNotifPush(true);
    };
    const handleNotifNewMember = async (v: boolean) => {
        setNotifNewMember(v);
        await AsyncStorage.setItem("notif_new_member", String(v));
        await patchNotifSettings({ notifNewMember: v });
        if (v && !notifPush) handleNotifPush(true);
    };
    const handleNotifBirthday = async (v: boolean, turnOnPush = true) => {
        setNotifBirthday(v);
        if (v && turnOnPush && !notifPush) handleNotifPush(true);
        await patchNotifSettings({ notifBirthday: v });
    };
    const handleNotifMissionDone = async (v: boolean, turnOnPush = true) => {
        setNotifMissionDone(v);
        if (v && turnOnPush && !notifPush) handleNotifPush(true);
        await patchNotifSettings({ notifMissionDone: v });
    };
    const handleNotifPersonalWorkout = async (v: boolean) => {
        setNotifPersonalWorkout(v);
        await patchNotifSettings({ notifPersonalWorkout: v });
        if (v && !notifPush) handleNotifPush(true);
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

        if (n.type === "NEW_MEMBER") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }
        if (n.type === "MEMBER_DELETED") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }
        if (n.type === "MEMBER_DISCONNECT") {
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}` as any);
            return;
        }
        if (n.type === "DIET_PHOTO") {
            const dateParam = n.targetDate ? `&date=${n.targetDate}` : "";
            router.push(`/(tabs)/trainer/member-detail?id=${n.targetId}&initialTab=0${dateParam}` as any);
            return;
        }
        if (n.type === "WORKOUT_LOG" && n.targetType === "WORKOUT_LOG") {
            const id = n.memberId ?? n.targetId;
            const dateParam = n.targetDate ? `&date=${n.targetDate}` : "";
            router.push(`/(tabs)/trainer/member-detail?id=${id}&initialTab=1${dateParam}` as any);
            return;
        }
        if (n.type === "MISSION_DONE") {
            const id = n.memberId ?? n.targetId;
            if (id) router.push(`/(tabs)/trainer/member-detail?id=${id}` as any);
            return;
        }
        if (n.type === "SCHEDULE_REQUEST") {
            router.push("/(tabs)/trainer/schedule?tab=NEXT" as any);
            return;
        }
        if (n.type === "BIRTHDAY_TODAY" || n.type === "BIRTHDAY_WEEK") {
            const id = n.memberId ?? n.targetId;
            if (id) router.push(`/(tabs)/trainer/member-detail?id=${id}` as any);
            return;
        }
        if (n.type === "GENERAL") {
            router.push("/(tabs)/trainer/more");
            return;
        }
        router.push("/(tabs)/trainer/home");
    };

    useEffect(() => {
        fetchNotifications();
        fetchNotifSettings();
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={markAllRead}>
                            <Text style={{ fontSize: 13, color: Colors.textMuted, fontWeight: "600" }}>모두 읽음</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setShowSettings(true)}>
                        <Text style={{ fontSize: 14, color: Colors.text, fontWeight: "600" }}>설정</Text>
                    </TouchableOpacity>
                </View>
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

            {/* 알림 설정 모달 */}
            <Modal visible={showSettings} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
                    <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 }}>
                        <View style={{
                            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                            paddingHorizontal: 20, paddingVertical: 18,
                            borderBottomWidth: 1, borderBottomColor: Colors.border,
                        }}>
                            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}>알림 설정</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}>
                                <Text style={{ fontSize: 15, color: Colors.textMuted, fontWeight: "600" }}>닫기</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                            <View style={{
                                backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden",
                                marginBottom: 8, borderWidth: 1, borderColor: Colors.border,
                            }}>
                                <SwitchRow
                                    label="전체 푸시 알림"
                                    value={notifPush}
                                    onValueChange={handleNotifPush}
                                    color={Colors.green}
                                    bold
                                />
                            </View>
                            <View style={{
                                backgroundColor: Colors.bgSub, borderRadius: 14, overflow: "hidden",
                                borderWidth: 1, borderColor: Colors.border,
                                opacity: notifPush ? 1 : 0.4,
                            }}>
                                <SwitchRow
                                    label="개인 운동 기록"
                                    desc="회원이 개인 운동을 기록하면 트레이너에게 알림"
                                    value={notifPersonalWorkout}
                                    onValueChange={handleNotifPersonalWorkout}
                                    color={Colors.green}
                                    disabled={!notifPush}
                                />
                                <View style={{ height: 1, backgroundColor: Colors.border }} />
                                <SwitchRow
                                    label="식단 사진"
                                    desc="회원이 식단 사진을 올리면 알림"
                                    value={notifDiet}
                                    onValueChange={handleNotifDiet}
                                    color={Colors.green}
                                    disabled={!notifPush}
                                />
                                <View style={{ height: 1, backgroundColor: Colors.border }} />
                                <SwitchRow
                                    label="신규 회원 연결"
                                    desc="새 회원이 코드로 연결되면 알림"
                                    value={notifNewMember}
                                    onValueChange={handleNotifNewMember}
                                    color={Colors.green}
                                    disabled={!notifPush}
                                />
                                <View style={{ height: 1, backgroundColor: Colors.border }} />
                                <SwitchRow
                                    label="회원 생일 알림"
                                    desc="생일 당일·7일 전 트레이너에게 알림"
                                    value={notifBirthday}
                                    onValueChange={(v) => handleNotifBirthday(v)}
                                    color={Colors.green}
                                    disabled={!notifPush}
                                />
                                <View style={{ height: 1, backgroundColor: Colors.border }} />
                                <SwitchRow
                                    label="챌린지 완료 알림"
                                    desc="회원이 챌린지를 완료하면 알림"
                                    value={notifMissionDone}
                                    onValueChange={(v) => handleNotifMissionDone(v)}
                                    color={Colors.green}
                                    disabled={!notifPush}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function SwitchRow({
    label,
    desc,
    value,
    onValueChange,
    color,
    bold,
    disabled,
}: {
    label: string;
    desc?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    color: string;
    bold?: boolean;
    disabled?: boolean;
}) {
    return (
        <View style={{
            flexDirection: "row", justifyContent: "space-between", alignItems: "center",
            paddingHorizontal: 16, paddingVertical: desc ? 12 : 16,
        }}>
            <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 14, color: Colors.text, fontWeight: bold ? "700" : "400" }}>
                    {label}
                </Text>
                {desc && (
                    <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>{desc}</Text>
                )}
            </View>
            <Switch
                value={value}
                onValueChange={disabled ? undefined : onValueChange}
                trackColor={{ true: color }}
                thumbColor="#fff"
            />
        </View>
    );
}
