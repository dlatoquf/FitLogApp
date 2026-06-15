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
import { apiGet, apiPut } from "../../../hooks/useApi";

export default function MemberNotificationSettingsScreen() {
    const [loading, setLoading] = useState(true);
    const [notifPush, setNotifPush] = useState(true);
    const [notifSchedule, setNotifSchedule] = useState(true);
    const [notifPtPayment, setNotifPtPayment] = useState(true);
    const [notifFeedback, setNotifFeedback] = useState(true);
    const [notifWorkout, setNotifWorkout] = useState(true);
    const [notifBodyLog, setNotifBodyLog] = useState(true);
    const [notifNotice, setNotifNotice] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const serverSettings = await apiGet<{
                    notifFeedback: boolean; notifSchedule: boolean;
                    notifPtPayment: boolean; notifWorkout: boolean; notifNotice: boolean;
                }>("/api/member/notification-settings");
                const storedMaster = await AsyncStorage.getItem("notif_push_member");
                setNotifPush(storedMaster !== "false");
                setNotifFeedback(serverSettings.notifFeedback);
                setNotifSchedule(serverSettings.notifSchedule);
                setNotifPtPayment(serverSettings.notifPtPayment);
                setNotifWorkout(serverSettings.notifWorkout);
                setNotifNotice(serverSettings.notifNotice ?? true);
            } catch {
                const pairs = await AsyncStorage.multiGet([
                    "notif_push_member", "notif_schedule_member",
                    "notif_pt_payment", "notif_feedback", "notif_workout_member",
                    "notif_bodylog_member", "notif_notice_member",
                ]);
                if (pairs[0][1] !== null) setNotifPush(pairs[0][1] === "true");
                if (pairs[1][1] !== null) setNotifSchedule(pairs[1][1] === "true");
                if (pairs[2][1] !== null) setNotifPtPayment(pairs[2][1] === "true");
                if (pairs[3][1] !== null) setNotifFeedback(pairs[3][1] === "true");
                if (pairs[4][1] !== null) setNotifWorkout(pairs[4][1] === "true");
                if (pairs[5][1] !== null) setNotifBodyLog(pairs[5][1] === "true");
                if (pairs[6][1] !== null) setNotifNotice(pairs[6][1] === "true");
            }
            setLoading(false);
        };
        load();
    }, []);

    const sync = async (settings: Partial<{
        notifFeedback: boolean; notifSchedule: boolean;
        notifPtPayment: boolean; notifWorkout: boolean; notifNotice: boolean;
    }>) => {
        try { await apiPut("/api/member/notification-settings", settings); } catch {}
    };

    const checkMaster = (overrides: Partial<{
        notifWorkout: boolean; notifSchedule: boolean;
        notifPtPayment: boolean; notifFeedback: boolean; notifNotice: boolean;
    }>) => {
        const anyOn =
            (overrides.notifWorkout   ?? notifWorkout)   ||
            (overrides.notifSchedule  ?? notifSchedule)  ||
            (overrides.notifPtPayment ?? notifPtPayment) ||
            (overrides.notifFeedback  ?? notifFeedback)  ||
            (overrides.notifNotice    ?? notifNotice);
        setNotifPush(anyOn);
        AsyncStorage.setItem("notif_push_member", String(anyOn));
    };

    const handlePushToggle = async (v: boolean) => {
        setNotifPush(v);
        await AsyncStorage.setItem("notif_push_member", String(v));
        if (!v) {
            setNotifSchedule(false); setNotifPtPayment(false); setNotifFeedback(false);
            setNotifWorkout(false); setNotifBodyLog(false); setNotifNotice(false);
            await AsyncStorage.multiSet([
                ["notif_schedule_member","false"], ["notif_pt_payment","false"],
                ["notif_feedback","false"], ["notif_workout_member","false"],
                ["notif_bodylog_member","false"], ["notif_notice_member","false"],
            ]);
            await sync({ notifFeedback: false, notifSchedule: false, notifPtPayment: false, notifWorkout: false, notifNotice: false });
        } else {
            setNotifSchedule(true); setNotifPtPayment(true); setNotifFeedback(true);
            setNotifWorkout(true); setNotifBodyLog(true); setNotifNotice(true);
            await AsyncStorage.multiSet([
                ["notif_schedule_member","true"], ["notif_pt_payment","true"],
                ["notif_feedback","true"], ["notif_workout_member","true"],
                ["notif_bodylog_member","true"], ["notif_notice_member","true"],
            ]);
            await sync({ notifFeedback: true, notifSchedule: true, notifPtPayment: true, notifWorkout: true, notifNotice: true });
        }
    };

    const handleSchedule    = async (v: boolean) => { setNotifSchedule(v);   await AsyncStorage.setItem("notif_schedule_member", String(v)); await sync({ notifSchedule: v });   checkMaster({ notifSchedule: v }); };
    const handlePtPayment   = async (v: boolean) => { setNotifPtPayment(v);  await AsyncStorage.setItem("notif_pt_payment", String(v));      await sync({ notifPtPayment: v });  checkMaster({ notifPtPayment: v }); };
    const handleFeedback    = async (v: boolean) => { setNotifFeedback(v);   await AsyncStorage.setItem("notif_feedback", String(v));         await sync({ notifFeedback: v });   checkMaster({ notifFeedback: v }); };
    const handleWorkout     = async (v: boolean) => { setNotifWorkout(v);    await AsyncStorage.setItem("notif_workout_member", String(v));   await sync({ notifWorkout: v });    checkMaster({ notifWorkout: v }); };
    const handleBodyLog     = async (v: boolean) => { setNotifBodyLog(v);    await AsyncStorage.setItem("notif_bodylog_member", String(v));   if (v && !notifPush) handlePushToggle(true); };
    const handleNotice      = async (v: boolean) => { setNotifNotice(v);     await AsyncStorage.setItem("notif_notice_member", String(v));    await sync({ notifNotice: v });     checkMaster({ notifNotice: v }); };

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
                        onValueChange={handlePushToggle}
                        isLast
                    />

                    <View style={{ height: 8, backgroundColor: Colors.bgSub }} />

                    {/* 세부 알림 */}
                    <Row label="수업 알림"       desc="수업 확정·취소·리마인더 알림"          value={notifSchedule}   onValueChange={handleSchedule}  disabled={!notifPush} />
                    <Row label="PT 결제 알림"    desc="트레이너가 PT 횟수를 추가하면 알림"    value={notifPtPayment}  onValueChange={handlePtPayment} disabled={!notifPush} />
                    <Row label="공지사항 알림"   desc="트레이너가 공지사항을 등록하면 알림"   value={notifNotice}     onValueChange={handleNotice}    disabled={!notifPush} />
                    <Row label="피드백 알림"     desc="트레이너 운동·식단 피드백 알림"        value={notifFeedback}   onValueChange={handleFeedback}  disabled={!notifPush} />
                    <Row label="운동 기록 (PT)"  desc="트레이너가 PT 기록 등록 시 알림"       value={notifWorkout}    onValueChange={handleWorkout}   disabled={!notifPush} />
                    <Row label="바디로그 알림"   desc="트레이너가 바디로그 작성 시 알림"      value={notifBodyLog}    onValueChange={handleBodyLog}   disabled={!notifPush} isLast />
                </ScrollView>
            )}
        </View>
    );
}

function Row({ label, desc, value, onValueChange, disabled, isLast }: {
    label: string; desc?: string; value: boolean;
    onValueChange: (v: boolean) => void; disabled?: boolean; isLast?: boolean;
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
