import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";

const { width, height } = Dimensions.get("window");

const SLIDES = [
  require("../../assets/images/onboarding1.png"),
  require("../../assets/images/onboarding2.png"),
  require("../../assets/images/onboarding3.png"),
  require("../../assets/images/onboarding4.png"),
  require("../../assets/images/onboarding5.png"),
];

export default function TrainerOnboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    const next = currentIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  };

  const handleStart = () => {
    router.replace("/(tabs)/trainer/home");
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={{ width, height: height - 100, overflow: "hidden", justifyContent: "flex-start" }}>
            <Image
              source={item}
              style={{ width, height: height }}
              resizeMode="contain"
            />
          </View>
        )}
      />

      {/* 하단 컨트롤 */}
      <View
        style={{
          height: 100,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingBottom: 16,
          gap: 8,
        }}
      >
        {/* 페이지 인디케이터 */}
        <View style={{ flexDirection: "row", gap: 5, marginRight: 8 }}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === currentIndex ? 16 : 5,
                height: 5,
                borderRadius: 3,
                backgroundColor: i === currentIndex ? Colors.green : "#D1D5DB",
              }}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />

        {isLast ? (
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#256e47" : Colors.green,
              paddingVertical: 11,
              paddingHorizontal: 28,
              borderRadius: 12,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
              시작하기
            </Text>
          </Pressable>
        ) : (
          <>
            <TouchableOpacity
              onPress={handleStart}
              style={{
                paddingVertical: 11,
                paddingHorizontal: 18,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1.5,
                borderColor: "#D1D5DB",
              }}
            >
              <Text style={{ color: Colors.textMuted, fontWeight: "600", fontSize: 13 }}>
                건너뛰기
              </Text>
            </TouchableOpacity>
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "#256e47" : Colors.green,
                paddingVertical: 11,
                paddingHorizontal: 28,
                borderRadius: 12,
                alignItems: "center",
              })}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                다음
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
