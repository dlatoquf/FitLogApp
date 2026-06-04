import { useFocusEffect, router } from "expo-router";
import { useCallback, useState } from "react";
import {
  Dimensions,
  Image,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from "react-native";
import { Colors } from "../../../constants/Colors";

const GUIDE_IMAGES = [
  require("../../../assets/guide/page_001.jpg"),
  require("../../../assets/guide/page_002.jpg"),
  require("../../../assets/guide/page_003.jpg"),
  require("../../../assets/guide/page_004.jpg"),
  require("../../../assets/guide/page_005.jpg"),
  require("../../../assets/guide/page_006.jpg"),
  require("../../../assets/guide/page_007.jpg"),
  require("../../../assets/guide/page_008.jpg"),
  require("../../../assets/guide/page_009.jpg"),
  require("../../../assets/guide/page_010.jpg"),
  require("../../../assets/guide/page_011.jpg"),
];

const TOTAL = GUIDE_IMAGES.length;
const { width, height } = Dimensions.get("window");

export default function GuideScreen() {
  const [page, setPage] = useState(0);

  useFocusEffect(useCallback(() => {
    setPage(0);
  }, []));

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => Math.min(TOTAL - 1, p + 1));

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      {/* 상단 바 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 56,
          paddingBottom: 12,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#F0F0F0",
        }}
      >
        <TouchableOpacity onPress={() => router.replace("/(tabs)/trainer/more" as any)}>
          <Text style={{ fontSize: 14, color: "#888" }}>✕ 닫기</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 13, color: "#aaa" }}>
          {page + 1} / {TOTAL}
        </Text>
      </View>

      {/* 이미지 */}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingVertical: 32 }}>
        <Image
          source={GUIDE_IMAGES[page]}
          style={{ width: width - 48, height: height - 300, borderRadius: 12 }}
          resizeMode="contain"
        />
      </View>

      {/* 하단 네비게이션 */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingVertical: 14,
          paddingBottom: 36,
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
        }}
      >
        <TouchableOpacity
          onPress={goPrev}
          disabled={page === 0}
          style={{
            backgroundColor: page === 0 ? "#F5F5F5" : Colors.green + "15",
            borderRadius: 10,
            paddingVertical: 9,
            paddingHorizontal: 18,
            alignItems: "center",
          }}
        >
          <Text style={{ color: page === 0 ? "#ccc" : Colors.green, fontWeight: "600", fontSize: 13 }}>
            ← 이전
          </Text>
        </TouchableOpacity>

        {/* 페이지 점 인디케이터 */}
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          {GUIDE_IMAGES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setPage(i)}>
              <View
                style={{
                  width: i === page ? 7 : 5,
                  height: i === page ? 7 : 5,
                  borderRadius: 99,
                  backgroundColor: i === page ? Colors.green : "#DDD",
                }}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          onPress={goNext}
          disabled={page === TOTAL - 1}
          style={{
            backgroundColor: page === TOTAL - 1 ? "#F5F5F5" : Colors.green + "15",
            borderRadius: 10,
            paddingVertical: 9,
            paddingHorizontal: 18,
            alignItems: "center",
          }}
        >
          <Text style={{ color: page === TOTAL - 1 ? "#ccc" : Colors.green, fontWeight: "600", fontSize: 13 }}>
            다음 →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
