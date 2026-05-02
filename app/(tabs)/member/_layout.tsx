import { Tabs } from "expo-router";
import { Text, View } from "react-native"; // ✅ require() 제거, 상단 import로
import { Colors } from "../../../constants/Colors";

export default function MemberTabLayout() {
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
        tabBarActiveTintColor: Colors.blue,
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
            <TabIcon emoji="🏠" focused={focused} color={color} activeColor={Colors.blue} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "일정",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="📅" focused={focused} color={color} activeColor={Colors.blue} />
          ),
        }}
      />
      <Tabs.Screen
        name="diet"
        options={{
          title: "식단",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="🍽" focused={focused} color={color} activeColor={Colors.blue} />
          ),
        }}
      />
      <Tabs.Screen
        name="growth"
        options={{
          title: "성장",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="📊" focused={focused} color={color} activeColor={Colors.blue} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "더보기",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon emoji="⚙️" focused={focused} color={color} activeColor={Colors.blue} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  emoji,
  focused,
  activeColor = Colors.blue,
}: {
  emoji: string;
  focused: boolean;
  color: string;
  activeColor?: string;
}) {
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: focused ? activeColor + "22" : "transparent",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
    </View>
  );
}