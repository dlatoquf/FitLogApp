import { Tabs } from "expo-router";
import { Text, View } from "react-native"; // ✅ require() 제거, 상단 import로
import { Colors } from "../../../constants/Colors";

export default function TrainerTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.green,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: "회원",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="👥" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "일정",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="📅" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          title: "식단",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🍽" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="growth"
        options={{
          title: "성장",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="📊" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: "결제",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="💳" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "더보기",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="⚙️" focused={focused} color={color} />
          ),
        }}
      />
      {/* 숨겨진 화면들 - 탭바에 표시 안 됨 */}
      <Tabs.Screen name="member-detail" options={{ href: null }} />
      <Tabs.Screen name="fitlog-write" options={{ href: null }} />
    </Tabs>
  );
}

function TabIcon({
  emoji,
  focused,
  color,
}: {
  emoji: string;
  focused: boolean;
  color: string;
}) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: focused ? Colors.greenLight : "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
    </View>
  );
}