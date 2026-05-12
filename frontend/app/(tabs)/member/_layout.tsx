import { Tabs } from "expo-router";
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
          height: 56,
          paddingTop: 6,
          paddingBottom: 8,
        },

        tabBarActiveTintColor: Colors.blue,
        tabBarInactiveTintColor: Colors.textMuted,

        tabBarIconStyle: {
          display: "none",
        },

        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "홈" }} />
      <Tabs.Screen name="diet" options={{ title: "식단로그" }} />
      <Tabs.Screen name="workout" options={{ title: "운동로그" }} />
      <Tabs.Screen name="growth" options={{ title: "바디로그" }} />
      <Tabs.Screen name="more" options={{ title: "내정보" }} />
      
      <Tabs.Screen name="schedule" options={{ href: null,}}/>
      <Tabs.Screen name="notifications" options={{ href: null,}}/>
      </Tabs>
  );
}