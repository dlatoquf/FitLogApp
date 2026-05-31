import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, CLOUDINARY_UPLOAD_URL, CLOUDINARY_UPLOAD_PRESET } from "../../../constants/api";

// ─── 타입 ─────────────────────────────────────────────────────────────────────
interface DayFeedback {
  id: number;
  trainerName: string;
  content: string;
  createdAt: string;
}
interface DietPhoto {
  id: number;
  date: string;
  photoUrl: string;
  cloudinaryPublicId?: string;
  label?: string;
  createdAt: string;
}

// ─── 날짜 유틸 (로컬 타임존 기준) ────────────────────────────────────────────
const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const getWeekDates = (offset: number): Date[] => {
  const today = new Date();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
};

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function MemberDietScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [photos, setPhotos] = useState<DietPhoto[]>([]);
  const [dayFeedback, setDayFeedback] = useState<DayFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [photoAspectRatios, setPhotoAspectRatios] = useState<{ [id: number]: number }>({});

  const [addModal, setAddModal] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [pickedImageUris, setPickedImageUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const dateKey = toDateKey(selectedDate);
  const todayKey = toDateKey(new Date());
  const weekDates = getWeekDates(weekOffset);

  // ── 데이터 조회 ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/diet/photos?date=${dateKey}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos ?? []);
        setDayFeedback(data.feedback ?? null);
      } else {
        setPhotos([]); setDayFeedback(null);
      }
    } catch {
      setPhotos([]); setDayFeedback(null);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [dateKey]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  // ── 사진 비율 자동 계산 ─────────────────────────────────────────────────────
  useEffect(() => {
    photos.forEach((photo) => {
      if (photoAspectRatios[photo.id] !== undefined) return;
      Image.getSize(
        photo.photoUrl,
        (w, h) => {
          if (h > 0) {
            setPhotoAspectRatios((prev) => ({ ...prev, [photo.id]: w / h }));
          }
        },
        () => {
          setPhotoAspectRatios((prev) => ({ ...prev, [photo.id]: 4 / 3 }));
        },
      );
    });
  }, [photos]);

  // ── 이미지 선택 ──────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("권한 필요", "사진 접근 권한이 필요해요."); return; }
    Alert.alert("사진 선택", "어떻게 추가할까요?", [
      {
        text: "카메라로 촬영",
        onPress: async () => {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (cam.status !== "granted") return;
          const r = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
          if (!r.canceled) setPickedImageUris((prev) => [...prev, r.assets[0].uri]);
        },
      },
      {
        text: "갤러리에서 선택",
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsMultipleSelection: true,
          });
          if (!r.canceled) setPickedImageUris(r.assets.map((a) => a.uri));
        },
      },
      { text: "취소", style: "cancel" },
    ]);
  };

  // ── Cloudinary 업로드 ────────────────────────────────────────────────────────
  const uploadToCloudinary = async (uri: string) => {
    // 업로드 전 압축 (최대 1200px, 품질 75%)
    let uploadUri = uri;
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
      );
      uploadUri = result.uri;
    } catch { /* 압축 실패 시 원본 사용 */ }

    const fd = new FormData();
    fd.append("file", { uri: uploadUri, type: "image/jpeg", name: "diet.jpg" } as any);
    fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: fd });
    if (!res.ok) throw new Error("이미지 업로드 실패");
    const d = await res.json();
    return { url: d.secure_url as string, publicId: d.public_id as string };
  };

  // ── 사진 추가 (여러 장) ──────────────────────────────────────────────────────
  const addPhoto = async () => {
    if (pickedImageUris.length === 0) { Alert.alert("사진을 먼저 선택해주세요."); return; }
    setUploading(true);
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      for (const uri of pickedImageUris) {
        const { url, publicId } = await uploadToCloudinary(uri);
        const res = await fetch(`${API_URL}/api/diet/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({
            date: dateKey,
            photoUrl: url,
            cloudinaryPublicId: publicId,
            label: labelInput.trim() || null,
          }),
        });
        if (!res.ok) throw new Error("저장 실패");
      }
      setAddModal(false);
      setPickedImageUris([]);
      setLabelInput("");
      fetchData();
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setUploading(false);
    }
  };

  // ── 사진 삭제 ────────────────────────────────────────────────────────────────
  const deletePhoto = (id: number) => {
    Alert.alert("삭제", "이 사진을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive",
        onPress: async () => {
          const jwt = await AsyncStorage.getItem("jwt");
          await fetch(`${API_URL}/api/diet/photos/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${jwt}` },
          });
          fetchData();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={Colors.green} />}
      >
        {/* 헤더 */}
        <Text style={{ fontSize: 24, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>식단로그</Text>
        <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 14 }}>트레이너가 피드백을 남겨드려요</Text>

        {/* ── 주간 캘린더 ──────────────────────────────────────────────────── */}
        <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 12, marginBottom: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <TouchableOpacity onPress={() => setWeekOffset((w) => w - 1)} style={{ padding: 6 }}>
              <Text style={{ fontSize: 18, color: Colors.textSub }}>‹</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 12, fontWeight: "600", color: Colors.textMuted }}>
              {weekDates[0].getMonth() + 1}/{weekDates[0].getDate()} – {weekDates[6].getMonth() + 1}/{weekDates[6].getDate()}
            </Text>
            <TouchableOpacity
              onPress={() => setWeekOffset((w) => w + 1)}
              disabled={weekOffset >= 0}
              style={{ padding: 6, opacity: weekOffset >= 0 ? 0.3 : 1 }}
            >
              <Text style={{ fontSize: 18, color: Colors.textSub }}>›</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {weekDates.map((d, i) => {
              const key = toDateKey(d);
              const isSelected = key === dateKey;
              const isToday = key === todayKey;
              const isFuture = key > todayKey;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => { if (!isFuture) setSelectedDate(d); }}
                  disabled={isFuture}
                  style={{ alignItems: "center", gap: 4, flex: 1, opacity: isFuture ? 0.3 : 1 }}
                >
                  <Text style={{ fontSize: 10, color: Colors.textMuted, fontWeight: "600" }}>{WEEK_DAYS[i]}</Text>
                  <View style={{
                    width: 30, height: 30, borderRadius: 8,
                    backgroundColor: isSelected ? Colors.green : isToday ? Colors.greenLight : "transparent",
                    justifyContent: "center", alignItems: "center",
                    borderWidth: isToday && !isSelected ? 1 : 0, borderColor: Colors.green,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: isSelected ? "#fff" : isToday ? Colors.green : Colors.text }}>
                      {d.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 식단 추가 버튼 ───────────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => { setPickedImageUris([]); setLabelInput(""); setAddModal(true); }}
          style={{
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
            backgroundColor: Colors.greenLight, borderRadius: 10,
            borderWidth: 1, borderColor: Colors.green + "55", borderStyle: "dashed",
            paddingVertical: 8, marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 15, color: Colors.green, fontWeight: "800" }}>+</Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: Colors.green }}>식단 사진 추가</Text>
        </TouchableOpacity>

        {/* ── 사진 목록 (2열 그리드) ───────────────────────────────────────── */}
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <ActivityIndicator color={Colors.green} />
          </View>
        ) : photos.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>🍽️</Text>
            <Text style={{ fontSize: 14, color: Colors.textMuted }}>이 날 식단 사진이 없어요</Text>
          </View>
        ) : (
          <>
            <View style={{ gap: 10, marginBottom: 10 }}>
              {photos.map((photo) => {
                const ratio = photoAspectRatios[photo.id] ?? 4 / 3;
                return (
                  <View
                    key={photo.id}
                    style={{
                      width: "100%",
                      backgroundColor: Colors.bgSub,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      overflow: "hidden",
                    }}
                  >
                    <View style={{ position: "relative", aspectRatio: ratio }}>
                      <Image
                        source={{ uri: photo.photoUrl }}
                        style={{ width: "100%", height: "100%" }}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        onPress={() => deletePhoto(photo.id)}
                        style={{
                          position: "absolute", top: 8, right: 8,
                          backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 14,
                          width: 26, height: 26, justifyContent: "center", alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 11 }}>✕</Text>
                      </TouchableOpacity>
                      {photo.label ? (
                        <View style={{
                          position: "absolute", bottom: 8, left: 8,
                          backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6,
                          paddingHorizontal: 8, paddingVertical: 3,
                        }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{photo.label}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* ── 하루 피드백 (사진 목록 아래 1회만) ─────────────────────── */}
            <View style={{
              backgroundColor: Colors.greenLight, borderRadius: 10,
              borderWidth: 1, borderColor: Colors.green + "33",
              padding: 10, marginBottom: 4,
            }}>
              {dayFeedback ? (
                <>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: Colors.green, marginBottom: 3 }}>
                    {dayFeedback.trainerName} 트레이너
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 18 }}>{dayFeedback.content}</Text>
                  <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 3 }}>{dayFeedback.createdAt.slice(0, 10)}</Text>
                </>
              ) : (
                <Text style={{ fontSize: 12, color: Colors.textMuted, textAlign: "center" }}>트레이너의 피드백을 기다리는 중...</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── 식단 추가 모달 ────────────────────────────────────────────────────── */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setAddModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <TouchableOpacity activeOpacity={1}>
              <View style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 22, borderTopRightRadius: 22,
                padding: 22, paddingBottom: Platform.OS === "ios" ? 40 : 22,
              }}>
                <View style={{ width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 14 }} />
                <Text style={{ fontSize: 16, fontWeight: "800", color: Colors.text, marginBottom: 2 }}>식단 사진 추가</Text>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 14 }}>
                  갤러리에서 여러 장을 한 번에 선택할 수 있어요
                </Text>

                {/* 사진 선택 영역 */}
                <TouchableOpacity
                  onPress={pickImage}
                  style={{
                    height: 130,
                    backgroundColor: Colors.bgSub,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: pickedImageUris.length > 0 ? Colors.green + "88" : Colors.border,
                    borderStyle: pickedImageUris.length > 0 ? "solid" : "dashed",
                    justifyContent: "center", alignItems: "center",
                    marginBottom: 12, overflow: "hidden",
                  }}
                >
                  {pickedImageUris.length === 0 ? (
                    <View style={{ alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 26 }}>📷</Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>사진 선택 (여러 장 가능)</Text>
                    </View>
                  ) : pickedImageUris.length === 1 ? (
                    <Image source={{ uri: pickedImageUris[0] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: "100%", height: "100%" }}>
                      <Image source={{ uri: pickedImageUris[0] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      <View style={{
                        position: "absolute", bottom: 8, right: 8,
                        backgroundColor: Colors.green, borderRadius: 12,
                        paddingHorizontal: 10, paddingVertical: 4,
                      }}>
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>{pickedImageUris.length}장 선택됨</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 선택된 사진이 있을 때 다시 선택 링크 */}
                {pickedImageUris.length > 0 && (
                  <TouchableOpacity onPress={pickImage} style={{ alignItems: "center", marginBottom: 10, marginTop: -4 }}>
                    <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "600" }}>다시 선택하기</Text>
                  </TouchableOpacity>
                )}

                {/* 라벨 */}
                <TextInput
                  value={labelInput}
                  onChangeText={setLabelInput}
                  placeholder="메모 (예: 아침 식사, 점심 도시락...)"
                  placeholderTextColor={Colors.textMuted}
                  style={{
                    backgroundColor: Colors.bgSub, borderRadius: 10,
                    borderWidth: 1, borderColor: Colors.border,
                    paddingHorizontal: 12, paddingVertical: 10,
                    fontSize: 13, color: Colors.text, marginBottom: 14,
                  }}
                />

                <TouchableOpacity
                  onPress={addPhoto}
                  disabled={uploading || pickedImageUris.length === 0}
                  style={{
                    backgroundColor: Colors.green, borderRadius: 10,
                    paddingVertical: 13, alignItems: "center",
                    opacity: (uploading || pickedImageUris.length === 0) ? 0.5 : 1,
                  }}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "800" }}>
                      {pickedImageUris.length > 1 ? `${pickedImageUris.length}장 추가하기` : "추가하기"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
