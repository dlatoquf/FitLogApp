import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Colors } from "../constants/Colors";

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────
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
const GREEN = "#2E8B57";
const BG_SUB = "#F4F6FA";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}  ${days[d.getDay()]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 카드 미리보기 (React Native View)
// ─────────────────────────────────────────────────────────────────────────────
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
  const MAX = ratio === "3:4" ? 5 : 7;
  const shown = exercises.slice(0, MAX);
  const extra = exercises.length - shown.length;
  const tc = textColor === "white" ? "#fff" : "#111";
  const tcSub = textColor === "white" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const divColor = textColor === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
  const fs = ratio === "9:16" ? 1.1 : 1;

  return (
    <View style={{ width: CARD_W, height: cardH, backgroundColor: BG_SUB, overflow: "hidden" }}>
      {photo && (
        <Image source={{ uri: photo }} style={{ position: "absolute", width: CARD_W, height: cardH }} resizeMode="cover" />
      )}
      <Text style={{ position: "absolute", top: 22, left: 20, fontSize: 14 * fs, fontWeight: "700", letterSpacing: 1.2, color: tc }}>
        {formatDate(date)}
      </Text>
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 22 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16 }}>
          <Text style={{ fontSize: 11 * fs, fontWeight: "800", color: "#000" }}>오늘의 운동</Text>
        </View>
        <View style={{ marginBottom: 16 }}>
          {shown.map((name, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }}>
              <View style={{ width: 6 * fs, height: 6 * fs, borderRadius: 3 * fs, backgroundColor: GREEN }} />
              <Text style={{ fontSize: 16 * fs, fontWeight: "700", color: tc }}>{name}</Text>
            </View>
          ))}
          {extra > 0 && (
            <Text style={{ fontSize: 12 * fs, color: GREEN, fontWeight: "600", marginTop: 4, marginLeft: 14 }}>+{extra}개 더</Text>
          )}
        </View>
        <View style={{ height: 1, backgroundColor: divColor, marginBottom: 14 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22 * fs, fontWeight: "900", color: GREEN, letterSpacing: -0.5 }}>
            FitLog{"  "}
            <Text style={{ fontSize: 14 * fs, fontWeight: "500", color: tcSub, letterSpacing: 1 }}>오운완</Text>
          </Text>
          <Text style={{ fontSize: 14 * fs, color: tcSub, letterSpacing: 0.5 }}>#오운완 #핏로그</Text>
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 캔버스 HTML 생성 (WebView용)
// ─────────────────────────────────────────────────────────────────────────────
function buildCanvasHtml(
  photoBase64: string | null,
  ratio: Ratio,
  dateStr: string,
  exercises: string[],
  textColor: "white" | "black",
): string {
  const W = CARD_W;
  const H = RATIO_H[ratio];
  const fs = ratio === "9:16" ? 1.1 : 1;
  const MAX = ratio === "3:4" ? 5 : 7;
  const shown = exercises.slice(0, MAX);
  const extra = exercises.length - shown.length;
  const tc = textColor === "white" ? "#fff" : "#111";
  const tcSub = textColor === "white" ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const divColor = textColor === "white" ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.15)";
  const dateText = formatDate(dateStr);
  const exercisesJson = JSON.stringify(shown);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>body{margin:0;padding:0;background:#000}</style></head>
<body>
<canvas id="c" width="${W}" height="${H}"></canvas>
<script>
(function(){
  const W=${W}, H=${H}, fs=${fs};
  const GREEN="${GREEN}", BG="${BG_SUB}";
  const tc="${tc}", tcSub="${tcSub}", divColor="${divColor}";
  const shown=${exercisesJson};
  const extra=${extra};
  const dateText=${JSON.stringify(dateText)};

  const canvas=document.getElementById('c');
  const ctx=canvas.getContext('2d');

  function roundRect(cx,x,y,w,h,r){
    if(cx.roundRect){cx.roundRect(x,y,w,h,r);return;}
    cx.beginPath();
    cx.moveTo(x+r,y);
    cx.lineTo(x+w-r,y);
    cx.quadraticCurveTo(x+w,y,x+w,y+r);
    cx.lineTo(x+w,y+h-r);
    cx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    cx.lineTo(x+r,y+h);
    cx.quadraticCurveTo(x,y+h,x,y+h-r);
    cx.lineTo(x,y+r);
    cx.quadraticCurveTo(x,y,x+r,y);
    cx.closePath();
  }

  function draw(img){
    try{
    // 배경
    ctx.fillStyle=BG;
    ctx.fillRect(0,0,W,H);
    if(img){
      const iw=img.naturalWidth, ih=img.naturalHeight;
      const sc=Math.max(W/iw, H/ih);
      const dw=iw*sc, dh=ih*sc;
      ctx.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
    }

    // 날짜
    ctx.fillStyle=tc;
    ctx.font='bold '+(14*fs)+'px -apple-system,sans-serif';
    ctx.fillText(dateText,20,22+14*fs);

    // 하단 콘텐츠 영역
    const PAD=22;
    const badgeH=22*fs, badgeMB=16;
    const exercisesH=shown.length*(10*fs+16)+(extra>0?12*fs+14:0);
    const divH=1, divMB=14;
    const logoH=22*fs;
    const totalH=badgeH+badgeMB+exercisesH+16+divH+divMB+logoH+PAD*2;
    let y=H-totalH+PAD;

    // 배지
    const badgeText='오늘의 운동';
    ctx.font='bold '+(11*fs)+'px -apple-system,sans-serif';
    const badgeW=ctx.measureText(badgeText).width+24;
    const bx=PAD, by=y;
    ctx.fillStyle=GREEN;
    roundRect(ctx,bx,by,badgeW,badgeH,11*fs);
    ctx.fill();
    ctx.fillStyle='#000';
    ctx.fillText(badgeText,bx+12,by+badgeH-5*fs);
    y+=badgeH+badgeMB;

    // 종목 목록
    ctx.font='bold '+(16*fs)+'px -apple-system,sans-serif';
    shown.forEach(function(name){
      const dotR=3*fs, dotX=PAD+dotR, dotY=y+8*fs;
      ctx.fillStyle=GREEN;
      ctx.beginPath();
      ctx.arc(dotX,dotY,dotR,0,Math.PI*2);
      ctx.fill();
      ctx.fillStyle=tc;
      ctx.fillText(name,PAD+dotR*2+8,y+16*fs);
      y+=10*fs+16;
    });
    if(extra>0){
      ctx.font='bold '+(12*fs)+'px -apple-system,sans-serif';
      ctx.fillStyle=GREEN;
      ctx.fillText('+'+extra+'개 더',PAD+14,y+12*fs);
      y+=12*fs+14;
    }
    y+=16;

    // 구분선
    ctx.strokeStyle=divColor;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(PAD,y);
    ctx.lineTo(W-PAD,y);
    ctx.stroke();
    y+=divH+divMB;

    // 로고
    ctx.font='bold '+(22*fs)+'px -apple-system,sans-serif';
    ctx.fillStyle=GREEN;
    ctx.fillText('FitLog',PAD,y+22*fs);
    const logoW=ctx.measureText('FitLog').width;
    ctx.font=(14*fs)+'px -apple-system,sans-serif';
    ctx.fillStyle=tcSub;
    ctx.fillText('  오운완',PAD+logoW,y+22*fs);

    // 해시태그
    const hash='#오운완 #핏로그';
    const hw=ctx.measureText(hash).width;
    ctx.fillText(hash,W-PAD-hw,y+22*fs);

    // base64 전송
    window.ReactNativeWebView.postMessage(canvas.toDataURL('image/jpeg',0.95));
    }catch(err){
      window.ReactNativeWebView.postMessage('ERROR:'+String(err));
    }
  }

  ${photoBase64 ? `
    var img=new Image();
    img.onload=function(){draw(img);};
    img.onerror=function(){draw(null);};
    img.src='data:image/jpeg;base64,${photoBase64}';
  ` : `draw(null);`}
})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 모달
// ─────────────────────────────────────────────────────────────────────────────
export default function OuwanCard({ visible, onClose, date, exercises, sessionType }: OuwanCardProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [originalUri, setOriginalUri] = useState<string | null>(null);
  const [ratio, setRatio] = useState<Ratio>("3:4");
  const [textColor, setTextColor] = useState<"white" | "black">("black");
  const [saving, setSaving] = useState(false);
  const [captureMode, setCaptureMode] = useState<"save" | "share" | null>(null);
  const [canvasHtml, setCanvasHtml] = useState<string | null>(null);

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

  const readFileBase64 = async (uri: string): Promise<string> => {
    const f = new File(uri);
    const ab = await f.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  };

  const writeFileBase64 = async (base64: string): Promise<string> => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const outFile = new File(Paths.cache, `ouwan_${Date.now()}.jpg`);
    await outFile.write(bytes);
    return outFile.uri;
  };

  // 캔버스 렌더링 트리거
  const triggerCapture = async (mode: "save" | "share") => {
    setSaving(true);
    setCaptureMode(mode);
    try {
      let photoBase64: string | null = null;
      if (photo) {
        photoBase64 = await readFileBase64(photo);
      }
      setCanvasHtml(buildCanvasHtml(photoBase64, ratio, date, exercises, textColor));
    } catch {
      Alert.alert("오류", "이미지 준비에 실패했어요.");
      setSaving(false);
      setCaptureMode(null);
    }
  };

  // WebView에서 base64 받으면 저장/공유
  const handleCanvasMessage = async (base64DataUrl: string) => {
    setCanvasHtml(null);
    if (base64DataUrl.startsWith("ERROR:")) {
      Alert.alert("캡처 실패", base64DataUrl.replace("ERROR:", ""));
      setSaving(false);
      setCaptureMode(null);
      return;
    }
    try {
      const base64 = base64DataUrl.replace(/^data:image\/jpeg;base64,/, "");
      const fileUri = await writeFileBase64(base64);

      if (captureMode === "save") {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== "granted") { Alert.alert("권한 필요", "사진 저장 권한이 필요해요."); return; }
        await MediaLibrary.saveToLibraryAsync(fileUri);
        Alert.alert("저장 완료", "카메라롤에 저장됐어요!");
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) { Alert.alert("오류", "공유를 지원하지 않는 기기예요."); return; }
        await Sharing.shareAsync(fileUri, { mimeType: "image/jpeg" });
      }
    } catch (e: any) {
      Alert.alert("오류", e?.message ?? "실패했어요.");
    } finally {
      setSaving(false);
      setCaptureMode(null);
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

          {/* 카드 미리보기 */}
          <View style={{ width: previewW, height: previewH, borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            <View style={{ width: CARD_W, height: cardH, transform: [{ scale }], transformOrigin: "top left" } as any}>
              <CardView photo={photo} ratio={ratio} date={date} exercises={exercises} textColor={textColor} />
            </View>
          </View>

          {/* 숨겨진 WebView 캔버스 캡처 */}
          {canvasHtml && (
            <View style={{ position: "absolute", top: -9999, left: -9999, width: CARD_W, height: RATIO_H[ratio] }}>
              <WebView
                source={{ html: canvasHtml }}
                onMessage={(e) => handleCanvasMessage(e.nativeEvent.data)}
                javaScriptEnabled
                originWhitelist={["*"]}
              />
            </View>
          )}

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
              onPress={() => triggerCapture("save")}
              disabled={saving}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#f5f5f5", borderWidth: 1, borderColor: "#e8e8e8", alignItems: "center" }}
            >
              {saving && captureMode === "save" ? <ActivityIndicator color="#333" /> : <Text style={{ fontSize: 14, fontWeight: "700", color: "#333" }}>저장</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => triggerCapture("share")}
              disabled={saving}
              style={{ flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.green, alignItems: "center" }}
            >
              {saving && captureMode === "share" ? <ActivityIndicator color="#000" /> : <Text style={{ fontSize: 14, fontWeight: "800", color: "#000" }}>공유하기</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
