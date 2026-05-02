import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { apiDelete, apiGet, apiPost, toDateKey } from "../../../hooks/useApi";
import { DietFeedback, DietResponse, FoodItem, FoodSearchResult, MealType } from "../../../types";

const MEAL_TYPES: { key: MealType; label: string; emoji: string }[] = [
  { key: "BREAKFAST", label: "아침", emoji: "🌅" },
  { key: "LUNCH", label: "점심", emoji: "☀️" },
  { key: "DINNER", label: "저녁", emoji: "🌙" },
  { key: "SNACK", label: "간식", emoji: "🍎" },
];

const GOAL_KCAL = 1800;

export default function MemberDietScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dietData, setDietData] = useState<DietResponse | null>(null);
  const [feedbacks, setFeedbacks] = useState<DietFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>("BREAKFAST");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const dateKey = toDateKey(selectedDate);

  const fetchDiet = async () => {
    setLoading(true);
    try {
      const data = await apiGet<DietResponse>(`${ENDPOINTS.diet.me}?date=${dateKey}`);
      setDietData(data);
    } catch {
      setDietData({
        date: dateKey,
        totalCalories: 1450,
        totalCarbs: 180,
        totalProtein: 90,
        totalFat: 45,
        meals: [
          {
            mealType: "BREAKFAST",
            foods: [
              { id: 1, foodName: "현미밥", calories: 300, carbs: 65, protein: 6, fat: 1 },
              { id: 2, foodName: "닭가슴살", calories: 165, carbs: 0, protein: 31, fat: 3.6 },
            ],
          },
          {
            mealType: "LUNCH",
            foods: [
              { id: 3, foodName: "고구마", calories: 130, carbs: 30, protein: 2, fat: 0.1 },
              { id: 4, foodName: "계란 2개", calories: 156, carbs: 1, protein: 13, fat: 11 },
            ],
          },
          { mealType: "DINNER", foods: [] },
          { mealType: "SNACK", foods: [] },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const data = await apiGet<DietFeedback[]>(ENDPOINTS.diet.myFeedbacks);
      setFeedbacks(data);
    } catch {
      setFeedbacks([
        { id: 1, comment: "오늘 단백질 섭취가 조금 부족해요. 저녁에 닭가슴살이나 두부를 추가해보세요!", targetDate: "2025-04-30", createdAt: "2025-04-30T20:00:00", read: false },
        { id: 2, comment: "식단 구성이 좋아요! 탄수화물 비율이 적절하게 유지되고 있어요.", targetDate: "2025-04-29", createdAt: "2025-04-29T19:00:00", read: true },
      ]);
    }
  };

  const searchFood = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await apiGet<FoodSearchResult[]>(`${ENDPOINTS.diet.search}?query=${encodeURIComponent(searchQuery)}`);
      setSearchResults(data);
    } catch {
      // 더미 검색 결과
      setSearchResults([
        { foodId: "1", foodName: `${searchQuery} (100g)`, calories: 200, carbs: 30, protein: 15, fat: 5 },
        { foodId: "2", foodName: `${searchQuery} 구이`, calories: 250, carbs: 10, protein: 30, fat: 8 },
        { foodId: "3", foodName: `${searchQuery} 볶음`, calories: 180, carbs: 20, protein: 12, fat: 6 },
      ]);
    } finally {
      setSearching(false);
    }
  };

  const addFood = async (food: FoodSearchResult) => {
    setAdding(true);
    try {
      await apiPost(ENDPOINTS.diet.log, {
        foodId: food.foodId,
        foodName: food.foodName,
        calories: food.calories,
        carbs: food.carbs,
        protein: food.protein,
        fat: food.fat,
        mealType: addMealType,
        date: dateKey,
      });
      setShowAddModal(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchDiet();
      Alert.alert("완료", "식단에 추가됐어요!");
    } catch (e: any) {
      Alert.alert("오류", e.message);
    } finally {
      setAdding(false);
    }
  };

  const deleteFood = async (foodId: number) => {
    Alert.alert("삭제", "이 식품을 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          try {
            await apiDelete(ENDPOINTS.diet.logDelete(foodId));
            fetchDiet();
          } catch (e: any) {
            Alert.alert("오류", e.message);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    fetchDiet();
    fetchFeedbacks();
  }, [dateKey]);

  const total = dietData?.totalCalories ?? 0;
  const dietPct = Math.round((total / GOAL_KCAL) * 100);

  // 날짜 이동
  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, paddingBottom: 32 }}>
        {/* 날짜 선택 */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={{ padding: 8 }}>
            <Text style={{ fontSize: 22, color: Colors.green }}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}>{dateKey}</Text>
            {dateKey === toDateKey(new Date()) && (
              <Text style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}>오늘</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            disabled={dateKey >= toDateKey(new Date())}
            style={{ padding: 8, opacity: dateKey >= toDateKey(new Date()) ? 0.3 : 1 }}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 칼로리 요약 */}
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginVertical: 20 }} />
        ) : (
          <View style={{ backgroundColor: Colors.bgSub, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 }}>
              <View>
                <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 2 }}>오늘 섭취</Text>
                <Text style={{ fontSize: 32, fontWeight: "900", color: Colors.gold }}>
                  {Math.round(total).toLocaleString()}
                  <Text style={{ fontSize: 14, color: Colors.textMuted }}> kcal</Text>
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 13, color: Colors.textMuted }}>목표 {GOAL_KCAL.toLocaleString()} kcal</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: dietPct >= 100 ? Colors.red : Colors.green }}>
                  {dietPct}%
                </Text>
              </View>
            </View>
            <View style={{ backgroundColor: Colors.border, borderRadius: 99, height: 8, marginBottom: 12 }}>
              <View style={{ width: `${Math.min(dietPct, 100)}%` as any, height: 8, borderRadius: 99, backgroundColor: dietPct > 100 ? Colors.red : Colors.gold }} />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              {[
                { label: "탄수화물", val: dietData?.totalCarbs ?? 0, goal: 225, color: Colors.blue },
                { label: "단백질", val: dietData?.totalProtein ?? 0, goal: 90, color: Colors.green },
                { label: "지방", val: dietData?.totalFat ?? 0, goal: 60, color: Colors.gold },
              ].map(({ label, val, goal, color }) => (
                <View key={label} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color }}>{Math.round(val)}<Text style={{ fontSize: 11 }}>g</Text></Text>
                  <Text style={{ fontSize: 10, color: Colors.textMuted }}>{label}</Text>
                  <Text style={{ fontSize: 10, color: Colors.textPlaceholder }}>/ {goal}g</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 식사별 기록 */}
        {MEAL_TYPES.map(({ key, label, emoji }) => {
          const mealGroup = dietData?.meals.find((m) => m.mealType === key);
          const foods = mealGroup?.foods ?? [];
          const mealCal = foods.reduce((s, f) => s + f.calories, 0);

          return (
            <View key={key} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>{label}</Text>
                  {mealCal > 0 && (
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>{Math.round(mealCal)} kcal</Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => { setAddMealType(key); setShowAddModal(true); }}
                  style={{ backgroundColor: Colors.greenLight, borderWidth: 1, borderColor: Colors.green + "44", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: 12, color: Colors.green, fontWeight: "700" }}>+ 추가</Text>
                </TouchableOpacity>
              </View>

              {foods.length === 0 ? (
                <View style={{ backgroundColor: Colors.bgSub, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: Colors.border, borderStyle: "dashed" }}>
                  <Text style={{ fontSize: 12, color: Colors.textPlaceholder }}>기록된 식품이 없어요</Text>
                </View>
              ) : (
                foods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    onLongPress={() => deleteFood(food.id)}
                    style={{ backgroundColor: Colors.bgSub, borderRadius: 10, padding: 12, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: Colors.gold, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center" }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: Colors.text }}>{food.foodName}</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                        탄 {food.carbs}g · 단 {food.protein}g · 지 {food.fat}g
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: Colors.gold }}>{food.calories}kcal</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}

        {/* 트레이너 피드백 */}
        {feedbacks.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <View style={{ width: 3, height: 16, backgroundColor: Colors.blue, borderRadius: 2 }} />
              <Text style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}>트레이너 피드백</Text>
            </View>
            {feedbacks.slice(0, 3).map((fb) => (
              <View
                key={fb.id}
                style={{
                  backgroundColor: fb.read ? Colors.bgSub : Colors.blueBg,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: Colors.blue,
                  borderWidth: 1,
                  borderColor: fb.read ? Colors.border : Colors.blue + "44",
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>{fb.targetDate}</Text>
                  {!fb.read && (
                    <View style={{ backgroundColor: Colors.blue, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>NEW</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}>{fb.comment}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 음식 추가 모달 */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, maxHeight: "80%" }}>
            <View style={{ width: 40, height: 4, backgroundColor: Colors.border, borderRadius: 99, alignSelf: "center", marginBottom: 16 }} />
            <Text style={{ fontSize: 17, fontWeight: "800", color: Colors.text, marginBottom: 4 }}>
              {MEAL_TYPES.find((m) => m.key === addMealType)?.emoji}{" "}
              {MEAL_TYPES.find((m) => m.key === addMealType)?.label} 추가
            </Text>
            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 16 }}>길게 눌러 삭제 가능</Text>

            {/* 검색 */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="음식 이름 검색..."
                placeholderTextColor={Colors.textPlaceholder}
                onSubmitEditing={searchFood}
                style={{ flex: 1, backgroundColor: Colors.bgSub, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: Colors.text }}
              />
              <TouchableOpacity
                onPress={searchFood}
                disabled={searching}
                style={{ backgroundColor: Colors.green, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {searching ? "..." : "검색"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* 검색 결과 */}
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.foodId}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => addFood(item)}
                    disabled={adding}
                    style={{ backgroundColor: Colors.bgSub, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.border, flexDirection: "row", alignItems: "center" }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: Colors.text }}>{item.foodName}</Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 2 }}>
                        탄 {item.carbs}g · 단 {item.protein}g · 지 {item.fat}g
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 14, fontWeight: "800", color: Colors.gold }}>{item.calories}kcal</Text>
                      <Text style={{ fontSize: 11, color: Colors.green, marginTop: 2 }}>+ 추가</Text>
                    </View>
                  </TouchableOpacity>
                )}
                style={{ maxHeight: 300 }}
              />
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>🔍</Text>
                <Text style={{ fontSize: 14, color: Colors.textMuted }}>음식 이름을 검색해보세요</Text>
              </View>
            )}

            <TouchableOpacity
              onPress={() => { setShowAddModal(false); setSearchQuery(""); setSearchResults([]); }}
              style={{ marginTop: 12, alignItems: "center", padding: 14 }}
            >
              <Text style={{ fontSize: 14, color: Colors.textMuted }}>닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
