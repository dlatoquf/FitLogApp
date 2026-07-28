import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
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
  photo, ratio, date, exercises, textColor,
}: {
  photo: string | null;
  ratio: Ratio;
  date: string;
  exercises: string[];
  textColor: "white" | "black";
}) {
  const cardH = RATIO_H[ratio];
  const MAX = ratio === "3:4" ? 6 : 8;
  const shown = exercises.slice(0, MAX);
  const extra = exercises.length - shown.length;
  const tc = textColor === "white" ? "#fff" : "#111";
  const tcSub = textColor === "white" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const divColor = textColor === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
  const fs = ratio === "9:16" ? 1.1 : 1;

  return (
    <View style={{ width: CARD_W, height: cardH, backgroundColor: Colors.bgSub, overflow: "hidden" }}>
      {photo && (
        <Image source={{ uri: photo }} style={{ position: "absolute", width: CARD_W, height: cardH }} resizeMode="cover" />
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22 * fs, fontWeight: "900", color: Colors.green, letterSpacing: -0.5 }}>
            FitLog{"  "}
            <Text style={{ fontSize: 14 * fs, fontWeight: "500", color: tcSub, letterSpacing: 1 }}>오운완</Text>
          </Text>
          <Text style={{ fontSize: 14 * fs, color: tcSub, letterSpacing: 0.5 }}>#오운완 #핏로그</Text>
        </View>
      </View>
    </View>
  );
}

export default function OuwanCard({ visible, onClose, date, exercises, sessionType }: OuwanCardProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [ratio, setRatio] = useState<Ratio>("3:4");
  const [textColor, setTextColor] = useState<"white" | "black">("black");
  const [saving, setSaving] = useState(false);
  const shotRef = useRef<View>(null);

  useEffect(() => {
    if (visible) {
      setTextColor("black");
      setPhoto(null);
      setOriginalUri(null);
      setRatio("3:4");
    }
  }, [visible]);

  const screenW = Dimensions.get("window").width;
  const previewW = screenW - 48;
  const cardH = RATIO_H[ratio];
  const scale = previewW / CARD_W;
  const previewH = cardH * scale;

  const cropPhoto = async (uri: string, r: Ratio) => {
    try {
      const h = RATIO_H[r];
      const img = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
      const targetRatio = CARD_W / h;
      let cropW = img.width;
      let cropH = Math.round(img.width / targetRatio);
      if (cropH > img.height) { cropH = img.height; cropW = Math.round(img.height * targetRatio); }
      const ox = Math.round((img.width - cropW) / 2);
      const oy = Math.round((img.height - cropH) / 2);
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: { originX: ox, originY: oy, width: cropW, height: cropH } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.92 },
      );
      setPhoto(result.uri);
    } catch {
      setPhoto(uri);
    }
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setOriginalUri(result.assets[0].uri);
      await cropPhoto(result.assets[0].uri, ratio);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("권한 필요", "카메라 접근 권한이 필요해요."); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 1 });
    if (!result.canceled && result.assets[0]) {
      setOriginalUri(result.assets[0].uri);
      await cropPhoto(result.assets[0].uri, ratio);
    }
  };

  const handleRatioChange = async (r: Ratio) => {
    setRatio(r);
    if (originalUri) await cropPhoto(originalUri, r);
  };

  const capture = async (): Promise<string | null> => {
    if (!shotRef.current) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!shotRef.current) {
      Alert.alert("오류", "캡처 준비가 안 됐어요. 잠시 후 다시 시도해 주세요.");
      return null;
    }
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
    } catch {
      Alert.alert("오류", "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const shareImage = async () => {
    setSaving(true);
    try {
      const uri = await capture();
      if (!uri) return;
      const fileUri = Platform.OS === "android" ? `file://${uri}` : uri;
      await Share.share({ url: fileUri });
    } catch {
      Alert.alert("오류", "공유에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setPhoto(null); setOriginalUri(null); setRatio("3:4"); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={reset}>
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: 24, paddingHorizontal: 24, paddingTop: 32 }}>
          {/* 헤더 */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#111" }}>오운완 인증샷</Text>
            <TouchableOpacity onPress={reset}>
              <Text style={{ fontSize: 18, color: "#999" }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 비율 + 글자색 탭 */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 20 }}>
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

          {/* 카드 미리보기 + 캡처 ref */}
          <View style={{ width: previewW, height: previewH, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            <View style={{ width: CARD_W, height: cardH, transform: [{ scale }], transformOrigin: "top left" } as any}>
              <View ref={shotRef} collapsable={false}>
                <CardView photo={photo} ratio={ratio} date={date} exercises={exercises} textColor={textColor} />
              </View>
            </View>
          </View>

          {/* 사진 선택 */}
          <View style={{ flexDirection: "row", gap: 10, width: "100%", marginBottom: 10 }}>
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

          {/* 저장 / 공유 */}
          <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
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
    </Modal>
  );
}
