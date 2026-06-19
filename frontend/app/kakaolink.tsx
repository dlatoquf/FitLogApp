import { useEffect } from "react";
import { View } from "react-native";

// 딥링크 처리는 _layout.tsx handleDeepLink 에서 담당
// 이 화면은 Expo Router가 kakaolink 경로로 자동 라우팅할 때만 렌더링됨
export default function KakaoLinkHandler() {
  useEffect(() => {}, []);
  return <View />;
}
