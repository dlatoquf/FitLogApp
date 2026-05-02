/**
 * FitLog 공통 UI 컴포넌트
 */
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Colors } from "../../constants/Colors";

// ── 진행 바 ────────────────────────────────────────────────────────────────────
interface ProgressBarProps {
  pct: number;
  color?: string;
  height?: number;
  backgroundColor?: string;
}
export function ProgressBar({
  pct,
  color = Colors.green,
  height = 6,
  backgroundColor = Colors.border,
}: ProgressBarProps) {
  const safePct = Math.min(Math.max(pct || 0, 0), 100);
  return (
    <View
      style={{
        backgroundColor,
        borderRadius: 99,
        height,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${safePct}%` as any,
          height,
          backgroundColor: color,
          borderRadius: 99,
        }}
      />
    </View>
  );
}

// ── 섹션 타이틀 ───────────────────────────────────────────────────────────────
interface SectionTitleProps {
  title: string;
  color?: string;
  rightElement?: React.ReactNode;
}
export function SectionTitle({
  title,
  color = Colors.green,
  rightElement,
}: SectionTitleProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        marginTop: 4,
      }}
    >
      <View
        style={{
          width: 3,
          height: 16,
          backgroundColor: color,
          borderRadius: 2,
        }}
      />
      <Text
        style={{ fontSize: 15, fontWeight: "700", color: Colors.text, flex: 1 }}
      >
        {title}
      </Text>
      {rightElement}
    </View>
  );
}

// ── 아바타 ────────────────────────────────────────────────────────────────────
interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
  fontSize?: number;
}
export function Avatar({
  name,
  size = 40,
  color = Colors.green,
  fontSize = 16,
}: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: color,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize, fontWeight: "800", color: "#fff" }}>
        {name?.[0] ?? "?"}
      </Text>
    </View>
  );
}

// ── 배지 ──────────────────────────────────────────────────────────────────────
interface BadgeProps {
  label: string;
  color?: string;
  textColor?: string;
}
export function Badge({
  label,
  color = Colors.green,
  textColor = "#fff",
}: BadgeProps) {
  return (
    <View
      style={{
        backgroundColor: color,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 8,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: textColor }}>
        {label}
      </Text>
    </View>
  );
}

// ── 기본 버튼 ─────────────────────────────────────────────────────────────────
interface ButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  textColor?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: object;
}
export function Button({
  label,
  onPress,
  color = Colors.green,
  textColor = "#fff",
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          backgroundColor: disabled ? Colors.border : color,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={{ fontSize: 15, fontWeight: "700", color: textColor }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── 빈 상태 ───────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  emoji?: string;
  message: string;
  subMessage?: string;
}
export function EmptyState({
  emoji = "📭",
  message,
  subMessage,
}: EmptyStateProps) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48 }}>
      <Text style={{ fontSize: 40, marginBottom: 12 }}>{emoji}</Text>
      <Text style={{ fontSize: 15, color: Colors.textMuted, fontWeight: "600" }}>
        {message}
      </Text>
      {subMessage && (
        <Text
          style={{
            fontSize: 12,
            color: Colors.textPlaceholder,
            marginTop: 6,
            textAlign: "center",
          }}
        >
          {subMessage}
        </Text>
      )}
    </View>
  );
}

// ── 카드 컨테이너 ─────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: object;
  padding?: number;
}
export function Card({ children, style, padding = 16 }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.bgSub,
          borderRadius: 14,
          padding,
          borderWidth: 1,
          borderColor: Colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── 구분선 ────────────────────────────────────────────────────────────────────
export function Divider({ color = Colors.border }: { color?: string }) {
  return (
    <View style={{ height: 1, backgroundColor: color, marginVertical: 8 }} />
  );
}

// ── 로딩 오버레이 ─────────────────────────────────────────────────────────────
export function LoadingOverlay() {
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

// ── 탭 버튼 그룹 ──────────────────────────────────────────────────────────────
interface TabGroupProps {
  tabs: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  activeColor?: string;
}
export function TabGroup({
  tabs,
  activeIndex,
  onSelect,
  activeColor = Colors.green,
}: TabGroupProps) {
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onSelect(i)}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: activeIndex === i ? activeColor : Colors.bgSub,
            borderWidth: 1,
            borderColor: activeIndex === i ? activeColor : Colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: activeIndex === i ? "#fff" : Colors.textMuted,
            }}
          >
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── 주간 캘린더 ───────────────────────────────────────────────────────────────
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

interface WeekCalendarProps {
  dates: Date[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  dotDates?: { [key: string]: string[] }; // key: "YYYY-MM-DD", value: 색상 배열
}
export function WeekCalendar({
  dates,
  selectedDate,
  onSelectDate,
  dotDates = {},
}: WeekCalendarProps) {
  const toKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      {dates.map((date, i) => {
        const key = toKey(date);
        const isSelected = toKey(selectedDate) === key;
        const isToday = toKey(new Date()) === key;
        const dots = dotDates[key] || [];
        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelectDate(date)}
            style={{ alignItems: "center", gap: 4 }}
          >
            <Text
              style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}
            >
              {DAYS[i]}
            </Text>
            <View
              style={{
                width: 36,
                height: 36,
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
                  fontSize: 14,
                  fontWeight: "700",
                  color: isSelected ? "#fff" : isToday ? Colors.green : Colors.text,
                }}
              >
                {date.getDate()}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 2 }}>
              {dots.map((dotColor, di) => (
                <View
                  key={di}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 99,
                    backgroundColor: dotColor,
                  }}
                />
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
