import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL } from "../../../constants/api";

export default function NotificationSettingsScreen() {
    const [loading, setLoading] = useState(true);
    const [notifPush, setNotifPush] = useState(true);
    const [notifWorkout, setNotifWorkout] = useState(true);
    const [notifDiet, setNotifDiet] = useState(true);
    const [notifNewMember, setNotifNewMember] = useState(true);
    const [notifBirthday, setNotifBirthday] = useState(true);
    const [notifMissionDone, setNotifMissionDone] = useState(true);
    const [notifPersonalWorkout, setNotifPersonalWorkout] = useState(true);
    const [notifIncompleteSession, setNotifIncompleteSession] = useState(true);

    useEffect(() => {
        const fetch_ = async () => {
            const pairs = await AsyncStorage.multiGet([
                "notif_push", "notif_workout", "notif_diet", "notif_new_member",
            ]);
            if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
            if (pairs[1][1] !== null) setNotifWorkout(pairs[1][1] === "true");
            if (pairs[2][1] !== null) setNotifDiet(pairs[2][1] === "true");
            if (pairs[3][1] !== null) setNotifNewMember(pairs[3][1] === "true");

            try {
                const jwt = await AsyncStorage.getItem("jwt");
                const res = await fetch(`${API_URL}/api/trainer/notif-settings`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setNotifBirthday(data.notifBirthday !== false);
                    setNotifMissionDone(data.notifMissionDone !== false);
                    if (typeof data.notifIncompleteSession === "boolean") setNotifIncompleteSession(data.notifIncompleteSession);
                    if (typeof data.notifWorkout === "boolean") { setNotifWorkout(data.notifWorkout); await AsyncStorage.setItem("notif_workout", String(data.notifWorkout)); }
                    if (typeof data.notifPersonalWorkout === "boolean") setNotifPersonalWorkout(data.notifPersonalWorkout);
                    if (typeof data.notifDiet === "boolean") { setNotifDiet(data.notifDiet); await AsyncStorage.setItem("notif_diet", String(data.notifDiet)); }
                    if (typeof data.notifNewMember === "boolean") { setNotifNewMember(data.notifNewMember); await AsyncStorage.setItem("notif_new_member", String(data.notifNewMember)); }
                }
            } catch {}
            setLoading(false);
        };
        fetch_();
    }, []);

    const patch = async (body: Record<string, boolean>) => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await fetch(`${API_URL}/api/trainer/notif-settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
                body: JSON.stringify(body),
            });
        } catch {}
    };

    const handleNotifPush = async (v: boolean) => {
        setNotifPush(v);
        AsyncStorage.setItem("notif_push", String(v));
        if (!v) {
            setNotifWorkout(false); setNotifDiet(false); setNotifNewMember(false); setNotifPersonalWorkout(false); setNotifIncompleteSession(false);
            AsyncStorage.multiSet([["notif_workout","false"],["notif_diet","false"],["notif_new_member","false"]]);
            await patch({ notifWorkout: false, notifDiet: false, notifNewMember: false, notifPersonalWorkout: false, notifIncompleteSession: false });
            handleNotifBirthday(false, false); handleNotifMissionDone(false, false);
        } else {
            setNotifWorkout(true); setNotifDiet(true); setNotifNewMember(true); setNotifPersonalWorkout(true); setNotifIncompleteSession(true);
            AsyncStorage.multiSet([["notif_workout","true"],["notif_diet","true"],["notif_new_member","true"]]);
            await patch({ notifWorkout: true, notifDiet: true, notifNewMember: true, notifPersonalWorkout: true, notifIncompleteSession: true });
            handleNotifBirthday(true, false); handleNotifMissionDone(true, false);
        }
    };
    const handleNotifWorkout = async (v: boolean) => { setNotifWorkout(v); await AsyncStorage.setItem("notif_workout", String(v)); await patch({ notifWorkout: v }); if (v && !notifPush) handleNotifPush(true); };
    const handleNotifDiet = async (v: boolean) => { setNotifDiet(v); await AsyncStorage.setItem("notif_diet", String(v)); await patch({ notifDiet: v }); if (v && !notifPush) handleNotifPush(true); };
    const handleNotifNewMember = async (v: boolean) => { setNotifNewMember(v); await AsyncStorage.setItem("notif_new_member", String(v)); await patch({ notifNewMember: v }); if (v && !notifPush) handleNotifPush(true); };
    const handleNotifBirthday = async (v: boolean, turnOnPush = true) => { setNotifBirthday(v); if (v && turnOnPush && !notifPush) handleNotifPush(true); await patch({ notifBirthday: v }); };
    const handleNotifMissionDone = async (v: boolean, turnOnPush = true) => { setNotifMissionDone(v); if (v && turnOnPush && !notifPush) handleNotifPush(true); await patch({ notifMissionDone: v }); };
    const handleNotifPersonalWorkout = async (v: boolean) => { setNotifPersonalWorkout(v); await patch({ notifPersonalWorkout: v }); if (v && !notifPush) handleNotifPush(true); };
    const handleNotifIncompleteSession = async (v: boolean) => { setNotifIncompleteSession(v); await patch({ notifIncompleteSession: v }); if (v && !notifPush) handleNotifPush(true); };

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* 헤더 */}
            <View style={{
                flexDirection: "row", alignItems: "center",
                paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
                borderBottomWidth: 1, borderBottomColor: Colors.border,
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ position: "absolute", left: 20, top: 56, paddingBottom: 16 }}>
                    <Text style={{ fontSize: 20, color: Colors.text }}>←</Text>
                </TouchableOpacity>
                <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: Colors.text }}>
                    알림 설정
                </Text>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator color={Colors.green} size="large" />
                </View>
            ) : (
                <ScrollView>
                    {/* 전체 알림 */}
                    <Row
                        label="알림 활성화"
                        desc="아이폰 > 설정 > 알림에서 핏로그 설정을 확인해주세요."
                        value={notifPush}
                        onValueChange={handleNotifPush}
                        isLast
                    />

                    <View style={{ height: 8, backgroundColor: Colors.bgSub }} />

                    {/* 세부 알림 */}
                    <Row
                        label="개인 운동 기록"
                        desc="회원이 개인 운동을 기록하면 알림"
                        value={notifPersonalWorkout}
                        onValueChange={handleNotifPersonalWorkout}
                        disabled={!notifPush}
                    />
                    <Row
                        label="식단 사진"
                        desc="회원이 식단 사진을 올리면 알림"
                        value={notifDiet}
                        onValueChange={handleNotifDiet}
                        disabled={!notifPush}
                    />
                    <Row
                        label="신규 회원 연결"
                        desc="새 회원이 코드로 연결되면 알림"
                        value={notifNewMember}
                        onValueChange={handleNotifNewMember}
                        disabled={!notifPush}
                    />
                    <Row
                        label="회원 생일 알림"
                        desc="생일 당일·7일 전 알림"
                        value={notifBirthday}
                        onValueChange={handleNotifBirthday}
                        disabled={!notifPush}
                    />
                    <Row
                        label="챌린지 완료 알림"
                        desc="회원이 챌린지를 완료하면 알림"
                        value={notifMissionDone}
                        onValueChange={handleNotifMissionDone}
                        disabled={!notifPush}
                    />
                    <Row
                        label="수업 미완료 알림"
                        desc="전날 확정된 수업이 완료/노쇼 처리되지 않으면 오전 9시에 알림"
                        value={notifIncompleteSession}
                        onValueChange={handleNotifIncompleteSession}
                        disabled={!notifPush}
                        isLast
                    />
                </ScrollView>
            )}
        </View>
    );
}

function Row({
    label, desc, value, onValueChange, disabled, isLast,
}: {
    label: string;
    desc?: string;
    value: boolean;
    onValueChange: (v: boolean) => void;
    disabled?: boolean;
    isLast?: boolean;
}) {
    return (
        <View style={{
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            paddingHorizontal: 20, paddingVertical: 14,
            borderBottomWidth: isLast ? 0 : 1, borderBottomColor: Colors.border,
            opacity: disabled ? 0.4 : 1,
        }}>
            <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 15, color: Colors.text, fontWeight: "500" }}>{label}</Text>
                {desc && <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}>{desc}</Text>}
            </View>
            <Switch
                value={value}
                onValueChange={disabled ? undefined : onValueChange}
                trackColor={{ true: Colors.green }}
                thumbColor="#fff"
            />
        </View>
    );
}
