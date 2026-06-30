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

const SLIDES = ["hook", "step1", "step2", "step3", "step4", "logo"];

function StepChip({ icon, title, desc, bg }: { icon: string; title: string; desc: string; bg: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f7f7f7", borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 17 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#111" }}>{title}</Text>
        <Text style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{desc}</Text>
      </View>
    </View>
  );
}

function SlideHook() {
  return (
    <View style={{ flex: 1, backgroundColor: "#1a3628", justifyContent: "center", paddingHorizontal: 36 }}>
      <View style={{ backgroundColor: "#2d5940", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", marginBottom: 20 }}>
        <Text style={{ color: "#7fd4a8", fontSize: 12, fontWeight: "600" }}>PT 트레이너 필독</Text>
      </View>
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800", lineHeight: 42, marginBottom: 16 }}>
        {"PT 관리를\n아직도\n엑셀로\n하세요?"}
      </Text>
      <Text style={{ color: "#9dcfb8", fontSize: 15, lineHeight: 24 }}>
        {"회원 수업 횟수, 매출, 일정까지\nFitLog 하나로 다 됩니다."}
      </Text>
      <View style={{ position: "absolute", bottom: 40, right: 36, alignItems: "flex-end" }}>
        <Text style={{ color: "#5db88a", fontSize: 18, fontWeight: "700" }}>FitLog</Text>
        <Text style={{ color: "#3d7a5e", fontSize: 11, marginTop: 2 }}>기록이 곧 성장이다</Text>
      </View>
    </View>
  );
}

function Slide1() {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", paddingHorizontal: 32 }}>
      <View style={{ backgroundColor: "#e8f5ee", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Text style={{ color: "#2e7d52", fontSize: 18, fontWeight: "700" }}>01</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#111", lineHeight: 36, marginBottom: 10 }}>{"목표 수업수 &\n매출 설정"}</Text>
      <Text style={{ fontSize: 14, color: "#666", lineHeight: 22, marginBottom: 24 }}>{"홈 화면 ‘목표 수정’ 버튼으로\n이번 달 목표를 바로 입력해요."}</Text>
      <StepChip icon="🏠" title="홈 → 목표 수정" desc="수업 횟수 & 매출 금액 입력" bg="#e8f5ee" />
      <StepChip icon="📊" title="실시간 달성률 확인" desc="완료 시 자동 업데이트" bg="#e8f5ee" />
    </View>
  );
}

function Slide2() {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", paddingHorizontal: 32 }}>
      <View style={{ backgroundColor: "#e6f0fb", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Text style={{ color: "#1a5fa8", fontSize: 18, fontWeight: "700" }}>02</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#111", lineHeight: 36, marginBottom: 10 }}>회원 추가</Text>
      <Text style={{ fontSize: 14, color: "#666", lineHeight: 22, marginBottom: 24 }}>{"앱 설치 여부와 상관없이\n모든 회원을 관리할 수 있어요."}</Text>
      <StepChip icon="👥" title="기존 회원 추가" desc="회원 탭 → 기존 회원 추가 버튼" bg="#e6f0fb" />
      <StepChip icon="📲" title="앱 없어도 OK" desc="미연동 회원도 등록해서 관리 가능" bg="#e6f0fb" />
      <StepChip icon="💬" title="카카오톡으로 공유" desc="운동일지를 카카오톡으로 바로 전송" bg="#FEE500" />
    </View>
  );
}

function Slide3() {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", paddingHorizontal: 32 }}>
      <View style={{ backgroundColor: "#fff8e1", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Text style={{ color: "#b45309", fontSize: 18, fontWeight: "700" }}>03</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#111", lineHeight: 36, marginBottom: 10 }}>PT 일정 등록</Text>
      <Text style={{ fontSize: 14, color: "#666", lineHeight: 22, marginBottom: 24 }}>{"일정 탭에서 회원별 수업 시간을\n등록하면 홈에서 바로 확인돼요."}</Text>
      <StepChip icon="📅" title="일정 탭 → 수업 등록" desc="회원 선택 후 날짜/시간 입력" bg="#fff8e1" />
      <StepChip icon="🗓" title="월간 / 주간 뷰 지원" desc="전체 일정 한눈에 파악 가능" bg="#fff8e1" />
    </View>
  );
}

function Slide4() {
  return (
    <View style={{ flex: 1, backgroundColor: "#1a3628", justifyContent: "center", paddingHorizontal: 32 }}>
      <View style={{ backgroundColor: "#2d5940", borderRadius: 12, width: 44, height: 44, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Text style={{ color: "#7fd4a8", fontSize: 18, fontWeight: "700" }}>04</Text>
      </View>
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#fff", lineHeight: 36, marginBottom: 10 }}>{"운동일지 &\n피드백 작성"}</Text>
      <Text style={{ fontSize: 14, color: "#9dcfb8", lineHeight: 22, marginBottom: 24 }}>{"수업 완료 후 기록을 남기면\n회원에게 자동으로 공유돼요."}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, marginBottom: 8 }}>
        <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "#2d5940", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 17 }}>✍️</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>홈 → 확정 → 운동일지 작성</Text>
          <Text style={{ fontSize: 12, color: "#9dcfb8", marginTop: 2 }}>세트 / 무게 / 횟수 + 트레이너 피드백</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 9, backgroundColor: "#2d5940", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 17 }}>📲</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>회원 앱에 자동 공유</Text>
          <Text style={{ fontSize: 12, color: "#9dcfb8", marginTop: 2 }}>연동 회원 실시간 확인 가능</Text>
        </View>
      </View>
    </View>
  );
}

function SlideLogo({ onStart }: { onStart: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <Image
        source={require("../../assets/images/onboarding5.png")}
        style={{ flex: 1, width }}
        resizeMode="contain"
      />
      <View style={{ paddingHorizontal: 24, paddingBottom: 48, paddingTop: 16 }}>
        <Pressable
          onPress={onStart}
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#256e47" : Colors.green,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>시작하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const STEP_COMPONENTS = [SlideHook, Slide1, Slide2, Slide3, Slide4];

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

  const isLogoSlide = currentIndex === SLIDES.length - 1;
  const isDarkSlide = currentIndex === 0 || currentIndex === 4;

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
        renderItem={({ index }) => {
          const isLogo = index === SLIDES.length - 1;
          return (
            <View style={{ width, height: isLogo ? height : height - 100 }}>
              {isLogo ? (
                <SlideLogo onStart={handleStart} />
              ) : index === 0 ? <SlideHook />
                : index === 1 ? <Slide1 />
                : index === 2 ? <Slide2 />
                : index === 3 ? <Slide3 />
                : <Slide4 />
              }
            </View>
          );
        }}
      />

      {!isLogoSlide && (
        <View
          style={{
            height: 100,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingBottom: 16,
            gap: 8,
            backgroundColor: isDarkSlide ? "#1a3628" : "#fff",
          }}
        >
          <View style={{ flexDirection: "row", gap: 5, marginRight: 8 }}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === currentIndex ? 16 : 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: i === currentIndex
                    ? "#3cb877"
                    : (isDarkSlide ? "#2d5940" : "#D1D5DB"),
                }}
              />
            ))}
          </View>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={handleStart}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 18,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: isDarkSlide ? "#2d5940" : "#D1D5DB",
            }}
          >
            <Text style={{ color: isDarkSlide ? "#9dcfb8" : Colors.textMuted, fontWeight: "600", fontSize: 13 }}>
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
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>다음</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
