import { Tabs } from "expo-router";
import { Colors } from "../../../constants/Colors";

export default function TrainerTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: Colors.green,
        tabBarInactiveTintColor: Colors.textMuted,

        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 56,
          paddingTop: 8,
          paddingBottom: 8,
        },

        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "700",
        },

        tabBarIconStyle: {
          display: "none",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
        }}
      />

      <Tabs.Screen
        name="members"
        options={{
          title: "회원",
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: "일정",
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: "더보기",
        }}
      />

      <Tabs.Screen name="diet" options={{ href: null }} />
      <Tabs.Screen name="growth" options={{ href: null }} />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="member-detail" options={{ href: null }} />
      <Tabs.Screen name="fitlog-write" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}