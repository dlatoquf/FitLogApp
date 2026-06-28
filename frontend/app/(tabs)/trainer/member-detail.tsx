import AsyncStorage from "@react-native-async-storage/async-storage";
import KakaoShare from "@react-native-kakao/share";
import { useFocusEffect } from "@react-navigation/native";
import { ResizeMode, Video } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import Purchases from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../../constants/Colors";
import {
  API_URL,
  APP_STORE_URL,
  PLAY_STORE_URL,
  CLOUDINARY_UPLOAD_PRESET,
  CLOUDINARY_UPLOAD_URL,
  ENDPOINTS,
} from "../../../constants/api";
import { apiGet, getWeekDates, toDateKey } from "../../../hooks/useApi";
import { FitLog, Member } from "../../../types";

const SCREEN_W = Dimensions.get("window").width - 72;
const FULL_W = Dimensions.get("window").width;
const FULL_H = Dimensions.get("window").height;

interface BodyLog {
  id?: number;
  date: string;
  weight?: number;
  bodyFatMass?: number; // 체지방량 (kg)
  bodyFat?: number; // 체지방률 (%) - 자동계산
  muscleMass?: number;
  memo?: string;
}

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];

// 날짜(+시간) 포맷 헬퍼: "2024-01-15T14:30:00" → "2024.01.15 오후 2:30"
const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  if (dateStr.includes("T") || (dateStr.includes(" ") && dateStr.length > 10)) {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "오후" : "오전";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${y}.${m}.${day} ${ampm} ${h12}:${min}`;
  }
  return dateStr.replace(/-/g, ".");
};

// ── 운동 기록 전체보기 표 컴포넌트 ──────────────────────────────────────────────
const COL = {
  date: 86,
  type: 40,
  condition: 46,
  bodyPart: 72,
  exercise: 100,
  memo: 76,
  set: 32,
  weight: 54,
  reps: 38,
  feedback: 88,
  media: 52,
};
const ROW_H = 36;

interface SetRow {
  set: number;
  weight: string;
  reps: number;
}
interface SimpleEx {
  exercise: string;
  sets: SetRow[];
  memo?: string;
}
interface TypeGroup {
  type: "PT" | "OT" | "개인";
  exercises: SimpleEx[];
  totalRows: number;
  conditionScore?: number;
  painPoints?: string;
  feedback?: string;
  mediaList?: any[];
}
interface DateGroup {
  date: string;
  typeGroups: TypeGroup[];
  totalRows: number;
}
interface ExAllEntry {
  date: string;
  type: "PT" | "OT" | "개인";
  sets: SetRow[];
  memo?: string;
  conditionScore?: number;
  painPoints?: string;
  feedback?: string;
  mediaList?: any[];
}
interface ExAllGroup {
  exercise: string;
  entries: ExAllEntry[];
  totalRows: number;
}

function buildDateGroups(logs: FitLog[]): DateGroup[] {
  const sorted = logs
    .slice()
    .sort((a, b) =>
      String((b as any).date ?? (b as any).logDate ?? "").localeCompare(
        String((a as any).date ?? (a as any).logDate ?? ""),
      ),
    );
  type TypeData = {
    exercises: SimpleEx[];
    conditionScore?: number;
    painPoints?: string;
    feedback?: string;
    mediaList?: any[];
  };
  const dateMap = new Map<string, Map<string, TypeData>>();
  const dateTypeOrder = new Map<string, ("PT" | "OT" | "개인")[]>();

  for (const log of sorted) {
    const la = log as any;
    const date = String(la.date ?? la.logDate ?? "").slice(0, 10);
    const type: "PT" | "OT" | "개인" =
      la.workoutType === "PT" ? "PT" : la.workoutType === "OT" ? "OT" : "개인";
    if (!dateMap.has(date)) {
      dateMap.set(date, new Map());
      dateTypeOrder.set(date, []);
    }
    const typeMap = dateMap.get(date)!;
    const typeOrder = dateTypeOrder.get(date)!;
    if (!typeMap.has(type)) {
      typeMap.set(type, {
        exercises: [],
        conditionScore: la.conditionScore ?? undefined,
        painPoints: la.painPoints ?? undefined,
        feedback: la.feedback ?? undefined,
        mediaList: la.mediaList ?? [],
      });
      typeOrder.push(type);
    }
    const td = typeMap.get(type)!;
    for (const ex of log.exercises ?? []) {
      let e = td.exercises.find((e) => e.exercise === ex.name);
      if (!e) {
        e = {
          exercise: ex.name,
          sets: [],
          memo: (ex as any).memo ?? undefined,
        };
        td.exercises.push(e);
      }
      (ex.sets ?? []).forEach((s, si) => {
        e!.sets.push({
          set: (s as any).setNumber ?? si + 1,
          weight: s.weight > 0 ? `${s.weight}kg` : "맨몸",
          reps: s.reps,
        });
      });
    }
  }

  return Array.from(dateMap.entries()).map(([date, typeMap]) => {
    const typeGroups: TypeGroup[] = (dateTypeOrder.get(date) ?? []).map(
      (type) => {
        const td = typeMap.get(type)!;
        return {
          type,
          exercises: td.exercises,
          totalRows: td.exercises.reduce((s, e) => s + e.sets.length, 0),
          conditionScore: td.conditionScore,
          painPoints: td.painPoints,
          feedback: td.feedback,
          mediaList: td.mediaList,
        };
      },
    );
    return {
      date,
      typeGroups,
      totalRows: typeGroups.reduce((s, tg) => s + tg.totalRows, 0),
    };
  });
}

function buildExGroups(logs: FitLog[]): ExAllGroup[] {
  const map = new Map<string, ExAllEntry[]>();
  for (const log of logs) {
    const la = log as any;
    const date = String(la.date ?? la.logDate ?? "").slice(0, 10);
    const type: "PT" | "개인" = la.workoutType === "PT" ? "PT" : "개인";
    for (const ex of log.exercises ?? []) {
      if (!map.has(ex.name)) map.set(ex.name, []);
      const entries = map.get(ex.name)!;
      let e = entries.find((e) => e.date === date && e.type === type);
      if (!e) {
        e = {
          date,
          type,
          sets: [],
          memo: (ex as any).memo ?? undefined,
          conditionScore: la.conditionScore ?? undefined,
          painPoints: la.painPoints ?? undefined,
          feedback: la.feedback ?? undefined,
          mediaList: la.mediaList ?? [],
        };
        entries.push(e);
      }
      (ex.sets ?? []).forEach((s, si) => {
        e!.sets.push({
          set: (s as any).setNumber ?? si + 1,
          weight: s.weight > 0 ? `${s.weight}kg` : "맨몸",
          reps: s.reps,
        });
      });
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([exercise, entries]) => {
      const sorted = entries.slice().sort((a, b) => {
        const pa = a.painPoints ?? "";
        const pb = b.painPoints ?? "";
        if (pa !== pb) return pa.localeCompare(pb, "ko");
        return b.date.localeCompare(a.date);
      });
      return {
        exercise,
        entries: sorted,
        totalRows: sorted.reduce((s, e) => s + e.sets.length, 0),
      };
    });
}

const CELL_BORDER = "#e0e0e0";

function MergedCell({
  value,
  width,
  height,
  bold,
  color,
  center,
  bg,
}: {
  value: string;
  width: number;
  height: number;
  bold?: boolean;
  color?: string;
  center?: boolean;
  bg?: string;
}) {
  return (
    <View
      style={{
        width,
        height,
        justifyContent: "center",
        alignItems: center ? "center" : "flex-start",
        paddingHorizontal: 5,
        borderRightWidth: 1,
        borderRightColor: CELL_BORDER,
        backgroundColor: bg ?? "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: bold ? "700" : "400",
          color: color ?? Colors.text,
          textAlign: center ? "center" : "left",
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function TableHead({ cols }: { cols: { label: string; w: number }[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#f0f2f0",
        borderBottomWidth: 1.5,
        borderBottomColor: "#ccc",
      }}
    >
      {cols.map((c) => (
        <View
          key={c.label}
          style={{
            width: c.w,
            paddingVertical: 8,
            alignItems: "center",
            borderRightWidth: 1,
            borderRightColor: CELL_BORDER,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: "#555" }}>
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HistoryTable({
  logs,
  trainerPlan,
  onViewMedia,
}: {
  logs: FitLog[];
  trainerPlan: "FREE" | "PRO";
  onViewMedia?: (mediaList: any[]) => void;
}) {
  const [histTab, setHistTab] = useState<0 | 1>(0);

  // ── 날짜별 ──
  const [dateInput, setDateInput] = useState("");
  const [filteredDate, setFilteredDate] = useState<string | null>(null);

  // ── 운동종목별: 드롭다운 ──
  const [exInput, setExInput] = useState("");
  const [exDropOpen, setExDropOpen] = useState(false);
  const [selectedEx, setSelectedEx] = useState<string | null>(null);
  const [selectorHeight, setSelectorHeight] = useState(44);

  const allDateGroups = buildDateGroups(logs);
  const dateGroups = filteredDate
    ? allDateGroups.filter((dg) => dg.date === filteredDate)
    : allDateGroups;

  const allExGroups = buildExGroups(logs);
  const filteredExList = exInput.trim()
    ? allExGroups.filter((eg) => eg.exercise.includes(exInput.trim()))
    : allExGroups;
  const exGroups = selectedEx
    ? allExGroups.filter((eg) => eg.exercise === selectedEx)
    : allExGroups;

  const condText = (score?: number) =>
    score === 4
      ? "최상"
      : score === 3
        ? "좋음"
        : score === 2
          ? "보통"
          : score === 1
            ? "나쁨"
            : "";

  // ── 날짜별 테이블 렌더 ──
  const renderDateTable = () => (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View>
          <TableHead
            cols={[
              { label: "날짜", w: COL.date },
              { label: "구분", w: COL.type },
              { label: "부위", w: COL.bodyPart },
              { label: "운동명", w: COL.exercise },
              { label: "세트", w: COL.set },
              { label: "무게", w: COL.weight },
              { label: "횟수", w: COL.reps },
              { label: "메모", w: COL.memo },
              { label: "피드백", w: COL.feedback },
              { label: "컨디션", w: COL.condition },
              { label: "미디어", w: COL.media },
            ]}
          />
          {dateGroups.map((dg, di) => (
            <View
              key={dg.date}
              style={{
                flexDirection: "row",
                borderBottomWidth: 1.5,
                borderBottomColor: "#ccc",
              }}
            >
              <MergedCell
                value={dg.date}
                width={COL.date}
                height={ROW_H * dg.totalRows}
                bold
                center
                color={Colors.text}
                bg={di % 2 === 0 ? "#f8f9f8" : "#f2f4f2"}
              />
              <View>
                {dg.typeGroups.map((tg, ti) => (
                  <View
                    key={ti}
                    style={{
                      flexDirection: "row",
                      borderBottomWidth: ti < dg.typeGroups.length - 1 ? 1 : 0,
                      borderBottomColor: "#c8c8c8",
                    }}
                  >
                    <MergedCell
                      value={tg.type}
                      width={COL.type}
                      height={ROW_H * tg.totalRows}
                      bold
                      center
                      color={
                        tg.type === "PT"
                          ? Colors.green
                          : tg.type === "OT"
                            ? "#F97316"
                            : Colors.textMuted
                      }
                      bg={
                        tg.type === "PT"
                          ? "#f0fff4"
                          : tg.type === "OT"
                            ? "#FFF7ED"
                            : "#fafafa"
                      }
                    />
                    <MergedCell
                      value={tg.painPoints ?? ""}
                      width={COL.bodyPart}
                      height={ROW_H * tg.totalRows}
                      color={Colors.textSub}
                    />
                    <View>
                      {tg.exercises.map((ex, ei) => (
                        <View
                          key={ei}
                          style={{
                            flexDirection: "row",
                            borderBottomWidth:
                              ei < tg.exercises.length - 1 ? 1 : 0,
                            borderBottomColor: "#e8e8e8",
                          }}
                        >
                          <MergedCell
                            value={ex.exercise}
                            width={COL.exercise}
                            height={ROW_H * ex.sets.length}
                            bold
                            color={Colors.text}
                          />
                          <View>
                            {ex.sets.map((s, si) => (
                              <View
                                key={si}
                                style={{
                                  flexDirection: "row",
                                  height: ROW_H,
                                  alignItems: "center",
                                  borderBottomWidth:
                                    si < ex.sets.length - 1 ? 1 : 0,
                                  borderBottomColor: "#efefef",
                                }}
                              >
                                <View
                                  style={{
                                    width: COL.set,
                                    alignItems: "center",
                                    borderRightWidth: 1,
                                    borderRightColor: CELL_BORDER,
                                    height: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: Colors.textMuted,
                                    }}
                                  >
                                    {s.set}
                                  </Text>
                                </View>
                                <View
                                  style={{
                                    width: COL.weight,
                                    alignItems: "center",
                                    borderRightWidth: 1,
                                    borderRightColor: CELL_BORDER,
                                    height: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{ fontSize: 12, color: Colors.blue }}
                                  >
                                    {s.weight}
                                  </Text>
                                </View>
                                <View
                                  style={{
                                    width: COL.reps,
                                    alignItems: "center",
                                    borderRightWidth: 1,
                                    borderRightColor: CELL_BORDER,
                                    height: "100%",
                                    justifyContent: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: Colors.textSub,
                                    }}
                                  >
                                    {s.reps}회
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                          <MergedCell
                            value={ex.memo ?? ""}
                            width={COL.memo}
                            height={ROW_H * ex.sets.length}
                            color={Colors.textMuted}
                          />
                        </View>
                      ))}
                    </View>
                    <MergedCell
                      value={tg.feedback ?? ""}
                      width={COL.feedback}
                      height={ROW_H * tg.totalRows}
                      color={Colors.textMuted}
                    />
                    <MergedCell
                      value={condText(tg.conditionScore)}
                      width={COL.condition}
                      height={ROW_H * tg.totalRows}
                      center
                      color={Colors.textSub}
                    />
                    <View
                      style={{
                        width: COL.media,
                        height: ROW_H * tg.totalRows,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRightWidth: 1,
                        borderRightColor: CELL_BORDER,
                      }}
                    >
                      {(tg.mediaList ?? []).length > 0 ? (
                        <TouchableOpacity
                          onPress={() => onViewMedia?.(tg.mediaList ?? [])}
                          style={{
                            backgroundColor: Colors.green + "22",
                            borderRadius: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 4,
                            borderWidth: 1,
                            borderColor: Colors.green + "55",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: Colors.green,
                              fontWeight: "700",
                            }}
                          >
                            사진/영상 {(tg.mediaList ?? []).length}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                          -
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );

  // ── 운동종목별 테이블 렌더 ──
  const renderExTable = () => (
    <ScrollView
      style={{ flex: 1 }}
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View>
          <TableHead
            cols={[
              { label: "운동명", w: COL.exercise },
              { label: "날짜", w: COL.date },
              { label: "구분", w: COL.type },
              { label: "부위", w: COL.bodyPart },
              { label: "세트", w: COL.set },
              { label: "무게", w: COL.weight },
              { label: "횟수", w: COL.reps },
              { label: "메모", w: COL.memo },
              { label: "피드백", w: COL.feedback },
              { label: "컨디션", w: COL.condition },
              { label: "미디어", w: COL.media },
            ]}
          />
          {exGroups.map((eg, gi) => (
            <View
              key={eg.exercise}
              style={{
                flexDirection: "row",
                borderBottomWidth: 1.5,
                borderBottomColor: "#ccc",
              }}
            >
              <MergedCell
                value={eg.exercise}
                width={COL.exercise}
                height={ROW_H * eg.totalRows}
                bold
                color={Colors.text}
                bg={gi % 2 === 0 ? "#f8f9f8" : "#f2f4f2"}
              />
              <View>
                {eg.entries.map((en, ei) => (
                  <View
                    key={ei}
                    style={{
                      flexDirection: "row",
                      borderBottomWidth: ei < eg.entries.length - 1 ? 1 : 0,
                      borderBottomColor: "#d0d0d0",
                    }}
                  >
                    <MergedCell
                      value={en.date}
                      width={COL.date}
                      height={ROW_H * en.sets.length}
                      center
                      color={Colors.textSub}
                    />
                    <MergedCell
                      value={en.type}
                      width={COL.type}
                      height={ROW_H * en.sets.length}
                      bold
                      center
                      color={en.type === "PT" ? Colors.green : Colors.textMuted}
                      bg={en.type === "PT" ? "#f0fff4" : "#fafafa"}
                    />
                    <MergedCell
                      value={en.painPoints ?? ""}
                      width={COL.bodyPart}
                      height={ROW_H * en.sets.length}
                      color={Colors.textSub}
                    />
                    <View>
                      {en.sets.map((s, si) => (
                        <View
                          key={si}
                          style={{
                            flexDirection: "row",
                            height: ROW_H,
                            alignItems: "center",
                            borderBottomWidth: si < en.sets.length - 1 ? 1 : 0,
                            borderBottomColor: "#efefef",
                          }}
                        >
                          <View
                            style={{
                              width: COL.set,
                              alignItems: "center",
                              borderRightWidth: 1,
                              borderRightColor: CELL_BORDER,
                              height: "100%",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{ fontSize: 12, color: Colors.textMuted }}
                            >
                              {s.set}
                            </Text>
                          </View>
                          <View
                            style={{
                              width: COL.weight,
                              alignItems: "center",
                              borderRightWidth: 1,
                              borderRightColor: CELL_BORDER,
                              height: "100%",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontSize: 12, color: Colors.blue }}>
                              {s.weight}
                            </Text>
                          </View>
                          <View
                            style={{
                              width: COL.reps,
                              alignItems: "center",
                              borderRightWidth: 1,
                              borderRightColor: CELL_BORDER,
                              height: "100%",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{ fontSize: 12, color: Colors.textSub }}
                            >
                              {s.reps}회
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <MergedCell
                      value={en.memo ?? ""}
                      width={COL.memo}
                      height={ROW_H * en.sets.length}
                      color={Colors.textMuted}
                    />
                    <MergedCell
                      value={en.feedback ?? ""}
                      width={COL.feedback}
                      height={ROW_H * en.sets.length}
                      color={Colors.textMuted}
                    />
                    <MergedCell
                      value={condText(en.conditionScore)}
                      width={COL.condition}
                      height={ROW_H * en.sets.length}
                      center
                      color={Colors.textSub}
                    />
                    <View
                      style={{
                        width: COL.media,
                        height: ROW_H * en.sets.length,
                        justifyContent: "center",
                        alignItems: "center",
                        borderRightWidth: 1,
                        borderRightColor: CELL_BORDER,
                      }}
                    >
                      {(en.mediaList ?? []).length > 0 ? (
                        <TouchableOpacity
                          onPress={() => onViewMedia?.(en.mediaList ?? [])}
                          style={{
                            backgroundColor: Colors.green + "22",
                            borderRadius: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 4,
                            borderWidth: 1,
                            borderColor: Colors.green + "55",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: Colors.green,
                              fontWeight: "700",
                            }}
                          >
                            사진/영상 {(en.mediaList ?? []).length}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                          -
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* 내부 탭 */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 8,
        }}
      >
        {["날짜별", "운동종목별"].map((label, i) => (
          <TouchableOpacity
            key={label}
            onPress={() => setHistTab(i as 0 | 1)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: histTab === i ? Colors.green : Colors.bgSub,
              borderWidth: 1,
              borderColor: histTab === i ? Colors.green : Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color: histTab === i ? "#fff" : Colors.textMuted,
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 날짜별 탭 ── */}
      {histTab === 0 && (
        <View style={{ flex: 1 }}>
          {/* 날짜 입력 + 조회 버튼 */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={dateInput}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, "").slice(0, 8);
                    let formatted = digits;
                    if (digits.length > 4)
                      formatted = digits.slice(0, 4) + "-" + digits.slice(4);
                    if (digits.length > 6)
                      formatted =
                        digits.slice(0, 4) +
                        "-" +
                        digits.slice(4, 6) +
                        "-" +
                        digits.slice(6);
                    setDateInput(formatted);
                    if (digits.length === 0) setFilteredDate(null);
                  }}
                  placeholder="예) 20260508"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="numeric"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: filteredDate ? Colors.green : Colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 14,
                    paddingRight: dateInput.length > 0 ? 40 : 14,
                    paddingVertical: 9,
                    fontSize: 13,
                    color: Colors.text,
                  }}
                />
                {dateInput.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setDateInput("");
                      setFilteredDate(null);
                      Keyboard.dismiss();
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: 0,
                      bottom: 0,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                      ✕
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  const digits = dateInput.replace(/\D/g, "");
                  if (digits.length === 8) {
                    setFilteredDate(
                      digits.slice(0, 4) +
                        "-" +
                        digits.slice(4, 6) +
                        "-" +
                        digits.slice(6),
                    );
                  } else if (digits.length === 0) {
                    setFilteredDate(null);
                  }
                }}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}
                >
                  조회
                </Text>
              </TouchableOpacity>
            </View>
            {filteredDate !== null && (
              <Text style={{ fontSize: 12, color: Colors.green, marginTop: 6 }}>
                {filteredDate} 조회 중
              </Text>
            )}
            {filteredDate && dateGroups.length === 0 && (
              <Text
                style={{ fontSize: 13, color: Colors.textMuted, marginTop: 4 }}
              >
                운동 기록이 없어요
              </Text>
            )}
          </View>
          {renderDateTable()}
        </View>
      )}

      {/* ── 운동종목별 탭 ── */}
      {histTab === 1 && (
        <View style={{ flex: 1 }}>
          {/* 바깥 터치 시 드롭다운 닫기 — 테이블보다 위, 드롭다운보다 아래 */}
          {exDropOpen && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                Keyboard.dismiss();
                setExDropOpen(false);
                setExInput("");
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 5,
              }}
            />
          )}

          {/* 드롭다운 영역 — zIndex 10으로 backdrop 위에 */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 8,
              zIndex: 10,
            }}
          >
            {/* 선택창 */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                setExDropOpen((prev) => !prev);
              }}
              onLayout={(e) => setSelectorHeight(e.nativeEvent.layout.height)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor:
                  exDropOpen || selectedEx ? Colors.green : Colors.border,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 10,
                gap: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: selectedEx ? Colors.text : Colors.textPlaceholder,
                  flex: 1,
                }}
              >
                {selectedEx ?? "운동 종목 선택"}
              </Text>
              {selectedEx && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedEx(null);
                    setExInput("");
                    setExDropOpen(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                {exDropOpen ? "▲" : "▼"}
              </Text>
            </TouchableOpacity>

            {/* 드롭다운 리스트 — 절대 위치로 테이블 위에 float */}
            {exDropOpen && (
              <View
                style={{
                  position: "absolute",
                  top: selectorHeight + 16,
                  left: 16,
                  right: 16,
                  zIndex: 20,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 10,
                  backgroundColor: Colors.bg,
                  overflow: "hidden",
                  maxHeight: 280,
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 8,
                }}
              >
                {/* 검색 인풋 */}
                <View
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.border,
                  }}
                >
                  <TextInput
                    value={exInput}
                    onChangeText={setExInput}
                    placeholder="운동명 검색"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      fontSize: 13,
                      color: Colors.text,
                    }}
                  />
                </View>
                {/* 모두 + 운동명 목록 — keyboardShouldPersistTaps="always" 로 첫 탭에 바로 선택 */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                >
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedEx(null);
                      setExInput("");
                      setExDropOpen(false);
                    }}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      backgroundColor: !selectedEx
                        ? Colors.green + "12"
                        : Colors.bg,
                      borderBottomWidth: 1,
                      borderBottomColor: Colors.border,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: !selectedEx ? Colors.green : Colors.text,
                      }}
                    >
                      모두
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      {allExGroups.length}종목
                    </Text>
                  </TouchableOpacity>
                  {filteredExList.map((eg, idx) => (
                    <TouchableOpacity
                      key={eg.exercise}
                      onPress={() => {
                        Keyboard.dismiss();
                        setSelectedEx(eg.exercise);
                        setExInput("");
                        setExDropOpen(false);
                      }}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingHorizontal: 14,
                        paddingVertical: 11,
                        backgroundColor:
                          selectedEx === eg.exercise
                            ? Colors.green + "12"
                            : Colors.bg,
                        borderBottomWidth:
                          idx < filteredExList.length - 1 ? 1 : 0,
                        borderBottomColor: Colors.border,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color:
                            selectedEx === eg.exercise
                              ? Colors.green
                              : Colors.text,
                          fontWeight:
                            selectedEx === eg.exercise ? "700" : "400",
                        }}
                      >
                        {eg.exercise}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                        총 {eg.entries.length}회
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {filteredExList.length === 0 && (
                    <View style={{ alignItems: "center", paddingVertical: 20 }}>
                      <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                        &quot;{exInput}&quot; 결과 없음
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          {renderExTable()}
        </View>
      )}
    </View>
  );
}

export default function MemberDetailScreen() {
  const insets = useSafeAreaInsets();
  const {
    id,
    initialTab,
    openPtAdd,
    type,
    readOnlyUntil,
    date: notifDate,
  } = useLocalSearchParams<{
    id: string;
    initialTab?: string;
    openPtAdd?: string;
    type?: string; // "manual" = 미연동 회원
    readOnlyUntil?: string; // 이동된 회원: 해제일까지만 기록 열람
    date?: string; // 알림에서 진입 시 특정 날짜로 이동 (YYYY-MM-DD)
  }>();
  const memberId = Number(id);
  const isManual = type === "manual"; // 미연동 회원 여부
  const isReadOnly = !!readOnlyUntil; // 이동된 전 회원 — 기록 제한 모드

  const parseDateStr = (str: string): Date => {
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const calcWeekOffset = (target: Date): number => {
    const today = new Date();
    const todayMon = new Date(today);
    todayMon.setDate(
      today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1),
    );
    todayMon.setHours(0, 0, 0, 0);
    const targetMon = new Date(target);
    targetMon.setDate(
      target.getDate() - (target.getDay() === 0 ? 6 : target.getDay() - 1),
    );
    targetMon.setHours(0, 0, 0, 0);
    return Math.round(
      (targetMon.getTime() - todayMon.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );
  };

  const [member, setMember] = useState<Member | null>(null);
  // OT 회원: memo="OT" 이면서 ptTotal이 없거나 0인 경우 (addPt로 PT 등록된 경우는 PT 회원으로 취급)
  const isOt =
    isManual &&
    member?.memo === "OT" &&
    (!member?.ptTotal || member?.ptTotal === 0);
  const [loading, setLoading] = useState(true);
  // 현재 렌더링 중인 memberId 추적 — 이전 회원 데이터가 노출되는 것 방지
  const [renderedMemberId, setRenderedMemberId] = useState<number>(memberId);
  // 연동 회원은 운동로그 탭(0)에서 시작, 미연동 회원도 운동로그 탭(0)에서 시작
  const [tab, setTab] = useState(
    initialTab ? Number(initialTab) : 0,
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    notifDate ? parseDateStr(notifDate) : new Date(),
  );
  const [weekOffset, setWeekOffset] = useState(() =>
    notifDate ? calcWeekOffset(parseDateStr(notifDate)) : 0,
  );
  const weekDates = getWeekDates(weekOffset);
  const isToday = toDateKey(selectedDate) === toDateKey(new Date());

  const [dietPhotos, setDietPhotos] = useState<any[]>([]);
  const [dietPhotoRatios, setDietPhotoRatios] = useState<{
    [id: number]: number;
  }>({});
  const [personalFeedbackInputs, setPersonalFeedbackInputs] = useState<{
    [workoutId: number]: string;
  }>({});
  const [sendingPersonalFeedback, setSendingPersonalFeedback] = useState<{
    [workoutId: number]: boolean;
  }>({});
  const [dayFeedback, setDayFeedback] = useState<{
    id: number;
    trainerName: string;
    content: string;
    createdAt: string;
  } | null>(null);
  const [dayFeedbackInput, setDayFeedbackInput] = useState("");
  const [sendingDayFeedback, setSendingDayFeedback] = useState(false);

  const [weekDietDates, setWeekDietDates] = useState<Set<string>>(new Set());

  // 식단 사진 자연 비율 계산
  useEffect(() => {
    dietPhotos.forEach((photo) => {
      if (!photo.photoUrl || dietPhotoRatios[photo.id] !== undefined) return;
      Image.getSize(
        photo.photoUrl,
        (w, h) => {
          if (h > 0)
            setDietPhotoRatios((prev) => ({ ...prev, [photo.id]: w / h }));
        },
        () => setDietPhotoRatios((prev) => ({ ...prev, [photo.id]: 4 / 3 })),
      );
    });
  }, [dietPhotos]);

  const [fitLogs, setFitLogs] = useState<FitLog[]>([]);
  const [allFitLogs, setAllFitLogs] = useState<FitLog[]>([]);
  const [fitLogHistoryLoaded, setFitLogHistoryLoaded] = useState(false);
  const [exerciseSuggest, setExerciseSuggest] = useState<{
    ei: number;
    names: string[];
  } | null>(null);
  // 주 단위 캐시: weekKey → logs
  const [fitLogCache, setFitLogCache] = useState<{
    [weekKey: string]: FitLog[];
  }>({});
  const [fitLogsLoading, setFitLogsLoading] = useState(false);
  const didLoadWorkoutRef = useRef(false);
  const fetchingFitLogKeyRef = useRef<string | null>(null);
  const fetchingFitLogHistoryRef = useRef(false);
  const [exercises, setExercises] = useState<
    {
      name: string;
      sets: { setId?: number; _key: number; weight: string; reps: string }[];
      memo: string;
      mediaFiles: { uri: string; type: "image" | "video" }[];
      existingMediaList: {
        id: number;
        url: string;
        publicId: string;
        mediaType: string;
      }[];
    }[]
  >([
    {
      name: "",
      sets: [{ setId: undefined, _key: 0, weight: "", reps: "" }],
      memo: "",
      mediaFiles: [],
      existingMediaList: [],
    },
  ]);
  const [ptBodyParts, setPtBodyParts] = useState<string[]>([]);
  const [ptCondition, setPtCondition] = useState<number | null>(null);
  const [ptWorkoutFeedback, setPtWorkoutFeedback] = useState("");
  const [ptMissions, setPtMissions] = useState<string[]>([""]);
  const [lastSessionMissions, setLastSessionMissions] = useState<
    { id: number; content: string; status: string }[]
  >([]);
  const [memberMissions, setMemberMissions] = useState<
    {
      id: number;
      content: string;
      status: string;
      workoutLogId: number | null;
    }[]
  >([]);
  const [showFitLogForm, setShowFitLogForm] = useState(false);
  const [editingFitLogId, setEditingFitLogId] = useState<number | null>(null);
  const [savingFitLog, setSavingFitLog] = useState(false);
  const [trainerPlan, setTrainerPlan] = useState<"FREE" | "PRO">("FREE");
  const [trainerInviteCode, setTrainerInviteCode] = useState("");
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [smsPromptData, setSmsPromptData] = useState<{
    visible: boolean;
    exercises: {
      name: string;
      memo?: string;
      sets: { setNumber: number; weight: number; reps: number }[];
    }[];
    conditionScore: number | null;
    feedback: string;
    missions: string[];
  }>({
    visible: false,
    exercises: [],
    conditionScore: null,
    feedback: "",
    missions: [],
  });
  const [mediaGallery, setMediaGallery] = useState<
    { url: string; mediaType: string }[]
  >([]);
  const [mediaGalleryIndex, setMediaGalleryIndex] = useState(0);
  const [mediaDownloading, setMediaDownloading] = useState(false);
  const [expandedExerciseMediaKeys, setExpandedExerciseMediaKeys] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    mediaType: string;
  } | null>(null);

  const [bodyLogs, setBodyLogs] = useState<BodyLog[]>([]);

  // 바디로그 입력 폼 상태 (트레이너용 — growth.tsx와 동일 구조)
  const [blWeight, setBlWeight] = useState("");
  const [blBodyFatMass, setBlBodyFatMass] = useState("");
  const [blMuscleMass, setBlMuscleMass] = useState("");
  const [blSaving, setBlSaving] = useState(false);

  // 바디로그 수정 모달
  const [editingLog, setEditingLog] = useState<{ id: number; date: string; weight: string; bodyFatMass: string; muscleMass: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const autoBodyFat = (() => {
    const w = parseFloat(blWeight);
    const f = parseFloat(blBodyFatMass);
    if (w > 0 && f > 0) return Math.round((f / w) * 1000) / 10;
    return null;
  })();

  const [showPTEdit, setShowPTEdit] = useState(false);
  const [showPtDirectEdit, setShowPtDirectEdit] = useState(false);
  const [ptDirectForm, setPtDirectForm] = useState({
    remaining: "",
    total: "",
  });
  const [savingPtDirect, setSavingPtDirect] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuModalY = useRef(new Animated.Value(0)).current;
  const menuPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) menuModalY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          Animated.timing(menuModalY, {
            toValue: 400,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setMenuVisible(false);
            menuModalY.setValue(0);
          });
        } else {
          Animated.spring(menuModalY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ptForm, setPtForm] = useState({
    sessions: "0",
    remaining: "",
    amount: "",
    contractDate: todayStr,
    startDate: todayStr,
    endDate: "",
    memo: "",
  });

  // ⋮ 메뉴: 연동 회원 연결 해제
  const handleDisconnectMember = async () => {
    Alert.alert(
      "연결 해제",
      `${member?.user.name}님과의 연결을 해제할까요?\n회원의 데이터는 유지되지만 트레이너 연결이 끊겨요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "연결 해제",
          style: "destructive",
          onPress: async () => {
            try {
              setMemberActionLoading(true);
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(
                `${API_URL}/api/trainer/members/${memberId}/disconnect`,
                {
                  method: "POST",
                  headers: { Authorization: `Bearer ${jwt}` },
                },
              );
              if (!res.ok) throw new Error();
              Alert.alert("완료", "회원 연결이 해제됐어요.");
              router.back();
            } catch {
              Alert.alert("오류", "연결 해제 중 오류가 발생했어요.");
            } finally {
              setMemberActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ⋮ 메뉴: 미연동 회원 삭제
  const handleDeleteManualMember = async () => {
    Alert.alert(
      "회원 삭제",
      `${member?.user.name}님을 삭제할까요?\n운동 기록 등 모든 데이터가 삭제돼요.`,
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              setMemberActionLoading(true);
              const jwt = await AsyncStorage.getItem("jwt");
              const res = await fetch(
                `${API_URL}/api/trainer/manual-members/${memberId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${jwt}` },
                },
              );
              if (!res.ok) throw new Error();
              Alert.alert("완료", "회원이 삭제됐어요.");
              router.back();
            } catch {
              Alert.alert("오류", "삭제 중 오류가 발생했어요.");
            } finally {
              setMemberActionLoading(false);
            }
          },
        },
      ],
    );
  };

  // ⋮ 버튼 탭 → 바텀시트 열기
  const handleMemberMenu = () => {
    menuModalY.setValue(0);
    setMenuVisible(true);
  };

  const handleDownloadMedia = async (media: any) => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "갤러리 접근 권한이 필요해요.");
      return;
    }
    try {
      setMediaDownloading(true);
      const isVideo = media.mediaType === "VIDEO";
      const cleanUrl = media.url.split("?")[0];
      const urlExt = cleanUrl.split(".").pop()?.toLowerCase();
      const ext = isVideo
        ? ["mp4", "mov", "m4v"].includes(urlExt ?? "")
          ? urlExt
          : "mp4"
        : ["jpg", "jpeg", "png", "webp", "heic"].includes(urlExt ?? "")
          ? urlExt
          : "jpg";
      const cacheDir = FileSystem.cacheDirectory ?? "file:///tmp/";
      const fileUri = `${cacheDir}fitlog_${Date.now()}.${ext}`;
      const downloadResumable = FileSystem.createDownloadResumable(
        media.url,
        fileUri,
      );
      const result = await downloadResumable.downloadAsync();
      if (!result || result.status !== 200)
        throw new Error(`HTTP ${result?.status}`);
      await MediaLibrary.saveToLibraryAsync(result.uri);
      Alert.alert(
        "저장 완료",
        isVideo ? "영상이 갤러리에 저장됐어요." : "사진이 갤러리에 저장됐어요.",
      );
    } catch (e: any) {
      Alert.alert(
        "오류",
        `다운로드 중 오류가 발생했어요.\n${e?.message ?? ""}`,
      );
    } finally {
      setMediaDownloading(false);
    }
  };

  const closeMenuModal = () => {
    Animated.timing(menuModalY, {
      toValue: 400,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMenuVisible(false);
      menuModalY.setValue(0);
    });
  };

  const fetchMember = async () => {
    try {
      if (isManual) {
        // 미연동 회원: manual-members API 조회 → Member 형태로 변환
        const jwt = await AsyncStorage.getItem("jwt");
        const res = await fetch(
          `${API_URL}/api/trainer/manual-members/${memberId}`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          },
        );
        if (!res.ok) throw new Error();
        const mm = await res.json();
        setMember({
          id: mm.id,
          user: { id: 0, name: mm.name },
          ptRemaining: mm.ptRemaining ?? 0,
          ptTotal: mm.ptTotal ?? 0,
          phone: mm.phone,
          memo: mm.memo,
        } as any);
        setPtForm({
          sessions: "0",
          remaining: "",
          amount: "",
          contractDate: todayStr,
          startDate: todayStr,
          endDate: "",
          memo: "",
        });
      } else {
        const data = await apiGet<Member>(`/api/trainer/members/${memberId}`);
        setMember(data);
        setPtForm({
          sessions: "0",
          remaining: "",
          amount: "",
          contractDate: todayStr,
          startDate: todayStr,
          endDate: data.ptExpDate || "",
          memo: "",
        });
      }
    } catch {
      setMember({
        id: memberId,
        user: { id: memberId, name: "회원" },
        ptRemaining: 0,
        ptTotal: 0,
      } as any);
    }
  };

  const fetchDietPhotos = async () => {
    // 미연동 회원은 식단 기능 없음 → 호출 스킵
    if (isManual) return;
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/diet/photos/member/${memberId}?date=${toDateKey(selectedDate)}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setDietPhotos(data.photos ?? []);
        setDayFeedback(data.feedback ?? null);
        setDayFeedbackInput("");
      } else {
        setDietPhotos([]);
        setDayFeedback(null);
        setDayFeedbackInput("");
      }
    } catch {
      setDietPhotos([]);
      setDayFeedback(null);
      setDayFeedbackInput("");
    }
  };

  const sendPersonalFeedback = async (workoutId: number) => {
    const content = (personalFeedbackInputs[workoutId] ?? "").trim();
    if (!content) return;
    setSendingPersonalFeedback((prev) => ({ ...prev, [workoutId]: true }));
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/fitlog/${workoutId}/feedback`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ feedback: content }),
      });
      if (!res.ok) throw new Error("피드백 저장 실패");
      setPersonalFeedbackInputs((prev) => ({ ...prev, [workoutId]: "" }));
      fetchFitLogs(true);
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "피드백 저장 중 오류가 발생했어요.");
    } finally {
      setSendingPersonalFeedback((prev) => ({ ...prev, [workoutId]: false }));
    }
  };

  const sendDayFeedback = async () => {
    const content = dayFeedbackInput.trim();
    if (!content) return;
    Keyboard.dismiss();
    setSendingDayFeedback(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/diet/feedback/member/${memberId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ date: toDateKey(selectedDate), content }),
        },
      );
      if (!res.ok) throw new Error("피드백 전송 실패");
      fetchDietPhotos();
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "피드백 전송 중 오류가 발생했어요.");
    } finally {
      setSendingDayFeedback(false);
    }
  };

  // ── 바디로그 수정 저장 ───────────────────────────────────────────────────
  const saveEditBodyLog = async () => {
    if (!editingLog) return;
    if (!editingLog.weight) { Alert.alert("오류", "체중을 입력해주세요."); return; }
    setEditSaving(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const w = parseFloat(editingLog.weight);
      const f = editingLog.bodyFatMass ? parseFloat(editingLog.bodyFatMass) : null;
      const bodyFat = w > 0 && f && f > 0 ? Math.round((f / w) * 1000) / 10 : null;
      const payload: any = {
        date: editingLog.date,
        weight: w,
        bodyFatMass: f,
        bodyFat,
        muscleMass: editingLog.muscleMass ? parseFloat(editingLog.muscleMass) : null,
      };
      const url = isManual
        ? `${API_URL}${ENDPOINTS.bodylog.manual(memberId)}`.replace("manual", `manual/${editingLog.id}`.replace(/\/manual\/\d+/, "")).replace("/bodylog/manual", `/bodylog/manual/${editingLog.id}`)
        : `${API_URL}/api/bodylog/member/${memberId}/log/${editingLog.id}`;
      const fixedUrl = isManual
        ? `${API_URL}/api/bodylog/manual/${editingLog.id}`
        : `${API_URL}/api/bodylog/member/${memberId}/log/${editingLog.id}`;
      const res = await fetch(fixedUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("수정 실패");
      const data = await res.json();
      if (data.logs) {
        const processed: BodyLog[] = data.logs.map((l: any) => ({
          id: l.id,
          date: l.logDate || l.date || l.createdAt,
          weight: l.weight,
          bodyFatMass: l.bodyFatMass,
          bodyFat: l.bodyFatMass && l.weight ? Math.round((l.bodyFatMass / l.weight) * 1000) / 10 : l.bodyFat,
          muscleMass: l.muscleMass,
          memo: l.memo,
        }));
        setBodyLogs(processed);
      }
      setEditingLog(null);
      Alert.alert("완료", "바디로그가 수정됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setEditSaving(false);
    }
  };

  // ── 바디로그 저장 (트레이너 — growth.tsx와 동일 구조) ───────────────────
  const saveBodyLog = async () => {
    if (!blWeight) {
      Alert.alert("오류", "체중을 입력해주세요.");
      return;
    }
    setBlSaving(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const payload: any = {
        weight: parseFloat(blWeight),
        bodyFatMass: blBodyFatMass ? parseFloat(blBodyFatMass) : null,
        bodyFat: autoBodyFat,
        muscleMass: blMuscleMass ? parseFloat(blMuscleMass) : null,
      };

      const url = isManual
        ? `${API_URL}${ENDPOINTS.bodylog.manual(memberId)}`
        : `${API_URL}${ENDPOINTS.bodylog.member(memberId)}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("저장 실패");

      const data = await res.json();
      if (data.logs) {
        const processed: BodyLog[] = data.logs.map((l: any) => ({
          id: l.id,
          date: l.logDate || l.date || l.createdAt,
          weight: l.weight,
          bodyFatMass: l.bodyFatMass,
          bodyFat:
            l.bodyFatMass && l.weight
              ? Math.round((l.bodyFatMass / l.weight) * 1000) / 10
              : l.bodyFat,
          muscleMass: l.muscleMass,
          memo: l.memo,
        }));
        setBodyLogs(processed);
      }
      setBlWeight("");
      setBlBodyFatMass("");
      setBlMuscleMass("");
      Alert.alert("완료", "바디로그가 저장됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setBlSaving(false);
    }
  };

  // ── 전체 운동기록 PDF 생성 및 공유 ──────────────────────────────────────
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const exportWorkoutPdf = async () => {
    if (allFitLogs.length === 0) {
      Alert.alert("알림", "운동 기록이 없어요.");
      return;
    }
    setPdfGenerating(true);
    try {
      const memberName = member?.user?.name ?? "회원";
      const dateGroups = buildDateGroups(allFitLogs);

      const condLabel = (score?: number) =>
        score === 4
          ? "최상"
          : score === 3
            ? "좋음"
            : score === 2
              ? "보통"
              : score === 1
                ? "나쁨"
                : "";

      // rowspan 병합 테이블 빌드
      let tableRows = "";
      for (const dg of dateGroups) {
        let dateFirst = true;
        for (const tg of dg.typeGroups) {
          let typeFirst = true;
          for (const ex of tg.exercises) {
            let exFirst = true;
            for (const s of ex.sets) {
              let row = "<tr>";
              if (dateFirst) {
                row += `<td rowspan="${dg.totalRows}" class="date-cell">${dg.date.replace(/-/g, ".")}</td>`;
                dateFirst = false;
              }
              if (typeFirst) {
                const isPt = tg.type === "PT";
                row += `<td rowspan="${tg.totalRows}" class="type-cell ${isPt ? "type-pt" : "type-personal"}">${tg.type}</td>`;
                row += `<td rowspan="${tg.totalRows}" class="bodypart-cell">${tg.painPoints ?? ""}</td>`;
              }
              if (exFirst) {
                row += `<td rowspan="${ex.sets.length}" class="exercise-cell">${ex.exercise}</td>`;
              }
              row += `<td class="set-cell">${s.set}</td>`;
              row += `<td class="weight-cell">${s.weight}</td>`;
              row += `<td class="reps-cell">${s.reps}회</td>`;
              if (exFirst) {
                row += `<td rowspan="${ex.sets.length}" class="memo-cell">${ex.memo ?? ""}</td>`;
                exFirst = false;
              }
              if (typeFirst) {
                const fb = (tg.feedback ?? "")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/\n/g, "<br>");
                row += `<td rowspan="${tg.totalRows}" class="feedback-cell">${fb}</td>`;
                row += `<td rowspan="${tg.totalRows}" class="condition-cell">${condLabel(tg.conditionScore)}</td>`;
                typeFirst = false;
              }
              row += "</tr>";
              tableRows += row;
            }
          }
        }
      }

      const totalSessions = dateGroups.reduce(
        (s, dg) => s + dg.typeGroups.length,
        0,
      );

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; padding: 20px 16px; color: #1f2937; font-size: 12px; }
  h1 { font-size: 17px; font-weight: 800; margin-bottom: 3px; }
  .sub { font-size: 11px; color: #6b7280; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; }
  th { background: #f3f4f6; font-size: 10px; color: #6b7280; font-weight: 700; padding: 5px 6px; text-align: center; border: 1px solid #d1d5db; white-space: nowrap; }
  td { padding: 4px 6px; border: 1px solid #e5e7eb; vertical-align: middle; font-size: 11px; }
  .date-cell { background: #f8faf8; font-weight: 700; text-align: center; white-space: nowrap; color: #1f2937; }
  .type-cell { text-align: center; font-weight: 700; font-size: 11px; }
  .type-pt { background: #f0fff4; color: #1f2937; }
  .type-personal { background: #fafafa; color: #1f2937; }
  .bodypart-cell { color: #1f2937; font-size: 10px; }
  .exercise-cell { font-weight: 700; color: #1f2937; }
  .set-cell { text-align: center; color: #1f2937; width: 28px; }
  .weight-cell { text-align: center; color: #00897B; font-weight: 800; }
  .reps-cell { text-align: center; color: #00897B; font-weight: 800; }
  .memo-cell { color: #1f2937; font-size: 10px; }
  .feedback-cell { color: #1f2937; font-size: 10px; }
  .condition-cell { text-align: center; color: #1f2937; font-weight: 600; font-size: 11px; }
</style>
</head><body>
  <h1>${memberName}님 전체 운동 기록</h1>
  <p class="sub">총 ${dateGroups.length}일 · ${totalSessions}개 세션 · 출력일 ${new Date().toLocaleDateString("ko-KR")}</p>
  <table>
    <thead>
      <tr>
        <th>날짜</th><th>구분</th><th>부위</th><th>운동명</th>
        <th>세트</th><th>무게</th><th>횟수</th>
        <th>메모</th><th>피드백</th><th>컨디션</th>
      </tr>
    </thead>
    <tbody>${tableRows || "<tr><td colspan='10' style='text-align:center;color:#9ca3af;padding:12px;'>기록 없음</td></tr>"}</tbody>
  </table>
</body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${memberName} 운동기록`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("알림", "이 기기에서는 공유 기능을 사용할 수 없어요.");
      }
    } catch (e: any) {
      Alert.alert("오류", "PDF 생성 중 오류가 발생했어요.");
    } finally {
      setPdfGenerating(false);
    }
  };

  const fetchFitLogs = async (forceRefresh = false) => {
    // 주 단위 캐시 키
    const weekStart = getWeekDates(weekOffset)[0];
    const weekEnd = getWeekDates(weekOffset)[6];
    const weekKey = `${isManual ? "manual" : "linked"}_${memberId}_${toDateKey(weekStart)}_${toDateKey(weekEnd)}`;

    // 캐시 있으면 즉시 표시
    if (!forceRefresh && fitLogCache[weekKey]) {
      setFitLogs(fitLogCache[weekKey]);
      return;
    }

    // 같은 주차 요청이 이미 진행 중이면 중복 조회 방지
    if (!forceRefresh && fetchingFitLogKeyRef.current === weekKey) {
      return;
    }

    fetchingFitLogKeyRef.current = weekKey;
    setFitLogsLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      // 미연동 회원은 /api/fitlog/manual/{id}, 연동 회원은 /api/fitlog/member/{id}
      const logUrl = isManual
        ? `${API_URL}/api/fitlog/manual/${memberId}?from=${toDateKey(weekStart)}&to=${toDateKey(weekEnd)}`
        : `${API_URL}/api/fitlog/member/${memberId}?from=${toDateKey(weekStart)}&to=${readOnlyUntil ?? toDateKey(weekEnd)}`;
      const res = await fetch(logUrl, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error();
      const data: FitLog[] = await res.json();
      setFitLogCache((prev) => ({ ...prev, [weekKey]: data }));
      setFitLogs(data);
    } catch {
      setFitLogs([]);
    } finally {
      if (fetchingFitLogKeyRef.current === weekKey) {
        fetchingFitLogKeyRef.current = null;
      }
      setFitLogsLoading(false);
    }
  };

  const fetchWeekDietDates = async () => {
    // 미연동 회원은 식단 기능 없음 → 호출 스킵
    if (isManual) return;
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const weekDates = getWeekDates(weekOffset);
      // 주의 각 날짜별로 사진이 있는지 확인 (병렬 요청)
      const checks = await Promise.all(
        weekDates.map(async (d) => {
          const dateKey = toDateKey(d);
          const res = await fetch(
            `${API_URL}/api/diet/photos/member/${memberId}?date=${dateKey}`,
            { headers: { Authorization: `Bearer ${jwt}` } },
          );
          if (!res.ok) return null;
          const data = await res.json();
          const photos: any[] = data.photos ?? data;
          return photos.length > 0 ? dateKey : null;
        }),
      );
      setWeekDietDates(new Set(checks.filter(Boolean) as string[]));
    } catch {
      setWeekDietDates(new Set());
    }
  };

  const fetchFitLogHistory = async (forceRefresh = false) => {
    if (!forceRefresh && fitLogHistoryLoaded) return;
    if (!forceRefresh && fetchingFitLogHistoryRef.current) return;

    fetchingFitLogHistoryRef.current = true;

    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const histUrl = isManual
        ? `${API_URL}/api/fitlog/manual/${memberId}?from=2000-01-01&to=${toDateKey(new Date())}`
        : `${API_URL}/api/fitlog/member/${memberId}?from=2000-01-01&to=${readOnlyUntil ?? toDateKey(new Date())}`;
      const res = await fetch(histUrl, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) throw new Error();

      const data: FitLog[] = await res.json();
      setAllFitLogs(data);
      setFitLogHistoryLoaded(true);
    } catch (e) {
      console.log("운동 기록 전체 이력 조회 실패:", e);
    } finally {
      fetchingFitLogHistoryRef.current = false;
    }
  };

  // 날짜별 필터 (캐시된 데이터에서)
  const selectedDateKey = toDateKey(selectedDate);
  const dayFitLogs = fitLogs.filter(
    (l: any) => String(l.date ?? l.logDate).slice(0, 10) === selectedDateKey,
  );
  // PT 등록된 미연동 회원은 과거 OT 로그도 PT 섹션에 합쳐서 표시
  const dayPtLogs = dayFitLogs.filter(
    (l: any) => l.workoutType === "PT" || (!isOt && l.workoutType === "OT"),
  );
  const dayOtLogs = isOt
    ? dayFitLogs.filter((l: any) => l.workoutType === "OT")
    : [];

  const dayPersonalLogs = dayFitLogs.filter(
    (l: any) => l.workoutType === "PERSONAL",
  );

  const getExerciseNameSuggestions = (query: string): string[] => {
    if (!query.trim()) return [];
    const q = query.replaceAll(" ", "").toLowerCase();
    const source = allFitLogs.length > 0 ? allFitLogs : fitLogs;
    const names = new Set<string>();
    source.forEach((log: any) => {
      (log.exercises ?? []).forEach((ex: any) => {
        if (ex.name && ex.name.replaceAll(" ", "").toLowerCase().includes(q)) {
          names.add(ex.name);
        }
      });
    });
    return Array.from(names).slice(0, 5);
  };

  const normalizeExerciseName = (name: string) =>
    name.trim().replace(/\s+/g, " ").toLowerCase();

  const getLatestSameExercise = (exerciseName: string) => {
    const targetName = normalizeExerciseName(exerciseName);
    if (!targetName) return null;

    const selectedDateKey = toDateKey(selectedDate);

    const historySource = allFitLogs.length > 0 ? allFitLogs : fitLogs;

    const candidates = historySource
      .map((log: any) => ({
        ...log,
        date: String(log.date ?? log.logDate ?? log.log_date).slice(0, 10),
        workoutId: log.workoutId ?? log.workout_id ?? log.id ?? 0,
        exercises: log.exercises ?? log.sets ?? log.workoutSets ?? [],
      }))
      .filter((log: any) => log.date < selectedDateKey)
      .filter(
        (log: any) => Number(log.workoutId) !== Number(editingFitLogId ?? -1),
      )
      .flatMap((log: any) =>
        (log.exercises || [])
          .filter(
            (ex: any) => normalizeExerciseName(ex.name || "") === targetName,
          )
          .map((ex: any) => ({
            date: log.date,
            workoutId: log.workoutId,
            exercise: ex,
          })),
      )
      .sort((a: any, b: any) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return Number(b.workoutId) - Number(a.workoutId);
      });

    return candidates[0] ?? null;
  };

  const fetchBodyLogs = async () => {
    try {
      const url = isManual
        ? ENDPOINTS.bodylog.manual(memberId)
        : ENDPOINTS.bodylog.member(memberId);
      const raw = await apiGet<any[]>(url);
      // 체지방률 자동계산: bodyFatMass / weight * 100
      const processed: BodyLog[] = raw.map((l) => ({
        id: l.id,
        date: l.logDate || l.date || l.createdAt,
        weight: l.weight,
        bodyFatMass: l.bodyFatMass,
        bodyFat:
          l.bodyFatMass && l.weight
            ? Math.round((l.bodyFatMass / l.weight) * 1000) / 10
            : l.bodyFat,
        muscleMass: l.muscleMass,
        memo: l.memo,
      }));
      setBodyLogs(processed);
    } catch {
      setBodyLogs([]);
    }
  };

  const fetchMemberMissions = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const url = isManual
        ? `${API_URL}/api/missions/manual-member/${memberId}`
        : `${API_URL}/api/missions/member/${memberId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return;
      const data: any[] = await res.json();
      setMemberMissions(
        data.map((m) => ({
          id: m.id,
          content: m.content,
          status: m.status ?? "PENDING",
          workoutLogId: m.workoutLogId ?? null,
        })),
      );
    } catch {
      setMemberMissions([]);
    }
  };

  // 화면 진입할 때마다 initialTab으로 리셋 (홈 오늘수업 → 항상 운동로그 탭)
  useFocusEffect(
    useCallback(() => {
      if (initialTab !== undefined) {
        setTab(Number(initialTab));
      } else {
        // 화면 복귀 시 기본 탭으로 초기화: 미연동=운동로그(1), 연동=식단로그(0)
        setTab(isManual ? 1 : 0);
      }
      // 화면 복귀 시 운동로그 캘린더 날짜를 오늘로 리셋
      setSelectedDate(new Date());
      setWeekOffset(0);
      // 화면 복귀 시 최신 PT 잔여 등 회원 데이터 갱신
      fetchMember();
      fetchFitLogs(true);
      fetchFitLogHistory(true);
    }, [initialTab, isManual, memberId]),
  );

  // PT 미등록 뱃지에서 진입 시 PT 추가 모달 자동 오픈
  useEffect(() => {
    if (openPtAdd === "true") {
      setShowPTEdit(true);
    }
  }, [openPtAdd]);

  // 트레이너 플랜 조회
  useEffect(() => {
    (async () => {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/trainer/home`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const d = await res.json();
        setTrainerPlan(
          (d?.plan ?? "FREE").toUpperCase() === "PRO" ? "PRO" : "FREE",
        );
        setTrainerInviteCode(
          String(
            d?.trainerCode ?? d?.inviteCode ?? d?.referralCode ?? d?.code ?? "",
          ),
        );
      }
    })();
  }, []);

  // memberId 바뀌는 즉시 이전 회원 데이터 숨김 (렌더 전에 동기 실행)
  useLayoutEffect(() => {
    setRenderedMemberId(-1);
    setMember(null);
    setLoading(true);
  }, [memberId]);

  // 회원 기본 정보 + 최신 목표
  useEffect(() => {
    const init = async () => {
      // 다른 회원 상세로 이동할 때 이전 회원에서 선택했던 날짜/주차가 남지 않도록 초기화
      // 알림에서 진입 시 해당 날짜로 이동
      if (notifDate) {
        const d = parseDateStr(notifDate);
        setSelectedDate(d);
        setWeekOffset(calcWeekOffset(d));
      } else {
        setSelectedDate(new Date());
        setWeekOffset(0);
      }
      resetFitLogForm();
      // 회원 변경 시 상태 완전 초기화 (비동기 ref 포함)
      setRenderedMemberId(-1); // 즉시 이전 회원 데이터 숨김
      setMember(null);
      setFitLogs([]);
      setAllFitLogs([]);
      setFitLogCache({});
      setFitLogHistoryLoaded(false);
      setExpandedExerciseMediaKeys({});
      didLoadWorkoutRef.current = false;
      fetchingFitLogHistoryRef.current = false;
      fetchingFitLogKeyRef.current = null;
      // 탭도 파라미터 기준으로 리셋
      setTab(initialTab ? Number(initialTab) : 0);
      await fetchMember();
      setRenderedMemberId(memberId); // 새 회원 데이터 준비 완료
      setLoading(false);
      // 탭과 무관하게 항상 운동 기록 로드 (캘린더 점 표시용)
      didLoadWorkoutRef.current = true;
      fetchFitLogs();
      fetchFitLogHistory();
      fetchMemberMissions();
    };

    init();
  }, [memberId]);

  // 알림에서 날짜가 변경될 때 캘린더만 해당 날짜로 이동 (회원이 같아도 적용)
  useEffect(() => {
    if (notifDate) {
      const d = parseDateStr(notifDate);
      setSelectedDate(d);
      setWeekOffset(calcWeekOffset(d));
    }
  }, [notifDate]);

  // 탭 전환 시 데이터 로드 (운동=0, 식단=1, 바디=2)
  useEffect(() => {
    if (tab === 0) {
      if (!didLoadWorkoutRef.current) {
        didLoadWorkoutRef.current = true;
        fetchFitLogs();
        fetchFitLogHistory();
      }
    } else if (tab === 2) {
      fetchBodyLogs();
    }
  }, [tab]);

  // 식단 탭: 날짜 변경 시 사진 조회
  useEffect(() => {
    if (tab === 1) {
      fetchDietPhotos();
    }
  }, [tab, selectedDate, memberId]);

  // 운동 탭: 주 변경 시만
  useEffect(() => {
    if (tab !== 0 || !didLoadWorkoutRef.current) return;
    fetchFitLogs();
    fetchWeekDietDates();
  }, [weekOffset]);

  // 첫 진입 시 식단 날짜 로드
  useEffect(() => {
    fetchWeekDietDates();
  }, [memberId]);

  const resetFitLogForm = () => {
    setExercises([
      {
        name: "",
        sets: [{ setId: undefined, _key: Date.now(), weight: "", reps: "" }],
        memo: "",
        mediaFiles: [],
        existingMediaList: [],
      },
    ]);
    setPtBodyParts([]);
    setPtCondition(null);
    setPtWorkoutFeedback("");
    setPtMissions([""]);
    setEditingFitLogId(null);
    setShowFitLogForm(false);
  };

  const startEditFitLog = (log: any) => {
    setEditingFitLogId(log.id ?? log.workoutId ?? null);
    setExercises(
      (log.exercises ?? []).map((ex: any) => ({
        name: ex.name ?? "",
        memo: ex.memo ?? "",
        mediaFiles: [],
        existingMediaList: (ex.mediaList ?? (ex.media ? [ex.media] : [])).map(
          (m: any) => ({
            id: m.id,
            url: m.url ?? m.mediaUrl ?? m.secureUrl,
            publicId: m.publicId ?? "",
            mediaType: m.mediaType ?? "IMAGE",
          }),
        ),
        sets: (ex.sets ?? []).map((s: any, si: number) => ({
          setId: s.setId ?? s.id ?? undefined,
          _key: s.setId ?? s.id ?? Date.now() + si,
          weight: s.weight != null ? String(s.weight) : "",
          reps: s.reps != null ? String(s.reps) : "",
        })),
      })),
    );
    const rawPainPoints = log.painPoints ?? "";
    setPtBodyParts(
      rawPainPoints
        ? rawPainPoints
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [],
    );
    setPtCondition(log.conditionScore ?? null);
    setPtWorkoutFeedback(log.feedback ?? "");
    setShowFitLogForm(true);
  };

  const uploadToCloudinary = async (
    uri: string,
    type: "image" | "video",
  ): Promise<{ url: string; publicId: string; mediaType: string }> => {
    let uploadUri = uri;
    let contentType = "image/jpeg";

    if (type === "image") {
      try {
        const result = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
        );
        uploadUri = result.uri;
      } catch {
        // 압축 실패 시 원본 사용
      }
    } else {
      const ext = uri.split(".").pop()?.toLowerCase();
      contentType = ext === "mov" ? "video/quicktime" : "video/mp4";
    }

    const jwt = await AsyncStorage.getItem("jwt");
    const { uploadToS3 } = await import("@/utils/s3Upload");
    const publicUrl = await uploadToS3(uploadUri, contentType, "fitlog", jwt ?? "");

    return {
      url: publicUrl,
      publicId: publicUrl,
      mediaType: type.toUpperCase(),
    };
  };

  const handlePickMedia = async (exerciseIndex: number) => {
    const ex = exercises[exerciseIndex];
    const totalCount = ex.mediaFiles.length + ex.existingMediaList.length;
    if (totalCount >= 3) {
      Alert.alert(
        "최대 3개",
        "운동당 사진/영상은 최대 3개까지 추가할 수 있어요.",
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("권한 필요", "사진/영상 접근 권한이 필요해요.");
      return;
    }

    const addAsset = async (asset: any) => {
      // 파일 크기 1GB 초과 시 경고
      if (asset.fileSize && asset.fileSize > 1024 * 1024 * 1024) {
        Alert.alert("파일 크기 초과", "영상 파일이 1GB를 초과해요. 더 짧은 영상을 선택해주세요.");
        return;
      }
      const u = [...exercises];
      u[exerciseIndex].mediaFiles = [
        ...u[exerciseIndex].mediaFiles,
        { uri: asset.uri, type: asset.type === "video" ? "video" : "image" },
      ];
      setExercises(u);
    };

    Alert.alert("사진/영상 추가", "어떤 방식으로 추가할까요?", [
      {
        text: "카메라로 촬영",
        onPress: async () => {
          const camStatus = await ImagePicker.requestCameraPermissionsAsync();
          if (camStatus.status !== "granted") {
            Alert.alert("권한 필요", "카메라 접근 권한이 필요해요.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.8,
            videoMaxDuration: 120,
          });
          if (!result.canceled && result.assets.length > 0)
            addAsset(result.assets[0]);
        },
      },
      {
        text: "갤러리에서 선택",
        onPress: async () => {
          const remaining = 3 - totalCount;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            quality: 0.8,
            videoMaxDuration: 120,
            allowsMultipleSelection: true,
            selectionLimit: remaining,
          });
          if (!result.canceled && result.assets.length > 0) {
            result.assets.forEach((asset) => addAsset(asset));
          }
        },
      },
      { text: "취소", style: "cancel" },
    ]);
  };

  const removeMedia = (
    exerciseIndex: number,
    type: "new" | "existing",
    fileIndex: number,
  ) => {
    const u = [...exercises];
    if (type === "new") {
      u[exerciseIndex].mediaFiles = u[exerciseIndex].mediaFiles.filter(
        (_, i) => i !== fileIndex,
      );
    } else {
      u[exerciseIndex].existingMediaList = u[
        exerciseIndex
      ].existingMediaList.filter((_, i) => i !== fileIndex);
    }
    setExercises(u);
  };

  const checkScheduleAndSave = async () => {
    if (editingFitLogId || isManual) {
      // 수정 중이거나 미연동 회원이면 스케줄 체크 없이 바로 저장
      saveFitLog();
      return;
    }
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const dateKey = toDateKey(selectedDate);
      const weekStart = toDateKey(
        new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7),
        ),
      );
      const res = await fetch(
        `${API_URL}/api/schedule/calendar?weekStart=${weekStart}`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        },
      );
      if (res.ok) {
        const slots: any[] = await res.json();
        const hasSchedule = slots.some(
          (s) =>
            s.date === dateKey &&
            s.status === "CONFIRMED" &&
            s.memberId === memberId,
        );
        if (!hasSchedule) {
          Alert.alert(
            "스케줄 없음",
            `${dateKey}에 이 회원의 확정된 수업이 없어요.\n그래도 등록할까요?`,
            [
              { text: "취소", style: "cancel" },
              { text: "등록", onPress: saveFitLog },
            ],
          );
          return;
        }
      }
    } catch (_) {}
    saveFitLog();
  };

  const saveFitLog = async () => {
    const valid = exercises.filter((ex) => ex.name.trim());
    if (!valid.length) {
      Alert.alert("오류", "운동명을 입력해주세요.");
      return;
    }
    setSavingFitLog(true);
    try {
      // 운동별 Cloudinary 업로드
      const exercisesWithMedia = await Promise.all(
        valid.map(async (ex) => {
          const uploadedUrls = await Promise.all(
            (ex.mediaFiles ?? []).map((f) => uploadToCloudinary(f.uri, f.type)),
          );
          return {
            name: ex.name,
            memo: ex.memo?.trim() || undefined,
            mediaUrls: uploadedUrls.filter(Boolean),
            sets: ex.sets
              .filter((s) => s.weight || s.reps)
              .map((s, i) => ({
                setId: s.setId ?? undefined,
                setNumber: i + 1,
                weight: parseFloat(s.weight) || 0,
                reps: parseInt(s.reps) || 0,
              })),
          };
        }),
      );

      const jwt = await AsyncStorage.getItem("jwt");
      // 미연동 회원: /api/fitlog/manual/{id} / 연동 회원: /api/fitlog or /api/fitlog/{id}
      const url = editingFitLogId
        ? `${API_URL}/api/fitlog/${editingFitLogId}`
        : isManual
          ? `${API_URL}/api/fitlog/manual/${memberId}`
          : `${API_URL}${ENDPOINTS.fitlog.create}`;

      // 수정 시 기존 미디어 유지할 ID 목록 수집 (없으면 서버에서 전부 삭제됨)
      const keepMediaIds = editingFitLogId
        ? valid.flatMap((ex) => (ex.existingMediaList ?? []).map((m) => m.id))
        : [];

      const body: any = {
        date: toDateKey(selectedDate),
        conditionScore: ptCondition ?? undefined,
        painPoints: ptBodyParts.length > 0 ? ptBodyParts.join(", ") : undefined,
        feedback: ptWorkoutFeedback.trim() || undefined,
        missions: ptMissions.filter((m) => m.trim().length > 0),
        exercises: exercisesWithMedia,
        keepMediaIds,
        ...(isManual && !editingFitLogId ? { workoutType: isOt ? "OT" : "PT" } : {}),
      };
      // 연동 회원만 memberId 필드 전달 (미연동은 URL로 식별)
      if (!isManual && !editingFitLogId) body.memberId = memberId;

      const res = await fetch(url, {
        method: editingFitLogId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const message = await res.text();
        if (editingFitLogId && res.status === 404) {
          throw new Error("운동 기록 수정 API를 찾지 못했어요.");
        }
        throw new Error(message || "PT 기록 저장 실패");
      }
      // 미연동 회원 & 신규 저장 → 문자 발송 여부 모달로 물어보기
      if (isManual && !editingFitLogId) {
        const savedExercises = valid.map((ex) => ({
          name: ex.name,
          memo: ex.memo?.trim() || undefined,
          sets: ex.sets
            .filter((s) => s.weight || s.reps)
            .map((s, i) => ({
              setNumber: i + 1,
              weight: parseFloat(s.weight) || 0,
              reps: parseInt(s.reps) || 0,
            })),
        }));
        setSmsPromptData({
          visible: true,
          exercises: savedExercises,
          conditionScore: ptCondition,
          feedback: ptWorkoutFeedback.trim(),
          missions: ptMissions.filter((m) => m.trim().length > 0),
        });
      } else {
        Alert.alert(
          "완료",
          editingFitLogId
            ? "PT 수업 기록이 수정됐어요!"
            : "PT 수업 기록이 등록됐어요!",
        );
      }
      resetFitLogForm();
      // 캐시 무효화 후 재조회
      setFitLogCache({});
      setFitLogHistoryLoaded(false);
      await fetchMember();
      fetchFitLogs(true);
      fetchFitLogHistory(true);
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setSavingFitLog(false);
    }
  };

  // 미연동 회원에게 문자(SMS) / 카카오 알림톡 발송
  const sendAlimtalk = async (
    exercises: {
      name: string;
      memo?: string;
      sets: { setNumber: number; weight: number; reps: number }[];
    }[],
    conditionScore?: number | null,
    feedback?: string,
    missions?: string[],
  ) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(
        `${API_URL}/api/fitlog/manual/${memberId}/notify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({
            exercises,
            conditionScore: conditionScore ?? null,
            feedback: feedback || null,
            missions: missions?.length ? missions : null,
          }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert("발송 완료", "문자(SMS)가 전송됐어요!");
      } else {
        Alert.alert(
          "발송 실패",
          data.message ?? "문자 전송 중 오류가 발생했어요.",
        );
      }
    } catch {
      Alert.alert("오류", "문자 전송 중 오류가 발생했어요.");
    }
  };

  const buildManualWorkoutShareText = (
    data: typeof smsPromptData,
    code?: string,
  ) => {
    const memberName = member?.user?.name ?? "회원";

    const exerciseNames = Array.from(
      new Set((data.exercises ?? []).map((ex) => ex.name).filter(Boolean)),
    );

    const exerciseText = exerciseNames.length
      ? exerciseNames.map((name) => `- ${name}`).join("\n")
      : "- 오늘 운동 기록";

    const codeText = code
      ? `\n\n아직 FitLog 앱이 없으시다면 설치 후 회원가입 시\n트레이너 코드 [${code}] 를 입력해주세요.`
      : "";

    return `${memberName}님, 오늘 운동로그가 작성되었습니다.\n\n오늘 진행한 운동\n\n${exerciseText}\n\n자세한 세트, 무게, 횟수와 피드백은\nFitLog 앱에서 확인할 수 있어요.${codeText}`;
  };

  // OT 체험 수업 카카오 공유 메시지 빌드
  const buildOtShareText = () => {
    const memberName = member?.user?.name ?? "회원";

    const exerciseNames = Array.from(
      new Set(
        (smsPromptData.exercises ?? []).map((ex) => ex.name).filter(Boolean),
      ),
    );
    const exerciseText = exerciseNames.length
      ? exerciseNames.map((name) => `- ${name}`).join("\n")
      : "- 오늘 운동 기록";

    return `${memberName}님, 오늘 체험 수업 정말 수고하셨어요!\n\n오늘 진행한 운동\n\n${exerciseText}\n\n자세한 세트, 무게, 횟수와 피드백은 트레이너에게 직접 확인해보세요.\n\n오늘 경험하신 것처럼 체계적인 PT를 꾸준히 받으시면 목표에 훨씬 빠르게 가까워질 수 있어요.`;
  };

  const shareManualWorkoutLog = async () => {
    const code = trainerInviteCode.trim();
    const text = isOt
      ? buildOtShareText()
      : buildManualWorkoutShareText(smsPromptData, code || undefined);
    // OT는 앱스토어 링크 없음 — PT 미연동만 앱스토어 링크 포함
    const inviteUrl = isOt
      ? "https://fitlog.app"
      : "https://apps.apple.com/app/fitlog/id6769366090";
    const executionParams = {
      memberId: String(memberId),
      ...(isManual ? { memberType: "manual" } : {}),
    };
    setSmsPromptData((p) => ({ ...p, visible: false }));
    const safeText = String(text ?? "");
    const safeUrl = String(inviteUrl ?? "https://fitlog.app");
    console.log("[Kakao] shareTextTemplate 시작");
    console.log("[Kakao] safeText:", safeText);
    console.log("[Kakao] safeUrl:", safeUrl);
    try {
      const result = await KakaoShare.shareTextTemplate({
        template: {
          text: safeText,
          link: {
            mobileWebUrl: safeUrl,
            webUrl: safeUrl,
            ...(executionParams && {
              iosExecutionParams: executionParams,
              androidExecutionParams: executionParams,
            }),
          },
        },
      });
      console.log("[Kakao] 성공:", JSON.stringify(result));
    } catch (e: any) {
      console.log("[Kakao] 실패 전체:", JSON.stringify(e));
      console.log("[Kakao] code:", e?.code);
      console.log("[Kakao] message:", e?.message);
      console.log("[Kakao] domain:", e?.domain);
      console.log("[Kakao] userInfo:", JSON.stringify(e?.userInfo));
      Alert.alert(
        "카카오 공유 실패",
        `code: ${e?.code ?? "-"}\ndomain: ${e?.domain ?? "-"}\nmessage: ${e?.message ?? String(e)}\nuserInfo: ${JSON.stringify(e?.userInfo ?? {})}`,
      );
    }
  };

  const handleInviteCopy = () => {
    const code = trainerInviteCode ?? "";
    Clipboard.setStringAsync(code);
    Alert.alert("복사됐어요!", `트레이너 코드 ${code} 가 복사됐어요.`);
  };

  const handleInviteKakao = async () => {
    const code = trainerInviteCode ?? "";
    const trainerName = member?.user?.name ?? "트레이너";
    const safeText = String(`안녕하세요! FitLog 앱에서 아래 트레이너 코드를 입력하면 바로 연결돼요!\n\n트레이너 코드: ${code}`);
    const safeUrl = String(APP_STORE_URL ?? "https://fitlog.app");
    try {
      await KakaoShare.shareTextTemplate({
        template: {
          text: safeText,
          link: { mobileWebUrl: safeUrl, webUrl: safeUrl },
          buttonTitle: "FitLog 앱 설치하기",
        },
      });
    } catch (e: any) {
      Alert.alert("카카오 공유 실패", e?.message ?? String(e));
    }
  };

  const getWorkoutConditionText = (score?: number | null) =>
    score === 4
      ? "최상"
      : score === 3
        ? "좋음"
        : score === 2
          ? "보통"
          : score === 1
            ? "나쁨"
            : "";

  const buildWorkoutCopyText = (log: any) => {
    const logDate = String(log.date ?? log.logDate ?? selectedDateKey).slice(
      0,
      10,
    );
    const workoutType = log.workoutType === "PT" ? "PT 수업" : "개인 운동";
    const condition = getWorkoutConditionText(log.conditionScore);
    const painPoints = log.painPoints ? `\n운동 부위: ${log.painPoints}` : "";
    const feedback = log.feedback ? `\n\n피드백\n${log.feedback}` : "";

    const exerciseText = (log.exercises ?? [])
      .map((ex: any) => {
        const setsText = (ex.sets ?? [])
          .map((s: any, i: number) => {
            const setNumber = s.setNumber ?? i + 1;
            const weight = Number(s.weight) > 0 ? `${s.weight}kg` : "맨몸";
            const reps = s.reps ? `${s.reps}회` : "";
            return `  ${setNumber}세트 ${weight}${reps ? ` x ${reps}` : ""}`;
          })
          .join("\n");
        const memo = ex.memo ? `\n  메모: ${ex.memo}` : "";
        return `- ${ex.name ?? "운동"}\n${setsText}${memo}`;
      })
      .join("\n\n");

    return `[FitLog 운동 기록]\n${member?.user?.name ?? "회원"}님\n날짜: ${logDate}\n구분: ${workoutType}${painPoints}${condition ? `\n컨디션: ${condition}` : ""}\n\n${exerciseText || "운동 기록 없음"}${feedback}`;
  };

  const copyWorkoutLogText = async (log: any) => {
    try {
      await Clipboard.setStringAsync(buildWorkoutCopyText(log));
      Alert.alert(
        "복사 완료",
        "운동 기록이 복사됐어요.\n회원에게 그대로 붙여넣어 보낼 수 있어요.",
      );
    } catch {
      Alert.alert("오류", "운동 기록 복사 중 오류가 발생했어요.");
    }
  };

  const shareWorkoutLog = async (log: any) => {
    try {
      const storeLinks = `\n\n📱 FitLog 앱 다운로드\niOS: ${APP_STORE_URL}\nAndroid: ${PLAY_STORE_URL}`;
      await Share.share({
        message: buildWorkoutCopyText(log) + storeLinks,
        title: "운동 기록 공유",
      });
    } catch (e: any) {
      if (e.message !== "The user did not share") {
        Alert.alert("오류", "공유 중 오류가 발생했어요.");
      }
    }
  };
  const savePT = async () => {
    const isFirst = !member?.ptTotal || member.ptTotal === 0;
    if (!ptForm.sessions || Number(ptForm.sessions) <= 0) {
      Alert.alert(
        "오류",
        isFirst
          ? "첫 PT 결제 수를 입력해주세요."
          : "추가할 횟수를 입력해주세요.",
      );
      return;
    }
    if (
      isFirst &&
      ptForm.remaining !== "" &&
      Number(ptForm.remaining) > Number(ptForm.sessions)
    ) {
      Alert.alert("오류", "현재 잔여 PT 수는 첫 PT 결제 수보다 클 수 없어요.");
      return;
    }
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const amountNum = ptForm.amount
        ? Number(ptForm.amount.replace(/,/g, ""))
        : undefined;
      const body: any = {
        sessions: Number(ptForm.sessions),
        startDate: ptForm.startDate || undefined,
        endDate: ptForm.endDate || undefined,
        memo: ptForm.memo || undefined,
        amount: amountNum || undefined,
        contractDate: ptForm.contractDate || undefined,
      };
      if (isFirst && ptForm.remaining !== "") {
        body.initialRemaining = Number(ptForm.remaining);
      }
      const res = await fetch(
        `${API_URL}/api/trainer/members/${memberId}/pt/add`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error("PT 등록 실패");
      setShowPTEdit(false);
      fetchMember();
      Alert.alert(
        "완료",
        isFirst
          ? `PT ${ptForm.sessions}회가 등록됐어요!`
          : `PT ${ptForm.sessions}회가 추가됐어요!`,
      );
    } catch (e: any) {
      Alert.alert("오류", e.message);
    }
  };

  const savePtDirect = async () => {
    const remaining = Number(ptDirectForm.remaining);
    const total = Number(ptDirectForm.total);
    if (isNaN(remaining) || isNaN(total) || remaining < 0 || total < 0) {
      Alert.alert("오류", "올바른 숫자를 입력해주세요.");
      return;
    }
    if (remaining > total) {
      Alert.alert("오류", "잔여 PT는 총 횟수보다 클 수 없어요.");
      return;
    }
    try {
      setSavingPtDirect(true);
      const jwt = await AsyncStorage.getItem("jwt");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      };
      if (type === "manual") {
        const res = await fetch(
          `${API_URL}/api/trainer/manual-members/${memberId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({ sessions: total, ptRemaining: remaining }),
          },
        );
        if (!res.ok) throw new Error(`미연동 수정 실패 (${res.status})`);
      } else {
        const res = await fetch(
          `${API_URL}/api/trainer/members/${memberId}/pt`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({ ptTotal: total, ptRemaining: remaining }),
          },
        );
        if (!res.ok) throw new Error(`연동 수정 실패 (${res.status})`);
      }
      setShowPtDirectEdit(false);
      fetchMember();
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "수정에 실패했어요.");
    } finally {
      setSavingPtDirect(false);
    }
  };

  if (loading || !member || renderedMemberId !== memberId) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator color={Colors.green} size="large" />
      </View>
    );
  }

  const ptPct =
    member.ptTotal > 0 ? ((member.ptRemaining || 0) / member.ptTotal) * 100 : 0;
  const WeekCalendar = () => (
    <View
      style={{
        backgroundColor: Colors.bgSub,
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => w - 1)}
          style={{ padding: 6 }}
        >
          <Text style={{ fontSize: 20, color: Colors.green }}>‹</Text>
        </TouchableOpacity>
        <Text
          style={{ fontSize: 13, fontWeight: "700", color: Colors.textSub }}
        >
          {weekOffset === 0
            ? "이번 주"
            : weekOffset < 0
              ? `${Math.abs(weekOffset)}주 전`
              : `+${weekOffset}주`}
          {"  "}
          {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} ~{" "}
          {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
        </Text>
        <TouchableOpacity
          onPress={() => setWeekOffset((w) => Math.min(w + 1, 0))}
          style={{ padding: 6, opacity: weekOffset === 0 ? 0.3 : 1 }}
        >
          <Text style={{ fontSize: 20, color: Colors.green }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {weekDates.map((date, i) => {
          const key = toDateKey(date);
          const isSelected = toDateKey(selectedDate) === key;
          const isToday = toDateKey(new Date()) === key;
          const workoutLogsForDate = fitLogs.filter((log: any) => {
            const logDate = String(
              log.date ?? log.logDate ?? log.log_date ?? "",
            ).slice(0, 10);
            return logDate === key;
          });

          const dayHasPt = workoutLogsForDate.some((log: any) => {
            const type = String(
              log.workoutType ?? log.workout_type ?? log.type ?? "",
            ).toUpperCase();
            return type === "PT";
          });

          const dayHasPersonal = workoutLogsForDate.some((log: any) => {
            const type = String(
              log.workoutType ?? log.workout_type ?? log.type ?? "",
            ).toUpperCase();
            return type === "PERSONAL" || type === "PERSONAL_WORKOUT";
          });

          const dayHasDiet = weekDietDates.has(key);

          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDate(date)}
              style={{ alignItems: "center", gap: 4 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.textMuted,
                  fontWeight: "600",
                }}
              >
                {WEEK_DAYS[i]}
              </Text>

              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: isSelected
                    ? Colors.green
                    : isToday
                      ? Colors.greenLight
                      : "transparent",
                  borderWidth: isToday && !isSelected ? 1.5 : 0,
                  borderColor: Colors.green,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: isSelected
                      ? "#fff"
                      : isToday
                        ? Colors.green
                        : Colors.text,
                  }}
                >
                  {date.getDate()}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 3,
                  height: 6,
                  alignItems: "center",
                }}
              >
                {dayHasPt ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: isOt ? "#F97316" : Colors.green,
                    }}
                  />
                ) : null}
                {!isManual && dayHasPersonal ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: "#4A90FF",
                    }}
                  />
                ) : null}
                {!isManual && dayHasDiet ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: "#F59E0B",
                    }}
                  />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: isOt ? "#F97316" : Colors.green,
            }}
          />
          <Text
            style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}
          >
            {isOt ? "OT" : "PT"}
          </Text>
        </View>
        {!isManual && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: "#4A90FF",
              }}
            />
            <Text
              style={{
                fontSize: 11,
                color: Colors.textMuted,
                fontWeight: "600",
              }}
            >
              개인운동
            </Text>
          </View>
        )}
        {!isManual && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: "#F59E0B",
              }}
            />
            <Text
              style={{
                fontSize: 11,
                color: Colors.textMuted,
                fontWeight: "600",
              }}
            >
              식단
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // 체중 그래프 컴포넌트
  const BodyGraph = ({
    logs,
    metric,
    color,
    label,
    unit,
    isLast = false,
  }: {
    logs: BodyLog[];
    metric: keyof BodyLog;
    color: string;
    label: string;
    unit: string;
    isLast?: boolean;
  }) => {
    const TOTAL_SLOTS = 8;
    const data = logs.slice(-8);

    const validData = data.filter((log) => {
      const value = log[metric] as number | undefined;
      return value !== undefined && value !== null && value > 0;
    });

    if (validData.length < 1) return null;

    const chartH = 42;
    const chartPadX = 18;
    const chartW = SCREEN_W - 36;
    const stepX = chartW / (TOTAL_SLOTS - 1);

    const values = validData.map((log) => log[metric] as number);
    let minV = Math.min(...values);
    let maxV = Math.max(...values);

    const diff = maxV - minV;
    const padding = diff === 0 ? 0.5 : diff * 0.15;
    minV = minV - padding;
    maxV = maxV + padding;
    const range = maxV - minV || 1;

    const graphColor = color;

    const points = validData.map((log, i) => {
      const value = log[metric] as number;
      const x = chartPadX + i * stepX;

      return {
        x,
        y: chartH - ((value - minV) / range) * (chartH - 20) - 10,
        val: value,
        date: String(log.date ?? "")
          .slice(0, 10)
          .slice(5),
      };
    });

    return (
      <View style={{ marginBottom: isLast ? 0 : 26, width: SCREEN_W }}>
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: Colors.text,
            marginBottom: 18,
          }}
        >
          {label}
        </Text>

        <View
          style={{ height: chartH + 24, position: "relative", width: SCREEN_W }}
        >
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: SCREEN_W,
              height: chartH,
            }}
          >
            {/* 그리드 라인 */}
            {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: chartPadX + i * stepX,
                  top: 0,
                  width: 1,
                  height: chartH,
                  backgroundColor: Colors.border + "40",
                }}
              />
            ))}

            {/* 라인 */}
            {points.map((p, i) => {
              if (i >= points.length - 1) return null;

              const next = points[i + 1];
              const dx = next.x - p.x;
              const dy = next.y - p.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              const angle = Math.atan2(dy, dx) * (180 / Math.PI);

              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.x,
                    top: p.y,
                    width: len,
                    height: 2,
                    backgroundColor: graphColor,
                    transformOrigin: "left center",
                    transform: [{ rotate: `${angle}deg` }],
                  }}
                />
              );
            })}

            {/* 포인트 + 수치 */}
            {points.map((p, i) => (
              <View key={i}>
                <View
                  style={{
                    position: "absolute",
                    left: p.x - 3.5,
                    top: p.y - 3.5,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: graphColor,
                    borderWidth: 2,
                    borderColor: "#fff",
                  }}
                />

                <View
                  style={{
                    position: "absolute",
                    left: p.x - 22,
                    top: p.y - 16,
                    width: 44,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: graphColor,
                    }}
                  >
                    {Number(p.val).toFixed(1).replace(/\.0$/, "")}
                    {unit}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* x축 날짜 라벨 */}
          <View
            style={{
              position: "absolute",
              left: 0,
              top: chartH + 8,
              width: SCREEN_W,
              height: 16,
            }}
          >
            {points.map((p, i) => (
              <Text
                key={i}
                style={{
                  position: "absolute",
                  left: p.x - 22,
                  width: 44,
                  textAlign: "center",
                  fontSize: 7,
                  color: Colors.textMuted,
                }}
              >
                {p.date}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const getExerciseMediaList = (exercise: any) => {
    // mediaList(배열) 우선, 없으면 media(단일) 폴백
    const list = exercise?.mediaList ?? exercise?.medias ?? [];
    const items =
      list.length > 0 ? list : exercise?.media ? [exercise.media] : [];
    return items
      .filter(Boolean)
      .map((media: any) => ({
        id: media.id,
        url: media.url ?? media.mediaUrl ?? media.secureUrl,
        publicId: media.publicId,
        mediaType: media.mediaType ?? media.type ?? "IMAGE",
      }))
      .filter((media: any) => !!media.url);
  };

  const getExerciseMediaKey = (log: any, exercise: any, exIdx: number) =>
    `${log.workoutId ?? log.id ?? "log"}-${exercise.name ?? "exercise"}-${exIdx}`;

  const getExerciseMediaToggleLabel = (mediaList: any[], isOpen: boolean) => {
    const hasImage = mediaList.some(
      (media) => String(media.mediaType).toUpperCase() !== "VIDEO",
    );
    const hasVideo = mediaList.some(
      (media) => String(media.mediaType).toUpperCase() === "VIDEO",
    );
    const label =
      hasImage && hasVideo ? "사진/영상" : hasVideo ? "영상" : "사진";
    return `${label} ${isOpen ? "접기" : "보기"}`;
  };

  const renderFitLogCard = (
    log: any,
    color: string,
    title: string,
    onEdit?: () => void,
  ) => {
    const exercises = log.exercises ?? [];
    const logDate = String(log.date ?? log.logDate ?? log.log_date ?? "").slice(
      0,
      10,
    );
    const conditionLabel =
      log.conditionScore === 4
        ? "최상"
        : log.conditionScore === 3
          ? "좋음"
          : log.conditionScore === 2
            ? "보통"
            : log.conditionScore === 1
              ? "나쁨"
              : null;

    return (
      <View
        key={`${log.id ?? log.workoutId ?? title}-${logDate}-${log.workoutType ?? ""}`}
        style={{
          borderWidth: 1,
          borderColor: Colors.border,
          borderRadius: 18,
          padding: 16,
          marginBottom: 14,
          backgroundColor: "#fff",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: conditionLabel || log.painPoints ? 8 : 14,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 17, fontWeight: "900", color: Colors.text }}
            >
              {title}
            </Text>
            <Text
              style={{ fontSize: 12, color: Colors.textMuted, marginTop: 3 }}
            >
              {logDate} · {exercises.length}개 운동
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {log.workoutType === "PT" && (
              <TouchableOpacity
                onPress={() => copyWorkoutLogText(log)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  backgroundColor: "#fff",
                  borderRadius: 999,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "900",
                    color: Colors.text,
                  }}
                >
                  ⧉
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  복사
                </Text>
              </TouchableOpacity>
            )}

            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                style={{
                  borderWidth: 1,
                  borderColor: color + "44",
                  backgroundColor: color + "12",
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "800", color }}>
                  수정
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 부위 + 컨디션 */}
        {(log.painPoints || conditionLabel) && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: 12,
            }}
          >
            {log.painPoints &&
              log.painPoints
                .split(",")
                .map((p: string) => p.trim())
                .filter(Boolean)
                .map((part: string) => (
                  <View
                    key={part}
                    style={{
                      backgroundColor: color + "18",
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                      borderWidth: 1,
                      borderColor: color + "44",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "700", color }}>
                      {part}
                    </Text>
                  </View>
                ))}
            {conditionLabel && (
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: Colors.textSub,
                  }}
                >
                  컨디션 {conditionLabel}
                </Text>
              </View>
            )}
          </View>
        )}

        {exercises.map((exercise: any, exIdx: number) => {
          const sets = exercise.sets ?? [];
          const mediaList = getExerciseMediaList(exercise);
          const mediaKey = getExerciseMediaKey(log, exercise, exIdx);
          const isMediaOpen = !!expandedExerciseMediaKeys[mediaKey];

          return (
            <View
              key={`${exercise.name}-${exIdx}`}
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 11,
                marginBottom: exIdx === exercises.length - 1 ? 0 : 9,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 15,
                    fontWeight: "900",
                    color: Colors.text,
                  }}
                >
                  {exercise.name}
                </Text>

                {mediaList.length > 0 ? (
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedExerciseMediaKeys((prev) => ({
                        ...prev,
                        [mediaKey]: !prev[mediaKey],
                      }))
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      paddingHorizontal: 2,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color,
                      }}
                    >
                      {getExerciseMediaToggleLabel(mediaList, isMediaOpen)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {sets.length > 0 ? (
                <View
                  style={{
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    backgroundColor: "#fff",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: "#f6f7f6",
                      borderBottomWidth: 1,
                      borderBottomColor: Colors.border,
                    }}
                  >
                    {[
                      { label: "SET", flex: 0.7 },
                      { label: "KG", flex: 1 },
                      { label: "REP", flex: 1 },
                    ].map((col, idx) => (
                      <View
                        key={col.label}
                        style={{
                          flex: col.flex,
                          alignItems: "center",
                          paddingVertical: 5,
                          borderRightWidth: idx < 2 ? 1 : 0,
                          borderRightColor: Colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "800",
                            color: Colors.textMuted,
                          }}
                        >
                          {col.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {sets.map((set: any, setIdx: number) => (
                    <View
                      key={`${setIdx}-${set.weight}-${set.reps}`}
                      style={{
                        flexDirection: "row",
                        borderTopWidth: setIdx === 0 ? 0 : 1,
                        borderTopColor: "#edf0ed",
                      }}
                    >
                      <View
                        style={{
                          flex: 0.7,
                          alignItems: "center",
                          paddingVertical: 6,
                          borderRightWidth: 1,
                          borderRightColor: Colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "800",
                            color: Colors.textSub,
                          }}
                        >
                          {setIdx + 1}
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 6,
                          borderRightWidth: 1,
                          borderRightColor: Colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "900",
                            color,
                          }}
                        >
                          {Number(set.weight) > 0 ? set.weight : "맨몸"}
                        </Text>
                      </View>
                      <View
                        style={{
                          flex: 1,
                          alignItems: "center",
                          paddingVertical: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "900",
                            color,
                          }}
                        >
                          {set.reps}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              {exercise.memo ? (
                <View
                  style={{
                    marginTop: 7,
                    paddingTop: 7,
                    borderTopWidth: 1,
                    borderTopColor: Colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textSub,
                      lineHeight: 17,
                    }}
                  >
                    메모: {exercise.memo}
                  </Text>
                </View>
              ) : null}

              {isMediaOpen && mediaList.length > 0 ? (
                <View style={{ marginTop: 9, gap: 8 }}>
                  {mediaList.map((media: any, mediaIdx: number) => {
                    const isVideo =
                      String(media.mediaType).toUpperCase() === "VIDEO";
                    const galleryIndex = mediaIdx;
                    return (
                      <TouchableOpacity
                        key={`${media.url}-${mediaIdx}`}
                        activeOpacity={0.9}
                        onPress={() => {
                          setMediaGallery(mediaList);
                          setMediaGalleryIndex(galleryIndex);
                        }}
                        style={{
                          overflow: "hidden",
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          backgroundColor: "#fff",
                        }}
                      >
                        {isVideo ? (
                          <Video
                            source={{ uri: media.url }}
                            style={{ width: "100%", height: 220 }}
                            resizeMode={ResizeMode.CONTAIN}
                            useNativeControls
                            shouldPlay={false}
                          />
                        ) : (
                          <Image
                            source={{ uri: media.url }}
                            style={{ width: "100%", height: 220 }}
                            resizeMode="contain"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}

        {log.feedback ? (
          <View
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: Colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: Colors.textSub,
                marginBottom: 4,
              }}
            >
              피드백
            </Text>
            <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>
              {log.feedback}
            </Text>
          </View>
        ) : null}

        {/* 이 수업에 등록된 챌린지 */}
        {(() => {
          const logId = log.workoutId ?? log.id;
          const logMissions = memberMissions.filter(
            (m) =>
              m.workoutLogId != null &&
              Number(m.workoutLogId) === Number(logId),
          );
          if (logMissions.length === 0) return null;
          const doneCount = logMissions.filter(
            (m) => m.status === "DONE",
          ).length;
          return (
            <View
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: "#f97316" }}
                >
                  챌린지
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#f9731699",
                    marginLeft: "auto",
                  }}
                >
                  {doneCount}/{logMissions.length} 완료
                </Text>
              </View>
              {logMissions.map((m) => {
                const isDone = m.status === "DONE";
                const isFailed = m.status === "FAILED";
                return (
                  <View
                    key={m.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      paddingVertical: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        color: isDone
                          ? "#22c55e"
                          : isFailed
                            ? "#ef4444"
                            : "#f97316",
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: isDone
                            ? "#22c55e"
                            : isFailed
                              ? "#ef4444"
                              : "#f97316",
                        }}
                      />
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: isDone
                          ? Colors.textMuted
                          : isFailed
                            ? "#ef444499"
                            : Colors.text,
                        textDecorationLine: isDone ? "line-through" : "none",
                      }}
                    >
                      {m.content}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: isDone
                          ? "#22c55e18"
                          : isFailed
                            ? "#ef444418"
                            : "#f9731618",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: isDone
                            ? "#22c55e"
                            : isFailed
                              ? "#ef4444"
                              : "#f97316",
                        }}
                      >
                        {isDone ? "완료" : isFailed ? "미완료" : "대기"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={80}
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 40,
        }}
      >
        {/* 헤더 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          {/* 왼쪽: 뒤로 + 이름 + 뱃지 */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              flex: 1,
            }}
          >
            <TouchableOpacity onPress={() => router.push("/(tabs)/trainer/members" as any)}>
              <Text style={{ fontSize: 22, color: Colors.textMuted }}>←</Text>
            </TouchableOpacity>
            <Text
              style={{ fontSize: 22, fontWeight: "800", color: Colors.text }}
            >
              {member.user.name}
            </Text>
            {/* 미연동 / OT 뱃지 */}
            {isManual && (
              <TouchableOpacity
                onPress={isOt ? undefined : () => setInviteModalVisible(true)}
                activeOpacity={isOt ? 1 : 0.7}
                style={{
                  backgroundColor: isOt ? "#FFF7ED" : "#F3F4F6",
                  borderWidth: 1,
                  borderColor: isOt ? "#FDBA7455" : "#D1D5DB",
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: isOt ? "#F97316" : "#6B7280",
                  }}
                >
                  {isOt ? "OT" : "미연동"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {/* 오른쪽: 공지사항 + ⋮ 메뉴 */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `/(tabs)/trainer/member-notices?memberId=${memberId}&memberName=${encodeURIComponent(member.user.name)}&isManual=${isManual}` as any,
                )
              }
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: Colors.border,
                backgroundColor: Colors.bgSub,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textSub,
                  fontWeight: "600",
                }}
              >
                공지사항
              </Text>
            </TouchableOpacity>
            {!isReadOnly && (
              <TouchableOpacity
                onPress={handleMemberMenu}
                disabled={memberActionLoading}
                style={{ padding: 8 }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    color: Colors.textMuted,
                    fontWeight: "700",
                  }}
                >
                  ⋮
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {!isManual && member.goal && (
          <View
            style={{
              alignSelf: "flex-start",
              backgroundColor: Colors.bgSub,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 3,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>
              {member.goal}
            </Text>
          </View>
        )}

        {/* 이동된 회원 안내 배너 */}
        {isReadOnly && (
          <View
            style={{
              backgroundColor: "#FFF7ED",
              borderWidth: 1,
              borderColor: "#FDBA74",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>📋</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 13, fontWeight: "700", color: "#92400E" }}
              >
                다른 트레이너로 이동한 회원이에요
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "#B45309",
                  marginTop: 2,
                  lineHeight: 18,
                }}
              >
                {readOnlyUntil?.replace(/-/g, ".")}까지의 기록만 열람할 수
                있어요.
              </Text>
            </View>
          </View>
        )}

        {/* PT 잔여 카드 */}
        <View
          style={{
            backgroundColor: Colors.bgSub,
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: Colors.border,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: member.ptTotal > 0 ? 10 : 0,
            }}
          >
            <View
              style={{ flexDirection: "row", gap: 16, alignItems: "flex-end" }}
            >
              <View>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                  잔여 PT
                </Text>
                <Text
                  style={{ fontSize: 28, fontWeight: "900", color: "#4A90FF" }}
                >
                  {member.ptRemaining ?? 0}회
                </Text>
              </View>
              {member.ptTotal > 0 && (
                <View>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    총
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: Colors.textSub,
                    }}
                  >
                    {member.ptTotal}회
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => {
                setPtDirectForm({
                  remaining: String(member.ptRemaining ?? 0),
                  total: String(member.ptTotal ?? 0),
                });
                setShowPtDirectEdit(true);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: Colors.bgSub,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                수정
              </Text>
            </TouchableOpacity>
          </View>
          {member.ptTotal > 0 && (
            <>
              <View
                style={{
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                  height: 6,
                }}
              >
                <View
                  style={{
                    width: `${Math.min(ptPct, 100)}%` as any,
                    height: 6,
                    backgroundColor: "#4A90FF",
                    borderRadius: 99,
                  }}
                />
              </View>
              {member.ptStartDate && (
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginTop: 6,
                  }}
                >
                  {member.ptStartDate} 시작
                  {member.ptExpDate ? ` · ${member.ptExpDate} 만료` : ""}
                </Text>
              )}
            </>
          )}
        </View>

        {/* 탭 — 미연동 회원은 운동로그 + 바디로그만, 연동 회원은 3탭 전체 */}

        {isManual ? (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {[
              { label: "운동로그", idx: 0 },
              { label: "바디로그", idx: 2 },
            ].map(({ label, idx }) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setTab(idx)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: tab === idx ? Colors.green : Colors.bgSub,
                  borderWidth: 1,
                  borderColor: tab === idx ? Colors.green : Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: tab === idx ? "#fff" : Colors.textMuted,
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
            {["운동로그", "식단로그", "바디로그"].map((t, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setTab(i)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: tab === i ? Colors.green : Colors.bgSub,
                  borderWidth: 1,
                  borderColor: tab === i ? Colors.green : Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: tab === i ? "#fff" : Colors.textMuted,
                  }}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── 식단 탭 — 미연동 회원은 표시 안 함 ── */}
        {tab === 1 && !isManual && (
          <View>
            {/* 주간 캘린더 */}
            <WeekCalendar />

            {/* 식단 사진 목록 */}
            {dietPhotos.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>🍽️</Text>
                <Text style={{ fontSize: 15, color: Colors.textMuted }}>
                  이 날 등록된 식단 사진이 없어요
                </Text>
              </View>
            ) : (
              dietPhotos.map((photo: any) => (
                <View
                  key={photo.id}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    marginBottom: 10,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      position: "relative",
                      aspectRatio: dietPhotoRatios[photo.id] ?? 4 / 3,
                    }}
                  >
                    <Image
                      source={{ uri: photo.photoUrl }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="contain"
                    />
                    {photo.label ? (
                      <View
                        style={{
                          position: "absolute",
                          bottom: 8,
                          left: 8,
                          backgroundColor: "rgba(0,0,0,0.55)",
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: "700",
                          }}
                        >
                          {photo.label}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {/* 하루 피드백 섹션 (사진이 있을 때만 표시) */}
            {dietPhotos.length > 0 && (
              <View
                style={{
                  backgroundColor: Colors.greenLight,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: Colors.green + "44",
                  padding: 12,
                  marginTop: 4,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.green,
                    marginBottom: 6,
                  }}
                >
                  {member.user.name}님께 오늘의 식단 피드백
                </Text>
                {dayFeedback && (
                  <View
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.text,
                        lineHeight: 18,
                      }}
                    >
                      {dayFeedback.content}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: Colors.textMuted,
                        marginTop: 4,
                      }}
                    >
                      {dayFeedback.createdAt?.slice(0, 10)} ·{" "}
                      {dayFeedback.trainerName} 트레이너
                    </Text>
                  </View>
                )}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignItems: "flex-end",
                  }}
                >
                  <TextInput
                    value={dayFeedbackInput}
                    onChangeText={setDayFeedbackInput}
                    placeholder={
                      dayFeedback
                        ? "피드백 수정..."
                        : "오늘 식단 피드백을 남겨주세요..."
                    }
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    style={{
                      flex: 1,
                      backgroundColor: "#fff",
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 13,
                      color: Colors.text,
                      textAlignVertical: "top",
                      minHeight: 60,
                      maxHeight: 100,
                    }}
                  />
                  <TouchableOpacity
                    onPress={sendDayFeedback}
                    disabled={sendingDayFeedback || !dayFeedbackInput.trim()}
                    style={{
                      backgroundColor: dayFeedbackInput.trim()
                        ? Colors.green
                        : Colors.border,
                      borderRadius: 10,
                      width: 44,
                      height: 44,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {sendingDayFeedback ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ fontSize: 18, color: "#fff" }}>↑</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── 운동 탭 ── */}
        {tab === 0 && (
          <View>
            <WeekCalendar />

            {/* 선택 날짜 + PT 수업 등록 버튼 */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: Colors.textSub,
                  }}
                >
                  {selectedDateKey} 기록
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    await fetchFitLogHistory();
                    setShowHistoryModal(true);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.green + "55",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    backgroundColor: Colors.green + "11",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.green,
                      fontWeight: "700",
                    }}
                  >
                    전체 운동 기록
                  </Text>
                </TouchableOpacity>
              </View>
              {dayPtLogs.length === 0 && (
                <TouchableOpacity
                  onPress={() => {
                    fetchFitLogHistory();
                    if (!isManual) {
                      AsyncStorage.getItem("jwt").then((jwt) => {
                        fetch(
                          `${API_URL}/api/missions/member/${memberId}/last-session`,
                          { headers: { Authorization: `Bearer ${jwt}` } },
                        )
                          .then((r) => (r.ok ? r.json() : []))
                          .then((ms: any[]) => {
                            setLastSessionMissions(
                              ms.map((m: any) => ({
                                id: m.id,
                                content: m.content,
                                status: m.status,
                              })),
                            );
                          })
                          .catch(() => {});
                      });
                    }
                    setShowFitLogForm(true);
                  }}
                  style={{
                    backgroundColor: Colors.green + "22",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: Colors.green + "55",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.green }}>
                    + 운동일지 등록
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* PT 입력폼은 모달로 처리 */}

            {/* 이날 운동 기록 */}
            {fitLogsLoading ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <ActivityIndicator color={Colors.green} />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginTop: 8,
                  }}
                >
                  운동 기록 불러오는 중...
                </Text>
              </View>
            ) : dayFitLogs.length > 0 ? (
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 10,
                  }}
                >
                  이날 운동 기록
                </Text>

                {/* PT 수업 */}
                {dayPtLogs.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: isOt ? "#F97316" : Colors.green,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: Colors.text,
                        }}
                      >
                        {isOt ? "OT 수업" : "PT 수업"}
                      </Text>
                    </View>

                    {dayPtLogs.map((log: any) =>
                      renderFitLogCard(
                        log,
                        isOt ? "#F97316" : Colors.green,
                        isOt ? "OT 수업 완료" : "PT 수업 완료",
                        () => startEditFitLog(log),
                      ),
                    )}
                  </View>
                )}

                {/* OT 수업 (PT 전환 후에도 과거 OT 기록 표시) */}
                {dayOtLogs.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#F97316",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: Colors.text,
                        }}
                      >
                        OT 수업
                      </Text>
                    </View>
                    {dayOtLogs.map((log: any) =>
                      renderFitLogCard(log, "#F97316", "OT 수업 완료", () =>
                        startEditFitLog(log),
                      ),
                    )}
                  </View>
                )}

                {/* 개인 운동 */}
                {dayPersonalLogs.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: "#4A90FF",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "900",
                          color: Colors.text,
                        }}
                      >
                        개인 운동
                      </Text>
                    </View>

                    {dayPersonalLogs.map((log: any) => {
                      const wid = log.workoutId ?? log.id;
                      return (
                        <View key={wid}>
                          {renderFitLogCard(
                            log,
                            "#4A90FF",
                            "개인 운동 완료",
                            undefined,
                          )}
                          {/* 트레이너 피드백 입력 */}
                          <View
                            style={{
                              backgroundColor: Colors.bgSub,
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: Colors.border,
                              padding: 12,
                              marginTop: -8,
                              marginBottom: 14,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: Colors.textSub,
                                marginBottom: 6,
                              }}
                            >
                              {member.user.name}님 운동 피드백
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                gap: 8,
                                alignItems: "flex-end",
                              }}
                            >
                              <TextInput
                                value={personalFeedbackInputs[wid] ?? ""}
                                onChangeText={(text) =>
                                  setPersonalFeedbackInputs((prev) => ({
                                    ...prev,
                                    [wid]: text,
                                  }))
                                }
                                placeholder={
                                  log.feedback
                                    ? "피드백 수정..."
                                    : "운동 피드백을 남겨주세요..."
                                }
                                placeholderTextColor={Colors.textMuted}
                                multiline
                                style={{
                                  flex: 1,
                                  backgroundColor: "#fff",
                                  borderWidth: 1,
                                  borderColor: Colors.border,
                                  borderRadius: 10,
                                  padding: 10,
                                  fontSize: 13,
                                  color: Colors.text,
                                  textAlignVertical: "top",
                                  minHeight: 52,
                                  maxHeight: 90,
                                }}
                              />
                              <TouchableOpacity
                                onPress={() => sendPersonalFeedback(wid)}
                                disabled={
                                  sendingPersonalFeedback[wid] ||
                                  !(personalFeedbackInputs[wid] ?? "").trim()
                                }
                                style={{
                                  backgroundColor: (
                                    personalFeedbackInputs[wid] ?? ""
                                  ).trim()
                                    ? Colors.green
                                    : Colors.border,
                                  borderRadius: 10,
                                  width: 40,
                                  height: 40,
                                  justifyContent: "center",
                                  alignItems: "center",
                                }}
                              >
                                {sendingPersonalFeedback[wid] ? (
                                  <ActivityIndicator
                                    size="small"
                                    color="#fff"
                                  />
                                ) : (
                                  <Text style={{ fontSize: 16, color: "#fff" }}>
                                    ↑
                                  </Text>
                                )}
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              !isToday && (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>📋</Text>
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                    이날 운동 기록이 없어요
                  </Text>
                </View>
              )
            )}
          </View>
        )}

        {/* ── 바디로그 탭 (growth.tsx와 동일 구조) ── */}
        {tab === 2 && (
          <View>
            {/* 기록 추가 카드 */}
            <View
              style={{
                backgroundColor: Colors.bgSub,
                borderRadius: 14,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: Colors.text,
                  marginBottom: 12,
                }}
              >
                기록 추가
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                {[
                  {
                    label: "몸무게",
                    value: blWeight,
                    setter: setBlWeight,
                    unit: "kg",
                    placeholder: "0.0",
                  },
                  {
                    label: "체지방량",
                    value: blBodyFatMass,
                    setter: setBlBodyFatMass,
                    unit: "kg",
                    placeholder: "0.0",
                  },
                  {
                    label: "근육량",
                    value: blMuscleMass,
                    setter: setBlMuscleMass,
                    unit: "kg",
                    placeholder: "0.0",
                  },
                ].map(({ label, value, setter, unit, placeholder }) => (
                  <View key={label} style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        color: Colors.textMuted,
                        marginBottom: 4,
                      }}
                    >
                      {label}
                    </Text>
                    <View
                      style={{
                        backgroundColor: "#fff",
                        borderWidth: 1.5,
                        borderColor: value ? Colors.green : Colors.border,
                        borderRadius: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 8,
                        paddingVertical: 6,
                      }}
                    >
                      <TextInput
                        value={value}
                        onChangeText={setter}
                        placeholder={placeholder}
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        style={{ flex: 1, fontSize: 14, color: Colors.text }}
                      />
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                        {unit}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {autoBodyFat !== null && (
                <View
                  style={{
                    backgroundColor: Colors.greenLight,
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.green,
                      fontWeight: "700",
                    }}
                  >
                    💡 체지방률 자동계산: {autoBodyFat}%
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={saveBodyLog}
                disabled={blSaving}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}
                >
                  {blSaving ? "저장 중..." : "기록 저장"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 그래프 */}
            {bodyLogs.length > 0 && (
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  padding: 12,
                  paddingBottom: 4,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  alignItems: "flex-start",
                  overflow: "hidden",
                }}
              >
                <BodyGraph
                  logs={bodyLogs}
                  metric="weight"
                  color={Colors.green}
                  label="체중 변화"
                  unit="kg"
                />
                <BodyGraph
                  logs={bodyLogs}
                  metric="bodyFat"
                  color={Colors.green}
                  label="체지방률 변화"
                  unit="%"
                  isLast
                />
              </View>
            )}

            {/* 기록 목록 */}
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: Colors.textSub,
                marginBottom: 10,
              }}
            >
              기록 목록
            </Text>

            {bodyLogs.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>
                  등록된 바디로그가 없어요
                </Text>
              </View>
            ) : (
              bodyLogs
                .slice()
                .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                .map((log, i, arr) => {
                  const prev = arr[i + 1];
                  const diffText = (key: keyof BodyLog) => {
                    const cur = log[key] as number | undefined;
                    const before = prev?.[key] as number | undefined;
                    if (cur == null || before == null) return null;
                    const d = Number((cur - before).toFixed(1));
                    if (d === 0) return null;
                    return d > 0 ? `↑${d}` : `↓${Math.abs(d)}`;
                  };

                  return (
                    <View
                      key={log.id ?? `${log.date}-${i}`}
                      style={{
                        backgroundColor: Colors.bgSub,
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: Colors.border,
                      }}
                    >
                      {/* 날짜 + 수정/삭제 버튼 */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          {formatDateTime(log.date)}
                        </Text>
                        {log.id && (
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => setEditingLog({
                                id: log.id!,
                                date: String(log.date ?? "").slice(0, 10),
                                weight: String(log.weight ?? ""),
                                bodyFatMass: String(log.bodyFatMass ?? ""),
                                muscleMass: String(log.muscleMass ?? ""),
                              })}
                              style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: Colors.bgSub, borderRadius: 6, borderWidth: 1, borderColor: Colors.border }}
                            >
                              <Text style={{ fontSize: 12, color: Colors.text, fontWeight: "600" }}>수정</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert("삭제", "이 기록을 삭제할까요?", [
                                  { text: "취소", style: "cancel" },
                                  {
                                    text: "삭제",
                                    style: "destructive",
                                    onPress: async () => {
                                      try {
                                        const jwt = await AsyncStorage.getItem("jwt");
                                        const delUrl = isManual
                                          ? `${API_URL}${ENDPOINTS.bodylog.deleteManual(log.id!)}`
                                          : `${API_URL}/api/bodylog/${log.id}`;
                                        await fetch(delUrl, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } });
                                        await fetchBodyLogs();
                                      } catch {
                                        Alert.alert("오류", "삭제에 실패했어요.");
                                      }
                                    },
                                  },
                                ]);
                              }}
                              style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#fff0f0", borderRadius: 6, borderWidth: 1, borderColor: "#ffcccc" }}
                            >
                              <Text style={{ fontSize: 12, color: "#e03030", fontWeight: "600" }}>삭제</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      {/* 수치 */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                        }}
                      >
                        {[
                          {
                            label: "몸무게",
                            val: log.weight,
                            unit: "kg",
                            diff: null,
                          },
                          {
                            label: "체지방량",
                            val: log.bodyFatMass,
                            unit: "kg",
                            diff: diffText("bodyFatMass"),
                          },
                          {
                            label: "체지방률",
                            val: log.bodyFat,
                            unit: "%",
                            diff: diffText("bodyFat"),
                          },
                          {
                            label: "근육량",
                            val: log.muscleMass,
                            unit: "kg",
                            diff: diffText("muscleMass"),
                          },
                        ].map(({ label, val, unit, diff }) => (
                          <View
                            key={label}
                            style={{ alignItems: "center", flex: 1 }}
                          >
                            <Text
                              style={{
                                fontSize: 14,
                                fontWeight: "800",
                                color: Colors.text,
                              }}
                            >
                              {val ?? "-"}
                              {val ? unit : ""}
                            </Text>
                            {diff ? (
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: String(diff).startsWith("↑")
                                    ? Colors.green
                                    : Colors.textMuted,
                                  fontWeight: "800",
                                  marginTop: 2,
                                }}
                              >
                                {diff}
                              </Text>
                            ) : null}
                            <Text
                              style={{
                                fontSize: 10,
                                color: Colors.textMuted,
                                marginTop: diff ? 0 : 2,
                              }}
                            >
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
            )}
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* PT 수업 등록/수정 모달 */}
      <Modal
        visible={showFitLogForm}
        transparent
        animationType="slide"
        onRequestClose={resetFitLogForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
            activeOpacity={1}
            onPress={resetFitLogForm}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: FULL_H * 0.92,
            }}
          >
            {/* 드래그 핸들 */}
            <View
              style={{ alignItems: "center", paddingTop: 10, paddingBottom: 2 }}
            >
              <View
                style={{
                  width: 36,
                  height: 4,
                  backgroundColor: Colors.border,
                  borderRadius: 2,
                }}
              />
            </View>
            {/* 헤더 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 4,
                    height: 18,
                    backgroundColor: Colors.green,
                    borderRadius: 2,
                  }}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color: Colors.text,
                  }}
                >
                  {editingFitLogId
                    ? isOt
                      ? "OT 수업 수정"
                      : "PT 수업 수정"
                    : isOt
                      ? "OT 수업 등록"
                      : "PT 수업 등록"}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  {toDateKey(selectedDate)}
                </Text>
                <TouchableOpacity
                  onPress={resetFitLogForm}
                  style={{ padding: 4 }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      color: Colors.textMuted,
                      lineHeight: 24,
                    }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            {/* 폼 내용 */}
            <ScrollView
              style={{ paddingHorizontal: 20 }}
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* 지난 수업 챌린지 결과 */}
              {lastSessionMissions.length > 0 && (
                <View
                  style={{
                    backgroundColor: "#f8f8f8",
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 14,
                    borderWidth: 1,
                    borderColor: "#e5e5e5",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "800",
                        color: Colors.text,
                      }}
                    >
                      지난 수업 챌린지 결과
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: Colors.textMuted,
                        marginLeft: "auto",
                      }}
                    >
                      {
                        lastSessionMissions.filter((m) => m.status === "DONE")
                          .length
                      }
                      /{lastSessionMissions.length} 완료
                    </Text>
                  </View>
                  {lastSessionMissions.map((m) => (
                    <View
                      key={m.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: "#eeeeee",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color:
                            m.status === "DONE"
                              ? Colors.textMuted
                              : Colors.text,
                          textDecorationLine:
                            m.status === "DONE" ? "line-through" : "none",
                        }}
                      >
                        {m.content}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color:
                            m.status === "DONE" ? Colors.green : Colors.red,
                        }}
                      >
                        {m.status === "DONE" ? "완료" : "미완료"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 부위 선택 */}
              <View style={{ marginBottom: 10 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  부위 (복수 선택)
                </Text>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
                >
                  {["가슴", "등", "어깨", "팔", "하체", "코어", "전신"].map(
                    (part) => {
                      const selected = ptBodyParts.includes(part);
                      return (
                        <TouchableOpacity
                          key={part}
                          onPress={() =>
                            setPtBodyParts((prev) =>
                              selected
                                ? prev.filter((p) => p !== part)
                                : [...prev, part],
                            )
                          }
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: 20,
                            backgroundColor: selected
                              ? Colors.green
                              : Colors.bgSub,
                            borderWidth: 1,
                            borderColor: selected
                              ? Colors.green
                              : Colors.border,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: selected ? "#fff" : Colors.textSub,
                            }}
                          >
                            {part}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>

              {/* 컨디션 선택 */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  컨디션
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {[
                    { label: "최상", score: 4 },
                    { label: "좋음", score: 3 },
                    { label: "보통", score: 2 },
                    { label: "나쁨", score: 1 },
                  ].map(({ label, score }) => {
                    const selected = ptCondition === score;
                    return (
                      <TouchableOpacity
                        key={score}
                        onPress={() => setPtCondition(selected ? null : score)}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          borderRadius: 20,
                          alignItems: "center",
                          backgroundColor: selected
                            ? Colors.green
                            : Colors.bgSub,
                          borderWidth: 1,
                          borderColor: selected ? Colors.green : Colors.border,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color: selected ? "#fff" : Colors.textSub,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 운동 목록 */}
              {exercises.map((ex, ei) => (
                <View
                  key={ei}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  {/* 운동명 */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <TextInput
                        value={ex.name}
                        onChangeText={(v) => {
                          const u = [...exercises];
                          u[ei].name = v;
                          setExercises(u);
                          const suggestions = getExerciseNameSuggestions(v);
                          setExerciseSuggest(
                            suggestions.length > 0
                              ? { ei, names: suggestions }
                              : null,
                          );
                        }}
                        onBlur={() =>
                          setTimeout(() => setExerciseSuggest(null), 150)
                        }
                        onSubmitEditing={() => setExerciseSuggest(null)}
                        returnKeyType="done"
                        placeholder="운동명"
                        placeholderTextColor={Colors.textPlaceholder}
                        style={{
                          backgroundColor: Colors.bgSub,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          borderRadius: 9,
                          paddingHorizontal: 9,
                          paddingVertical: 0,
                          height: 34,
                          fontSize: 13,
                          fontWeight: "800",
                          color: Colors.text,
                        }}
                      />
                    </View>
                    {exercises.length > 1 && (
                      <TouchableOpacity
                        onPress={() =>
                          setExercises(exercises.filter((_, i) => i !== ei))
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 9,
                          backgroundColor: Colors.bgSub,
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: Colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 16, color: Colors.textMuted }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 운동명 자동완성 */}
                  {exerciseSuggest?.ei === ei &&
                    exerciseSuggest.names.length > 0 && (
                      <View
                        style={{
                          backgroundColor: "#fff",
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: Colors.border,
                          marginBottom: 10,
                          overflow: "hidden",
                        }}
                      >
                        {exerciseSuggest.names.map((name, ni) => (
                          <TouchableOpacity
                            key={ni}
                            onPress={() => {
                              const u = [...exercises];
                              u[ei].name = name;
                              setExercises(u);
                              setExerciseSuggest(null);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderBottomWidth:
                                ni < exerciseSuggest.names.length - 1 ? 1 : 0,
                              borderBottomColor: Colors.border,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                color: Colors.text,
                                fontWeight: "600",
                              }}
                            >
                              {name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                  {/* 세트 입력 */}
                  <View style={{ gap: 4 }}>
                    {ex.sets.map((s, si) => (
                      <View
                        key={s._key}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        {/* 세트 번호 */}
                        <View style={{ width: 22, height: 30, borderRadius: 7, backgroundColor: Colors.green, justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ fontSize: 11, fontWeight: "900", color: "#fff" }}>{si + 1}</Text>
                        </View>
                        {/* kg 입력 */}
                        <View style={{ flex: 1, height: 30, flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgSub, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8 }}>
                          <TextInput
                            value={s.weight}
                            onChangeText={(v) => { const u = [...exercises]; u[ei].sets[si].weight = v; setExercises(u); }}
                            placeholder="0"
                            placeholderTextColor={Colors.textPlaceholder}
                            keyboardType="decimal-pad"
                            style={{ flex: 1, height: 30, fontSize: 12, color: Colors.text, paddingVertical: 0 }}
                          />
                          <Text style={{ fontSize: 10, color: Colors.textMuted }}>kg</Text>
                        </View>
                        {/* 회 입력 */}
                        <View style={{ flex: 1, height: 30, flexDirection: "row", alignItems: "center", backgroundColor: Colors.bgSub, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8 }}>
                          <TextInput
                            value={s.reps}
                            onChangeText={(v) => { const u = [...exercises]; u[ei].sets[si].reps = v; setExercises(u); }}
                            placeholder="0"
                            placeholderTextColor={Colors.textPlaceholder}
                            keyboardType="number-pad"
                            style={{ flex: 1, height: 30, fontSize: 12, color: Colors.text, paddingVertical: 0 }}
                          />
                          <Text style={{ fontSize: 10, color: Colors.textMuted }}>회</Text>
                        </View>
                        {/* ✕ 버튼 */}
                        <TouchableOpacity
                          onPress={() => {
                            if (ex.sets.length <= 1) return;
                            const u = [...exercises];
                            u[ei].sets = u[ei].sets.filter((_, i) => i !== si);
                            setExercises(u);
                          }}
                          style={{ height: 30, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#D1D5DB", justifyContent: "center", alignItems: "center", opacity: ex.sets.length <= 1 ? 0.3 : 1 }}
                        >
                          <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "700" }}>✕</Text>
                        </TouchableOpacity>
                        {/* + 버튼 */}
                        <TouchableOpacity
                          onPress={() => {
                            const u = [...exercises];
                            u[ei].sets.splice(si + 1, 0, { setId: undefined, _key: Date.now(), weight: "", reps: "" });
                            setExercises(u);
                          }}
                          style={{ height: 30, paddingHorizontal: 8, borderRadius: 8, backgroundColor: Colors.green + "22", borderWidth: 1, borderColor: Colors.green + "55", justifyContent: "center", alignItems: "center" }}
                        >
                          <Text style={{ fontSize: 13, color: Colors.green, fontWeight: "900" }}>+</Text>
                        </TouchableOpacity>
                        {/* 복사 버튼: 현재 세트와 같은 값으로 바로 아래에 새 세트 추가 */}
                        <TouchableOpacity
                          onPress={() => {
                            const u = [...exercises];
                            u[ei].sets.splice(si + 1, 0, { setId: undefined, _key: Date.now(), weight: s.weight, reps: s.reps });
                            setExercises(u);
                          }}
                          style={{ height: 30, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#D1D5DB", justifyContent: "center", alignItems: "center" }}
                        >
                          <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "700" }}>복사</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  {/* 이전 기록 힌트 — 마지막 세트 아래 */}
                  {(() => {
                    const latest = getLatestSameExercise(ex.name);
                    if (!latest) return null;
                    return (
                      <View style={{ marginTop: 6, backgroundColor: Colors.greenLight, borderRadius: 8, padding: 6, borderWidth: 1, borderColor: Colors.green + "33" }}>
                        <Text style={{ fontSize: 10, color: Colors.green, fontWeight: "800", marginBottom: 5 }}>
                          이전 기록 {latest.date} · 누르면 입력
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {latest.exercise.sets?.map((prevSet: any, prevIdx: number) => (
                            <TouchableOpacity
                              key={prevIdx}
                              onPress={() => {
                                const u = [...exercises];
                                while (u[ei].sets.length <= prevIdx) {
                                  u[ei].sets.push({ setId: undefined, _key: Date.now(), weight: "", reps: "" });
                                }
                                u[ei].sets[prevIdx].weight = prevSet.weight ? String(prevSet.weight) : "";
                                u[ei].sets[prevIdx].reps = prevSet.reps ? String(prevSet.reps) : "";
                                setExercises(u);
                              }}
                              style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.green + "33" }}
                            >
                              <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "900" }}>{prevIdx + 1}</Text>
                              <Text style={{ fontSize: 11, color: Colors.text, fontWeight: "700" }}>
                                {"  "}{prevSet.weight ? `${prevSet.weight}kg × ` : ""}{prevSet.reps}회
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    );
                  })()}

                  {/* 운동별 메모 */}
                  <TextInput
                    value={ex.memo}
                    onChangeText={(v) => {
                      const u = [...exercises];
                      u[ei].memo = v;
                      setExercises(u);
                    }}
                    placeholder="운동 메모 (선택)"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 9,
                      paddingVertical: 6,
                      fontSize: 12,
                      color: Colors.text,
                      marginTop: 6,
                    }}
                  />

                  {/* 운동별 미디어 (최대 3개) */}
                  <View style={{ marginTop: 8 }}>
                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {/* 기존 미디어 */}
                      {(ex.existingMediaList ?? []).map((m, mIdx) => (
                        <View
                          key={`existing-${mIdx}`}
                          style={{ position: "relative" }}
                        >
                          <TouchableOpacity
                            onPress={() => setSelectedMedia(m as any)}
                          >
                            <Image
                              source={{
                                uri:
                                  m.mediaType === "VIDEO"
                                    ? m.url.replace(
                                        /\.(mp4|mov|avi|webm)(\?.*)?$/i,
                                        ".jpg",
                                      )
                                    : m.url,
                              }}
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 8,
                                backgroundColor: Colors.bgSub,
                              }}
                              resizeMode="cover"
                            />
                            {m.mediaType === "VIDEO" && (
                              <View
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  justifyContent: "center",
                                  alignItems: "center",
                                  backgroundColor: "rgba(0,0,0,0.3)",
                                  borderRadius: 8,
                                }}
                              >
                                <Text style={{ color: "#fff", fontSize: 16 }}>
                                  ▶
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => removeMedia(ei, "existing", mIdx)}
                            style={{
                              position: "absolute",
                              top: -6,
                              right: -6,
                              backgroundColor: Colors.red,
                              borderRadius: 10,
                              width: 18,
                              height: 18,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: "800",
                              }}
                            >
                              ×
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {/* 새로 추가한 미디어 */}
                      {(ex.mediaFiles ?? []).map((f, fIdx) => (
                        <View
                          key={`new-${fIdx}`}
                          style={{ position: "relative" }}
                        >
                          {f.type === "image" ? (
                            <Image
                              source={{ uri: f.uri }}
                              style={{ width: 64, height: 64, borderRadius: 8 }}
                              resizeMode="cover"
                            />
                          ) : (
                            <View
                              style={{
                                width: 64,
                                height: 64,
                                borderRadius: 8,
                                backgroundColor: "#1a1a2e",
                                justifyContent: "center",
                                alignItems: "center",
                              }}
                            >
                              <Text style={{ fontSize: 20 }}>🎬</Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => removeMedia(ei, "new", fIdx)}
                            style={{
                              position: "absolute",
                              top: -6,
                              right: -6,
                              backgroundColor: Colors.red,
                              borderRadius: 10,
                              width: 18,
                              height: 18,
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: "800",
                              }}
                            >
                              ×
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      {/* 추가 버튼 (3개 미만일 때만) */}
                      {(ex.mediaFiles ?? []).length +
                        (ex.existingMediaList ?? []).length <
                        3 && (
                        <TouchableOpacity
                          onPress={() => handlePickMedia(ei)}
                          style={{
                            width: 64,
                            height: 64,
                            borderWidth: 1,
                            borderStyle: "dashed",
                            borderColor: Colors.green + "66",
                            borderRadius: 8,
                            backgroundColor: Colors.greenLight,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 20, color: Colors.green }}>
                            +
                          </Text>
                          <Text
                            style={{
                              fontSize: 9,
                              color: Colors.green,
                              marginTop: 2,
                            }}
                          >
                            사진/영상
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                </View>
              ))}

              {/* + 운동 추가 */}
              <TouchableOpacity
                onPress={() =>
                  setExercises([
                    ...exercises,
                    {
                      name: "",
                      sets: [{ setId: undefined, _key: Date.now(), weight: "", reps: "" }],
                      memo: "",
                      mediaFiles: [],
                      existingMediaList: [],
                    },
                  ])
                }
                style={{
                  backgroundColor: Colors.greenLight,
                  borderWidth: 1,
                  borderColor: Colors.green + "44",
                  borderRadius: 10,
                  padding: 10,
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: Colors.green,
                    fontWeight: "700",
                  }}
                >
                  + 운동 추가
                </Text>
              </TouchableOpacity>

              {/* 오늘 수업 피드백 */}
              <View style={{ marginBottom: 14 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  오늘 수업 피드백 (선택)
                </Text>
                <TextInput
                  value={ptWorkoutFeedback}
                  onChangeText={setPtWorkoutFeedback}
                  placeholder="오늘 수업에 대한 피드백을 입력하세요..."
                  placeholderTextColor={Colors.textPlaceholder}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 10,
                    fontSize: 13,
                    color: Colors.text,
                    textAlignVertical: "top",
                    minHeight: 70,
                  }}
                />
              </View>

              {/* 다음 수업 전 챌린지 — OT 회원은 표시 안 함 */}
              {!isOt && (
                <View style={{ marginBottom: 16 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 3,
                        height: 14,
                        backgroundColor: "#f97316",
                        borderRadius: 2,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: Colors.text,
                      }}
                    >
                      다음 수업 전 챌린지
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      (선택)
                    </Text>
                  </View>
                  {ptMissions.map((m, idx) => (
                    <View
                      key={idx}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={{ color: "#f97316", fontSize: 14 }}>•</Text>
                      <TextInput
                        value={m}
                        onChangeText={(v) => {
                          const next = [...ptMissions];
                          next[idx] = v;
                          setPtMissions(next);
                        }}
                        placeholder={
                          idx === 0 ? "예: 스쿼트 50개" : "예: 물 2L 마시기"
                        }
                        placeholderTextColor={Colors.textPlaceholder}
                        style={{
                          flex: 1,
                          backgroundColor: "#fff",
                          borderWidth: 1,
                          borderColor: m ? "#f97316" : Colors.border,
                          borderRadius: 8,
                          padding: 8,
                          fontSize: 13,
                          color: Colors.text,
                        }}
                      />
                      {ptMissions.length > 1 && (
                        <TouchableOpacity
                          onPress={() =>
                            setPtMissions(
                              ptMissions.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Text
                            style={{ fontSize: 18, color: Colors.textMuted }}
                          >
                            ×
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {ptMissions.length < 5 && (
                    <TouchableOpacity
                      onPress={() => setPtMissions([...ptMissions, ""])}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: "#f9731666",
                        borderRadius: 8,
                        backgroundColor: "#fff7ed",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: "#f97316",
                          fontWeight: "700",
                        }}
                      >
                        + 챌린지 추가
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* 저장 버튼 */}
              <TouchableOpacity
                onPress={checkScheduleAndSave}
                disabled={savingFitLog}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 14,
                  padding: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}
                >
                  {savingFitLog
                    ? "저장 중..."
                    : editingFitLogId
                      ? isOt
                        ? "OT 수정 완료"
                        : "PT 수정 완료"
                      : isManual
                        ? isOt
                          ? "OT 수업 저장"
                          : "PT 수업 저장"
                        : "PT 수업 등록 + 회원 알림"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 운동로그 카카오톡 공유 확인 모달 */}
      <Modal
        visible={smsPromptData.visible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setSmsPromptData((p) => ({ ...p, visible: false }))
        }
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 20,
              padding: 24,
              width: "100%",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "800",
                color: Colors.text,
                marginBottom: 8,
              }}
            >
              기록 저장 완료
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: Colors.textSub,
                lineHeight: 22,
                marginBottom: 24,
              }}
            >
              {member?.user?.name}님에게 카카오톡으로{" "}
              {isOt ? "체험 수업 완료 안내" : "앱 설치 안내와 운동로그"}를
              공유할까요?
              {trainerInviteCode
                ? "\n트레이너 코드는 자동으로 메시지에 포함돼요."
                : "\n트레이너 코드를 찾지 못하면 앱에서 확인 후 따로 안내해주세요."}
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() =>
                  setSmsPromptData((p) => ({ ...p, visible: false }))
                }
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                  backgroundColor: Colors.bgSub,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: Colors.textSub,
                  }}
                >
                  나중에
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareManualWorkoutLog}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: Colors.green,
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                >
                  카카오톡 공유
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 운동 기록 전체보기 모달 */}
      <Modal
        visible={showHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View
            style={{
              flex: 1,
              marginTop: 60,
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            {/* 헤더 */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 20,
                paddingTop: 20,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: Colors.border,
              }}
            >
              <Text
                style={{ fontSize: 17, fontWeight: "800", color: Colors.text }}
              >
                {member?.user?.name}님 운동 기록
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <TouchableOpacity
                  onPress={exportWorkoutPdf}
                  disabled={pdfGenerating}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: Colors.bgSub,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    opacity: pdfGenerating ? 0.5 : 1,
                  }}
                >
                  {pdfGenerating ? (
                    <ActivityIndicator size="small" color={Colors.textMuted} />
                  ) : (
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.textSub,
                        fontWeight: "700",
                      }}
                    >
                      PDF
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                  <Text style={{ fontSize: 22, color: Colors.textMuted }}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {allFitLogs.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📋</Text>
                <Text style={{ fontSize: 15, color: Colors.textMuted }}>
                  등록된 운동 기록이 없어요
                </Text>
              </View>
            ) : (
              <HistoryTable
                logs={allFitLogs}
                trainerPlan={trainerPlan}
                onViewMedia={(mediaList) => {
                  setShowHistoryModal(false);
                  setMediaGallery(mediaList);
                  setMediaGalleryIndex(0);
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* PT 직접 수정 모달 */}
      <Modal
        visible={showPtDirectEdit}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPtDirectEdit(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => setShowPtDirectEdit(false)}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: Math.max(insets.bottom, 24),
            }}
          >
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
                marginBottom: 4,
              }}
            >
              PT 횟수 수정
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: Colors.textMuted,
                marginBottom: 20,
              }}
            >
              잔여 PT와 총 횟수를 직접 수정해요
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  잔여 PT
                </Text>
                <TextInput
                  value={ptDirectForm.remaining}
                  onChangeText={(v) =>
                    setPtDirectForm((p) => ({
                      ...p,
                      remaining: v.replace(/[^0-9]/g, ""),
                    }))
                  }
                  keyboardType="numeric"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1.5,
                    borderColor: Colors.border,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 18,
                    fontWeight: "700",
                    color: "#4A90FF",
                    textAlign: "center",
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: Colors.textSub,
                    marginBottom: 6,
                  }}
                >
                  총 횟수
                </Text>
                <TextInput
                  value={ptDirectForm.total}
                  onChangeText={(v) =>
                    setPtDirectForm((p) => ({
                      ...p,
                      total: v.replace(/[^0-9]/g, ""),
                    }))
                  }
                  keyboardType="numeric"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1.5,
                    borderColor: Colors.border,
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 18,
                    fontWeight: "700",
                    color: Colors.text,
                    textAlign: "center",
                  }}
                />
              </View>
            </View>
            <TouchableOpacity
              onPress={savePtDirect}
              disabled={savingPtDirect}
              style={{
                backgroundColor: Colors.green,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>
                {savingPtDirect ? "저장 중..." : "저장"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PT 수정 모달 */}
      <Modal
        visible={showPTEdit}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPtForm({
            sessions: "0",
            remaining: "",
            amount: "",
            contractDate: todayStr,
            startDate: todayStr,
            endDate: "",
            memo: "",
          });
          setShowPTEdit(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
            activeOpacity={1}
            onPress={() => {
              setPtForm({
                sessions: "0",
                remaining: "",
                amount: "",
                contractDate: todayStr,
                startDate: todayStr,
                endDate: "",
                memo: "",
              });
              setShowPTEdit(false);
            }}
          />
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: Math.max(insets.bottom, 24),
            }}
          >
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
                marginBottom: 4,
              }}
            >
              {!member?.ptTotal || member.ptTotal === 0
                ? "PT 등록"
                : "PT 추가 등록"}
            </Text>
            {!member?.ptTotal || member.ptTotal === 0 ? null : (
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                현재 잔여: {member?.ptRemaining ?? 0}회 · 총:{" "}
                {member?.ptTotal ?? 0}회
              </Text>
            )}

            {/* 첫 등록일 표시 (이미 PT가 있는 경우) */}
            {member?.ptStartDate && (member?.ptTotal ?? 0) > 0 && (
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                  첫 PT 등록일:
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Colors.text,
                  }}
                >
                  {member.ptStartDate}
                </Text>
              </View>
            )}

            {/* 첫 PT 등록 시 — 기존회원 추가 스타일 폼 */}
            {(!member?.ptTotal || member.ptTotal === 0) && (
              <>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 4,
                  }}
                >
                  첫 PT 결제 수 (회) *
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  처음 등록할 때 구매한 총 수업 수
                </Text>
                <TextInput
                  value={ptForm.sessions === "0" ? "" : ptForm.sessions}
                  onChangeText={(v) =>
                    setPtForm((f) => ({
                      ...f,
                      sessions: v.replace(/[^0-9]/g, "") || "0",
                    }))
                  }
                  placeholder="예: 20"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 12,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 4,
                  }}
                >
                  현재 잔여 PT 수 (회) *
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  지금까지 수업을 진행하고 남은 횟수
                </Text>
                <TextInput
                  value={ptForm.remaining}
                  onChangeText={(v) =>
                    setPtForm((f) => ({
                      ...f,
                      remaining: v.replace(/[^0-9]/g, ""),
                    }))
                  }
                  placeholder="예: 15"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 12,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 4,
                  }}
                >
                  결제 금액 (원)
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  첫 PT 결제 금액 — 매출 집계에 사용돼요
                </Text>
                <TextInput
                  value={ptForm.amount}
                  onChangeText={(text) => {
                    const digits = text.replace(/[^0-9]/g, "");
                    setPtForm((f) => ({
                      ...f,
                      amount: digits ? Number(digits).toLocaleString() : "",
                    }));
                  }}
                  placeholder="예: 500,000"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 12,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 4,
                  }}
                >
                  결제일 *
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.textMuted,
                    marginBottom: 8,
                  }}
                >
                  처음 PT를 결제한 날짜
                </Text>
                <TextInput
                  value={ptForm.contractDate}
                  onChangeText={(text) => {
                    const digits = text.replace(/[^0-9]/g, "").slice(0, 8);
                    const fmt =
                      digits.length > 6
                        ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
                        : digits.length > 4
                          ? `${digits.slice(0, 4)}-${digits.slice(4)}`
                          : digits;
                    setPtForm((f) => ({
                      ...f,
                      contractDate: fmt,
                      startDate: fmt,
                    }));
                    if (digits.length === 8) Keyboard.dismiss();
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />
              </>
            )}

            {/* 추가 횟수 +/- UI — 기존 PT 있을 때만 */}
            {(member?.ptTotal ?? 0) > 0 && (
              <>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  추가할 횟수
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      setPtForm((f) => ({
                        ...f,
                        sessions: String(Math.max(0, Number(f.sessions) - 1)),
                      }))
                    }
                    style={{
                      padding: 12,
                      borderRightWidth: 1,
                      borderRightColor: Colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 18, color: Colors.textMuted }}>
                      −
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    value={ptForm.sessions}
                    onChangeText={(v) =>
                      setPtForm((f) => ({
                        ...f,
                        sessions: v.replace(/[^0-9]/g, ""),
                      }))
                    }
                    keyboardType="number-pad"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 24,
                      fontWeight: "800",
                      color: Colors.green,
                      paddingVertical: 10,
                    }}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setPtForm((f) => ({
                        ...f,
                        sessions: String(Number(f.sessions) + 1),
                      }))
                    }
                    style={{
                      padding: 12,
                      borderLeftWidth: 1,
                      borderLeftColor: Colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 18, color: Colors.green }}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* 추가 후 잔여 미리보기 */}
                <View
                  style={{
                    backgroundColor: Colors.greenLight,
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 12,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textMuted,
                      marginBottom: 2,
                    }}
                  >
                    추가 후 잔여
                  </Text>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "900",
                      color: Colors.green,
                    }}
                  >
                    {(member?.ptRemaining ?? 0) + Number(ptForm.sessions || 0)}
                    회
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  계약 시작일
                </Text>
                <TextInput
                  value={ptForm.startDate}
                  onChangeText={(v) => {
                    const n = v.replace(/[^0-9]/g, "").slice(0, 8);
                    const fmt =
                      n.length > 6
                        ? `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6)}`
                        : n.length > 4
                          ? `${n.slice(0, 4)}-${n.slice(4)}`
                          : n;
                    setPtForm((f) => ({ ...f, startDate: fmt }));
                    if (n.length === 8) Keyboard.dismiss();
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 10,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  만료일 (선택)
                </Text>
                <TextInput
                  value={ptForm.endDate}
                  onChangeText={(v) => {
                    const n = v.replace(/[^0-9]/g, "").slice(0, 8);
                    const fmt =
                      n.length > 6
                        ? `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6)}`
                        : n.length > 4
                          ? `${n.slice(0, 4)}-${n.slice(4)}`
                          : n;
                    setPtForm((f) => ({ ...f, endDate: fmt }));
                    if (n.length === 8) Keyboard.dismiss();
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 10,
                  }}
                />
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  메모
                </Text>
                <TextInput
                  value={ptForm.memo}
                  onChangeText={(v) => setPtForm((f) => ({ ...f, memo: v }))}
                  placeholder="예: 추가 결제 10회"
                  placeholderTextColor={Colors.textPlaceholder}
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                    marginBottom: 16,
                  }}
                />
              </>
            )}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setPtForm({
                    sessions: "0",
                    remaining: "",
                    amount: "",
                    contractDate: todayStr,
                    startDate: todayStr,
                    endDate: "",
                    memo: "",
                  });
                  setShowPTEdit(false);
                }}
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
                onPress={savePT}
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
                  추가 등록
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 미디어 풀스크린 뷰어 */}
      {/* 갤러리 뷰어 모달 */}
      <Modal
        visible={mediaGallery.length > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setMediaGallery([])}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              right: 0,
              zIndex: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 20,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "700",
                opacity: 0.8,
              }}
            >
              {mediaGalleryIndex + 1} / {mediaGallery.length}
            </Text>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <TouchableOpacity
                onPress={() =>
                  !mediaDownloading &&
                  handleDownloadMedia(mediaGallery[mediaGalleryIndex])
                }
                style={{ padding: 8, opacity: mediaDownloading ? 0.5 : 1 }}
              >
                {mediaDownloading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text
                    style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
                  >
                    저장
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMediaGallery([])}
                style={{ padding: 8 }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}
                >
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / FULL_W);
              setMediaGalleryIndex(idx);
            }}
            style={{ flex: 1 }}
          >
            {mediaGallery.map((media, idx) => (
              <View
                key={idx}
                style={{
                  width: FULL_W,
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {media.mediaType === "IMAGE" ? (
                  <ScrollView
                    style={{ width: FULL_W, height: FULL_H }}
                    contentContainerStyle={{
                      flex: 1,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    maximumZoomScale={4}
                    minimumZoomScale={1}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    centerContent
                  >
                    <Image
                      source={{ uri: media.url }}
                      style={{ width: FULL_W, height: FULL_H }}
                      resizeMode="contain"
                    />
                  </ScrollView>
                ) : (
                  <Video
                    source={{ uri: media.url }}
                    style={{ width: FULL_W, height: FULL_H * 0.7 }}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    shouldPlay={idx === mediaGalleryIndex}
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {mediaGallery.length > 1 && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
              }}
            >
              {mediaGallery.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      i === mediaGalleryIndex
                        ? "#fff"
                        : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </View>
          )}
        </View>
      </Modal>

      {/* 업그레이드 바텀시트 (비활성화 - 전체 무료 제공 중) */}
      <Modal
        visible={false}
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
                  marginBottom: 20,
                }}
              >
                PRO 플랜으로 업그레이드
              </Text>
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
                      12,900
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
                  {"✓ 회원 무제한 관리\n   PRO로 업그레이드해서 회원 수 제한 없이\n   모든 회원을 관리할 수 있어요."}
                </Text>
              </View>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (
                      !Purchases ||
                      typeof Purchases.getOfferings !== "function"
                    ) {
                      Alert.alert("오류", "결제 모듈을 불러오지 못했어요.");
                      return;
                    }
                    const offerings = await Purchases.getOfferings();
                    const current = offerings?.current;
                    const pkg =
                      current?.monthly ??
                      current?.availablePackages?.find((p: any) => p.identifier === "$rc_monthly") ??
                      current?.availablePackages?.[0];
                    if (!pkg) {
                      Alert.alert("오류", "구독 상품을 불러오지 못했어요.");
                      return;
                    }
                    await Purchases.purchasePackage(pkg);
                    setTrainerPlan("PRO");
                    setPaymentVisible(false);
                    Alert.alert("구독 완료!", "PRO 플랜이 활성화됐어요.");
                  } catch (e: any) {
                    if (!e.userCancelled)
                      Alert.alert(
                        "결제 실패",
                        e.message ?? "다시 시도해주세요.",
                      );
                  }
                }}
                style={{
                  backgroundColor: Colors.green,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}
                >
                  시작하기
                </Text>
              </TouchableOpacity>

              <Text style={{ textAlign: "center", fontSize: 11, color: Colors.textMuted, lineHeight: 17, marginTop: 20, marginBottom: 4 }}>
                {Platform.OS === "ios"
                  ? "구독은 매월 자동 갱신되며, 다음 결제일 24시간 전까지\nApple ID 설정 > 구독에서 취소할 수 있습니다.\n환불은 Apple 정책에 따릅니다."
                  : "구독은 매월 자동 갱신되며, 다음 결제일 24시간 전까지\nGoogle Play에서 취소할 수 있습니다.\n환불은 Google Play 정책에 따릅니다."}
              </Text>
              <TouchableOpacity style={{ marginTop: 8 }} onPress={() => setPaymentVisible(false)}>
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

      {/* ⋮ 메뉴 바텀시트 */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={closeMenuModal}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
          activeOpacity={1}
          onPress={closeMenuModal}
        />
        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 34,
            transform: [{ translateY: menuModalY }],
          }}
        >
          {/* 드래그 핸들 */}
          <View
            {...menuPanResponder.panHandlers}
            style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D1D5DB",
              }}
            />
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            {isManual ? (
              /* 미연동 회원: 삭제 */
              <TouchableOpacity
                onPress={() => {
                  closeMenuModal();
                  setTimeout(() => handleDeleteManualMember(), 300);
                }}
                style={{
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
              >
                <Text
                  style={{ fontSize: 16, color: "#EF4444", fontWeight: "600" }}
                >
                  회원 삭제
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  운동 기록 등 모든 데이터가 삭제돼요
                </Text>
              </TouchableOpacity>
            ) : (
              /* 연동 회원: 연결 해제 */
              <TouchableOpacity
                onPress={() => {
                  closeMenuModal();
                  setTimeout(() => handleDisconnectMember(), 300);
                }}
                style={{
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: Colors.border,
                }}
              >
                <Text
                  style={{ fontSize: 16, color: "#EF4444", fontWeight: "600" }}
                >
                  연결 해제
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginTop: 2,
                  }}
                >
                  회원 데이터는 유지되며 트레이너 연결만 해제돼요
                </Text>
              </TouchableOpacity>
            )}

            {/* 취소 */}
            <TouchableOpacity
              onPress={closeMenuModal}
              style={{ paddingVertical: 16, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, color: Colors.textMuted }}>
                취소
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* 회원 초대 모달 */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setInviteModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 28,
                paddingBottom: Math.max(insets.bottom, 28),
              }}
            >
              <View style={{ alignItems: "center", paddingBottom: 12, marginTop: -8 }}>
                <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99 }} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text, marginBottom: 6 }}>
                회원 초대하기 🔗
              </Text>
              <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 24 }}>
                아래 코드를 회원에게 공유하면 자동으로 연결돼요
              </Text>
              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 14,
                  padding: 20,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: 20,
                }}
              >
                <Text style={{ fontSize: 13, color: Colors.textMuted, marginBottom: 6 }}>🔑 내 트레이너 코드</Text>
                <Text style={{ fontSize: 32, fontWeight: "900", color: Colors.green, letterSpacing: 4 }}>
                  {trainerInviteCode || "-"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleInviteKakao}
                style={{
                  backgroundColor: "#FEE500",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#3C1E1E" }}>카카오톡으로 공유하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleInviteCopy}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>코드 복사하기</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 바디로그 수정 모달 */}
      <Modal visible={!!editingLog} transparent animationType="fade" onRequestClose={() => setEditingLog(null)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }} activeOpacity={1} onPress={() => setEditingLog(null)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ backgroundColor: Colors.bg, borderRadius: 16, padding: 24, width: "88%", gap: 14 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: Colors.text, marginBottom: 4 }}>바디로그 수정</Text>

            <View>
              <Text style={{ fontSize: 12, color: Colors.textSub, marginBottom: 6 }}>날짜 (YYYY-MM-DD)</Text>
              <TextInput
                value={editingLog?.date ?? ""}
                onChangeText={(v) => setEditingLog((p) => p ? { ...p, date: v } : p)}
                placeholder="2025-01-01"
                placeholderTextColor={Colors.textMuted}
                style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, color: Colors.text, fontSize: 14 }}
              />
            </View>

            {[
              { label: "체중 (kg)", key: "weight" as const, placeholder: "0.0" },
              { label: "체지방량 (kg)", key: "bodyFatMass" as const, placeholder: "0.0" },
              { label: "근육량 (kg)", key: "muscleMass" as const, placeholder: "0.0" },
            ].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={{ fontSize: 12, color: Colors.textSub, marginBottom: 6 }}>{label}</Text>
                <TextInput
                  value={editingLog?.[key] ?? ""}
                  onChangeText={(v) => setEditingLog((p) => p ? { ...p, [key]: v } : p)}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  style={{ borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 10, color: Colors.text, fontSize: 14 }}
                />
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <TouchableOpacity onPress={() => setEditingLog(null)} style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: Colors.textSub }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditBodyLog} disabled={editSaving} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: Colors.green, alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>{editSaving ? "저장 중..." : "저장"}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
