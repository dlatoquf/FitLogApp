import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Platform,
  Share,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  createAnimatedComponent,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedImage = createAnimatedComponent(Image);
import { captureRef } from "react-native-view-shot";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { Colors } from "../constants/Colors";

export interface OuwanCardProps {
  visible: boolean;
  onClose: () => void;
  date: string;
  exercises: string[];
  sessionType: "PT" | "개인운동";
}

type Ratio = "3:4" | "9:16";

const CARD_W = 360;
const RATIO_H: Record<Ratio, number> = { "3:4": 480, "9:16": 640 };

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}  ${days[d.getDay()]}`;
}

function CardView({
  photo, ratio, date, exercises, textColor, translateX, translateY, scale,
}: {
  photo: string | null;
  ratio: Ratio;
  date: string;
  exercises: string[];
  textColor: "white" | "black";
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const cardH = RATIO_H[ratio];
  const MAX = ratio === "3:4" ? 6 : 8;
  const shown = exercises.slice(0, MAX);
  const extra = exercises.length - shown.length;
  const tc = textColor === "white" ? "#fff" : "#111";
  const divColor = textColor === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
  const fs = ratio === "9:16" ? 1.1 : 1;

  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={{ width: CARD_W, height: cardH, backgroundColor: Colors.bgSub, overflow: "hidden" }}>
      {photo && (
        <AnimatedImage
          source={{ uri: photo }}
          style={[{ position: "absolute", width: CARD_W, height: cardH }, photoStyle]}
          resizeMode="cover"
        />
      )}
      <Text style={{ position: "absolute", top: 22, left: 20, fontSize: 14 * fs, fontWeight: "700", letterSpacing: 1.2, color: tc }}>
        {formatDate(date)}
      </Text>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 22 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: Colors.green, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16 }}>
          <Text style={{ fontSize: 11 * fs, fontWeight: "800", color: "#000" }}>오늘의 운동</Text>
        </View>
        <View style={{ marginBottom: 16 }}>
          {shown.map((name, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }}>
              <View style={{ width: 6 * fs, height: 6 * fs, borderRadius: 3 * fs, backgroundColor: Colors.green }} />
              <Text style={{ fontSize: 16 * fs, fontWeight: "700", color: tc }}>{name}</Text>
            </View>
          ))}
          {extra > 0 && (
            <Text style={{ fontSize: 12 * fs, color: Colors.green, fontWeight: "600", marginTop: 4, marginLeft: 14 }}>+{extra}개 더</Text>
          )}
        </View>
        <View style={{ height: 1, backgroundColor: divColor, marginBottom: 14 }} />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 22 * fs, fontFamily: "Montserrat_900Black", color: Colors.green, letterSpacing: -0.5 }}>
            FitLog
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function OuwanCard({ visible, onClose, date, exercises, sessionType }: OuwanCardProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [ratio, setRatio] = useState<Ratio>("3:4");
  const [textColor, setTextColor] = useState<"white" | "black">("black");
  const [saving, setSaving] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const shotRef = useRef<View>(null);

  const screenW = Dimensions.get("window").width;
  const previewW = screenW - 48;
  const previewScale = previewW / CARD_W;
  const cardH = RATIO_H[ratio];
  const previewH = cardH * previewScale;

  // Reanimated shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // 제스처 시작 시 스냅샷
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setTextColor("black");
      setPhoto(null);
      setHasPhoto(false);
      setRatio("3:4");
      resetTransform(false);
    }
  }, [visible]);

  const resetTransform = (animated = true) => {
    if (animated) {
      translateX.value = withSpring(0, { damping: 18, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      scale.value = withSpring(1, { damping: 18, stiffness: 200 });
    } else {
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
    }
    savedX.value = 0;
    savedY.value = 0;
    savedScale.value = 1;
  };

  // 핀치 제스처 (UI 스레드 실행)
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      const newScale = Math.max(0.5, Math.min(4, savedScale.value * e.scale));
      const scaleRatio = newScale / savedScale.value;
      // 핀치 중심점 기준으로 translate 보정 (카드 좌표계)
      const focalX = e.focalX / previewScale;
      const focalY = e.focalY / previewScale;
      translateX.value = focalX - (focalX - savedX.value) * scaleRatio;
      translateY.value = focalY - (focalY - savedY.value) * scaleRatio;
      scale.value = newScale;
    });

  // 팬 제스처 (UI 스레드 실행)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX / previewScale;
      translateY.value = savedY.value + e.translationY / previewScale;
    })
    .onEnd((e) => {
      // 손 뗄 때 관성 - decayFactor로 미끄러짐
      const DECAY = 0.85;
      const vx = (e.velocityX / previewScale) * DECAY;
      const vy = (e.velocityY / previewScale) * DECAY;
      translateX.value = withSpring(translateX.value + vx * 0.12, {
        damping: 20,
        stiffness: 120,
        velocity: e.velocityX / previewScale,
      });
      translateY.value = withSpring(translateY.value + vy * 0.12, {
        damping: 20,
        stiffness: 120,
        velocity: e.velocityY / previewScale,
      });
    });

  // 핀치 + 팬 동시 인식
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setHasPhoto(true);
      resetTransform(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("권한 필요", "카메라 접근 권한이 필요해요."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
      setHasPhoto(true);
      resetTransform(false);
    }
  };

  const handleRatioChange = (r: Ratio) => {
    setRatio(r);
    resetTransform(true);
  };

  const capture = async (): Promise<string | null> => {
    if (!shotRef.current) await new Promise((r) => setTimeout(r, 200));
    if (!shotRef.current) { Alert.alert("오류", "캡처 준비가 안 됐어요."); return null; }
    try {
      return await captureRef(shotRef, { format: "jpg", quality: 0.95 });
    } catch (e: any) {
      Alert.alert("캡처 실패", e?.message ?? String(e));
      return null;
    }
  };

  const saveToGallery = async () => {
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("권한 필요", "사진 저장 권한이 필요해요."); return; }
      const uri = await capture();
      if (!uri) return;
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("저장 완료", "카메라롤에 저장됐어요!");
    } catch { Alert.alert("오류", "저장에 실패했어요."); }
    finally { setSaving(false); }
  };

  const shareImage = async () => {
    setSaving(true);
    try {
      const uri = await capture();
      if (!uri) return;
      const fileUri = Platform.OS === "android" ? `file://${uri}` : uri;
      await Share.share({ url: fileUri });
    } catch { Alert.alert("오류", "공유에 실패했어요."); }
    finally { setSaving(false); }
  };

  const reset = () => {
    setPhoto(null); setHasPhoto(false); setRatio("3:4"); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={reset}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: 52 }}>
          {/* 헤더 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#111" }}>오운완 인증샷</Text>
            <TouchableOpacity onPress={reset}>
              <Text style={{ fontSize: 18, color: "#999" }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 비율 + 글자색 */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["3:4", "9:16"] as Ratio[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => handleRatioChange(r)}
                  style={{
                    paddingHorizontal: 18, paddingVertical: 7, borderRadius: 20,
                    borderWidth: 1.5,
                    borderColor: ratio === r ? Colors.green : "#ddd",
                    backgroundColor: ratio === r ? Colors.green : "#fff",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: ratio === r ? "#000" : "#888" }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <TouchableOpacity
                onPress={() => setTextColor("white")}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: textColor === "white" ? Colors.green : "#ddd" }}
              />
              <TouchableOpacity
                onPress={() => setTextColor("black")}
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#111", borderWidth: 2, borderColor: textColor === "black" ? Colors.green : "transparent" }}
              />
            </View>
          </View>

          {/* 카드 미리보기 */}
          <GestureDetector gesture={composedGesture}>
            <View
              style={{
                alignSelf: "center",
                width: previewW,
                height: previewH,
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              <View style={{ width: CARD_W, height: cardH, transform: [{ scale: previewScale }], transformOrigin: "top left" } as any}>
                <View ref={shotRef} collapsable={false}>
                  <CardView
                    photo={photo}
                    ratio={ratio}
                    date={date}
                    exercises={exercises}
                    textColor={textColor}
                    translateX={translateX}
                    translateY={translateY}
                    scale={scale}
                  />
                </View>
              </View>
            </View>
          </GestureDetector>

          {/* 힌트 / 초기화 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, marginBottom: 4, minHeight: 28 }}>
            {hasPhoto && (
              <>
                <Text style={{ fontSize: 11, color: Colors.textMuted }}>드래그·핀치로 위치/크기 조정</Text>
                <TouchableOpacity
                  onPress={() => resetTransform(true)}
                  style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border }}
                >
                  <Text style={{ fontSize: 11, color: Colors.textMuted, fontWeight: "600" }}>초기화</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* 하단 버튼 */}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 32, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={takePhoto}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e8e8e8", alignItems: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#333" }}>카메라</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickPhoto}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e8e8e8", alignItems: "center" }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#333" }}>앨범</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={saveToGallery}
                disabled={saving}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e8e8e8", alignItems: "center" }}
              >
                {saving ? <ActivityIndicator color="#333" /> : <Text style={{ fontSize: 14, fontWeight: "700", color: "#333" }}>저장</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={shareImage}
                disabled={saving}
                style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.green, alignItems: "center" }}
              >
                {saving ? <ActivityIndicator color="#000" /> : <Text style={{ fontSize: 14, fontWeight: "800", color: "#000" }}>공유하기</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
