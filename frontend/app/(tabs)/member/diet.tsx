import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../../constants/Colors";
import { API_URL, ENDPOINTS } from "../../../constants/api";
import { apiDelete, apiGet, toDateKey } from "../../../hooks/useApi";
import {
  DietFeedback,
  DietResponse,
  FoodSearchResult,
  MealType,
} from "../../../types";

const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: "BREAKFAST", label: "아침" },
  { key: "LUNCH", label: "점심" },
  { key: "DINNER", label: "저녁" },
  { key: "SNACK", label: "간식" },
];

const DEFAULT_GOALS = {
  kcal: 1800,
  carbs: 225,
  protein: 90,
  fat: 60,
};

const emptyDietData = (date: string): DietResponse => ({
  date,
  totalCalories: 0,
  totalCarbs: 0,
  totalProtein: 0,
  totalFat: 0,
  meals: [
    { mealType: "BREAKFAST", foods: [] },
    { mealType: "LUNCH", foods: [] },
    { mealType: "DINNER", foods: [] },
    { mealType: "SNACK", foods: [] },
  ],
});

type GoalPurpose = "DIET" | "MAINTAIN" | "BULK";

type AddFoodForm = {
  foodName: string;
  baseAmount: string;
  amount: string;
  unit: "g" | "개";
  calories: string;
  carbs: string;
  protein: string;
  fat: string;
  fatSecretFoodId?: string;
};

const emptyAddFoodForm: AddFoodForm = {
  foodName: "",
  baseAmount: "100",
  amount: "100",
  unit: "g",
  calories: "",
  carbs: "",
  protein: "",
  fat: "",
};

export default function MemberDietScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dietData, setDietData] = useState<DietResponse | null>(null);
  const [feedbacks, setFeedbacks] = useState<DietFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  const [addMealType, setAddMealType] = useState<MealType>("BREAKFAST");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const [addForm, setAddForm] = useState<AddFoodForm>(emptyAddFoodForm);
  const [editingFoodId, setEditingFoodId] = useState<number | null>(null);

  const [bodyWeight, setBodyWeight] = useState<number | null>(null);
  const [goalPurpose, setGoalPurpose] = useState<GoalPurpose>("MAINTAIN");

  const [goalKcal, setGoalKcal] = useState(DEFAULT_GOALS.kcal);
  const [goalCarbs, setGoalCarbs] = useState(DEFAULT_GOALS.carbs);
  const [goalProtein, setGoalProtein] = useState(DEFAULT_GOALS.protein);
  const [goalFat, setGoalFat] = useState(DEFAULT_GOALS.fat);

  const [goalForm, setGoalForm] = useState({
    kcal: String(DEFAULT_GOALS.kcal),
    carbs: String(DEFAULT_GOALS.carbs),
    protein: String(DEFAULT_GOALS.protein),
    fat: String(DEFAULT_GOALS.fat),
  });

  // React 개발모드 StrictMode / dateKey effect 중복 호출 방지
  const didFetchInitial = useRef(false);
  const prevDateKey = useRef<string | null>(null);

  const dateKey = toDateKey(selectedDate);
  const isToday = dateKey === toDateKey(new Date());

  const safeNumber = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const calcAdjustedFood = () => {
    const baseAmount = safeNumber(addForm.baseAmount) || 1;
    const amount = safeNumber(addForm.amount) || 0;
    const ratio = amount / baseAmount;

    return {
      foodName: addForm.foodName.trim(),
      calories: Math.round(safeNumber(addForm.calories) * ratio * 10) / 10,
      carbs: Math.round(safeNumber(addForm.carbs) * ratio * 10) / 10,
      protein: Math.round(safeNumber(addForm.protein) * ratio * 10) / 10,
      fat: Math.round(safeNumber(addForm.fat) * ratio * 10) / 10,
    };
  };

  const fetchMemberInfo = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/me`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const weight = Number(data?.weight);
      if (Number.isFinite(weight) && weight > 0) {
        setBodyWeight(weight);
      }
    } catch {}
  };

  const fetchGoals = async () => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/goals`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) throw new Error("목표값 조회 실패");

      const data = await res.json();

      const kcal = Number(data.targetCalories ?? DEFAULT_GOALS.kcal);
      const carbs = Number(data.targetCarbs ?? DEFAULT_GOALS.carbs);
      const protein = Number(data.targetProtein ?? DEFAULT_GOALS.protein);
      const fat = Number(data.targetFat ?? DEFAULT_GOALS.fat);
      const purpose = (
        data.purpose === "BULKUP" ? "BULK" : (data.purpose ?? "MAINTAIN")
      ) as GoalPurpose;

      setGoalKcal(kcal);
      setGoalCarbs(carbs);
      setGoalProtein(protein);
      setGoalFat(fat);
      setGoalPurpose(purpose);

      setGoalForm({
        kcal: String(kcal),
        carbs: String(carbs),
        protein: String(protein),
        fat: String(fat),
      });
    } catch {
      setGoalKcal(DEFAULT_GOALS.kcal);
      setGoalCarbs(DEFAULT_GOALS.carbs);
      setGoalProtein(DEFAULT_GOALS.protein);
      setGoalFat(DEFAULT_GOALS.fat);
      setGoalForm({
        kcal: String(DEFAULT_GOALS.kcal),
        carbs: String(DEFAULT_GOALS.carbs),
        protein: String(DEFAULT_GOALS.protein),
        fat: String(DEFAULT_GOALS.fat),
      });
    }
  };

  const calculateGoalsByWeight = (
    weight: number,
    purpose: GoalPurpose = goalPurpose,
  ) => {
    const maintenanceKcal = Math.round(weight * 33);

    let kcal = maintenanceKcal;
    if (purpose === "DIET") kcal = maintenanceKcal - 400;
    if (purpose === "BULK") kcal = maintenanceKcal + 400;

    const protein = Math.round(weight * 2.2);
    const fat = Math.round(weight * 1.0);

    const proteinKcal = protein * 4;
    const fatKcal = fat * 9;
    const remainKcal = Math.max(kcal - proteinKcal - fatKcal, 0);
    const carbs = Math.round(remainKcal / 4);

    return { kcal, carbs, protein, fat };
  };

  const applyAutoGoals = (purpose: GoalPurpose) => {
    if (!bodyWeight) {
      Alert.alert(
        "체중 없음",
        "회원 정보에 체중이 없어서 자동 계산을 할 수 없어요.",
      );
      return;
    }

    setGoalPurpose(purpose);
    const next = calculateGoalsByWeight(bodyWeight, purpose);

    setGoalForm({
      kcal: String(next.kcal),
      carbs: String(next.carbs),
      protein: String(next.protein),
      fat: String(next.fat),
    });
  };

  const saveGoals = async () => {
    const kcal = Number(goalForm.kcal);
    const carbs = Number(goalForm.carbs);
    const protein = Number(goalForm.protein);
    const fat = Number(goalForm.fat);

    if (!kcal || !carbs || !protein || !fat) {
      Alert.alert("확인", "목표 값을 모두 숫자로 입력해주세요.");
      return;
    }

    try {
      const jwt = await AsyncStorage.getItem("jwt");
      const res = await fetch(`${API_URL}/api/member/goals`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          purpose: goalPurpose === "BULK" ? "BULKUP" : goalPurpose,
          targetCalories: kcal,
          targetCarbs: carbs,
          targetProtein: protein,
          targetFat: fat,
        }),
      });

      if (!res.ok) throw new Error("목표값 저장 실패");

      const saved = await res.json();

      setGoalKcal(Number(saved.targetCalories));
      setGoalCarbs(Number(saved.targetCarbs));
      setGoalProtein(Number(saved.targetProtein));
      setGoalFat(Number(saved.targetFat));
      setGoalPurpose(
        (saved.purpose === "BULKUP"
          ? "BULK"
          : (saved.purpose ?? goalPurpose)) as GoalPurpose,
      );

      setShowGoalModal(false);
      Alert.alert("완료", "목표 영양 설정이 저장됐어요.");
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "목표값을 저장하지 못했어요.");
    }
  };

  const fetchDiet = async () => {
    setLoading(true);
    try {
      const data = await apiGet<DietResponse>(
        `${ENDPOINTS.diet.me}?date=${dateKey}`,
      );
      setDietData(data);
    } catch {
      setDietData(emptyDietData(dateKey));
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      const data = await apiGet<DietFeedback[]>(ENDPOINTS.diet.myFeedbacks);
      console.log("피드백 조회 성공:", data);
      setFeedbacks(data);
    } catch (e) {
      console.log("피드백 조회 실패:", e);
      setFeedbacks([]);
    }
  };

  const searchFood = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      //FatSecret 음식 검색 API는 사용 중
      const data = await apiGet<FoodSearchResult[]>(
        `${ENDPOINTS.diet.search}?query=${encodeURIComponent(searchQuery)}`,
      );
      setSearchResults(data);
    } catch {
      //FatSecret IP 제한 등으로 실패해도 직접 입력으로 추가 가능
      setSearchResults([]);
      setAddForm((prev) => ({
        ...prev,
        foodName: searchQuery,
      }));
      Alert.alert(
        "직접 입력",
        "음식 검색에 실패했어요. 음식명과 영양정보를 직접 입력해서 추가할 수 있어요.",
      );
    } finally {
      setSearching(false);
    }
  };
    useEffect(() => {
      if (!showAddModal) return;

      const timer = setTimeout(() => {
        if (searchQuery.trim()) {
          searchFood();
        } else {
          setSearchResults([]);
        }
      }, 300);

      return () => clearTimeout(timer);
    }, [searchQuery]);

  const cacheFood = async (food: FoodSearchResult) => {
    try {
      const jwt = await AsyncStorage.getItem("jwt");
      await fetch(`${API_URL}/api/diet/search/cache`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          foodId: food.foodId,
          foodName: food.foodName,
          source: food.source,
          calories: food.calories,
          carbs: food.carbs,
          protein: food.protein,
          fat: food.fat,
        }),
      });
    } catch {}
  };

  const selectSearchFood = (food: FoodSearchResult) => {
    setAddForm({
      foodName: food.foodName,
      baseAmount: "100",
      amount: "100",
      unit: "g",
      calories: String(food.calories ?? 0),
      carbs: String(food.carbs ?? 0),
      protein: String(food.protein ?? 0),
      fat: String(food.fat ?? 0),
      fatSecretFoodId: food.foodId,
    });
    setSearchQuery(food.foodName);
    setSearchResults([]);

    // 내부 DB 아닌 경우 캐싱
    if (!food.foodId?.startsWith("internal:")) {
      cacheFood(food);
    }
  };

  const saveFood = async () => {
    const adjusted = calcAdjustedFood();

    if (!adjusted.foodName) {
      Alert.alert("확인", "음식 이름을 입력해주세요.");
      return;
    }

    if (!safeNumber(addForm.amount)) {
      Alert.alert("확인", "섭취량을 입력해주세요.");
      return;
    }

    setAdding(true);

    try {
      const jwt = await AsyncStorage.getItem("jwt");

      const isEditMode = editingFoodId !== null;

      const url = isEditMode
        ? `${API_URL}/api/diet/log/${editingFoodId}`
        : `${API_URL}${ENDPOINTS.diet.log}`;

      const res = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          fatSecretFoodId: addForm.fatSecretFoodId,
          foodName: adjusted.foodName,
          calories: adjusted.calories,
          carbs: adjusted.carbs,
          protein: adjusted.protein,
          fat: adjusted.fat,
          mealType: addMealType,
          date: dateKey,
        }),
      });

      if (!res.ok) {
        const message = await res.text();
        throw new Error(
          message || (isEditMode ? "식단 수정 실패" : "식단 저장 실패"),
        );
      }

      // 서버 응답 body가 비어 있어도 json 파싱하지 않음
      setShowAddModal(false);
      setSearchQuery("");
      setSearchResults([]);
      setAddForm(emptyAddFoodForm);
      setEditingFoodId(null);

      await fetchDiet();

      Alert.alert(
        "완료",
        isEditMode ? "식단이 수정됐어요!" : "식단에 추가됐어요!",
      );
    } catch (e: any) {
      Alert.alert("오류", e.message ?? "식단 저장 중 오류가 발생했어요.");
    } finally {
      setAdding(false);
    }
  };

  const openEditFood = (food: any, mealType: MealType) => {
    setEditingFoodId(food.id);
    setAddMealType(mealType);
    setSearchQuery(food.foodName ?? "");
    setSearchResults([]);
    setAddForm({
      foodName: food.foodName ?? "",
      baseAmount: "100",
      amount: "100",
      unit: "g",
      calories: String(food.calories ?? 0),
      carbs: String(food.carbs ?? 0),
      protein: String(food.protein ?? 0),
      fat: String(food.fat ?? 0),
      fatSecretFoodId: food.fatSecretFoodId,
    });
    setShowAddModal(true);
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
    if (didFetchInitial.current) return;

    didFetchInitial.current = true;
    prevDateKey.current = dateKey;

    fetchMemberInfo();
    fetchGoals();
    fetchDiet();
    fetchFeedbacks();
  }, []);

  useEffect(() => {
    if (!didFetchInitial.current) return;
    if (prevDateKey.current === dateKey) return;

    prevDateKey.current = dateKey;
    fetchDiet();
  }, [dateKey]);

  const total = dietData?.totalCalories ?? 0;
  const dietPct = goalKcal > 0 ? Math.round((total / goalKcal) * 100) : 0;
  const adjustedFood = calcAdjustedFood();
  const selectedDateFeedbacks = feedbacks.filter(
    (fb) => String(fb.targetDate).slice(0, 10) === dateKey,
  );

  const changeDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 56,
          paddingBottom: 32,
        }}
      >
        {/* 날짜 선택 */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>‹</Text>
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text
              style={{ fontSize: 18, fontWeight: "800", color: Colors.text }}
            >
              {dateKey}
            </Text>
            {isToday && (
              <Text
                style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}
              >
                오늘
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            disabled={isToday}
            style={{ padding: 8, opacity: isToday ? 0.3 : 1 }}
          >
            <Text style={{ fontSize: 22, color: Colors.green }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* 
          3차 개발 예정: FatSecret 앱 계정 연동 버튼
          - 음식 검색 API는 현재 사용
          - 아래 버튼은 FatSecret 계정/앱 자동 연동 기능이므로 보류
        */}
        {/* 
        <TouchableOpacity>
          <Text>FatSecret 연동하기</Text>
        </TouchableOpacity>
        */}

        {/* 칼로리 요약 */}
        {loading ? (
          <ActivityIndicator color={Colors.green} style={{ marginTop: 20 }} />
        ) : (
          <View
            style={{
              backgroundColor: Colors.bgSub,
              borderRadius: 14,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 8,
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textMuted,
                    marginBottom: 2,
                  }}
                >
                  오늘 칼로리
                </Text>
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "900",
                    color: total > goalKcal ? Colors.red : Colors.green,
                  }}
                >
                  {Math.round(total).toLocaleString()}
                  <Text
                    style={{
                      fontSize: 14,
                      color: Colors.textMuted,
                      fontWeight: "400",
                    }}
                  >
                    {" "}
                    kcal
                  </Text>
                </Text>
              </View>

              <View style={{ alignItems: "flex-end" }}>
                <TouchableOpacity
                  onPress={() => {
                    setGoalForm({
                      kcal: String(goalKcal),
                      carbs: String(goalCarbs),
                      protein: String(goalProtein),
                      fat: String(goalFat),
                    });
                    setShowGoalModal(true);
                  }}
                  style={{
                    backgroundColor: "#fff",
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      color: Colors.textSub,
                      fontWeight: "700",
                    }}
                  >
                    수정
                  </Text>
                </TouchableOpacity>

                <Text
                  style={{
                    fontSize: 13,
                    color: total > goalKcal ? Colors.red : Colors.green,
                    fontWeight: "700",
                  }}
                >
                  {total > goalKcal
                    ? `${Math.round(total - goalKcal)} 초과`
                    : `${Math.round(goalKcal - total)} 남음`}
                </Text>
              </View>
            </View>

            <View
              style={{
                backgroundColor: Colors.border,
                borderRadius: 99,
                height: 10,
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${Math.min(dietPct, 100)}%` as any,
                  height: 10,
                  borderRadius: 99,
                  backgroundColor: dietPct > 100 ? Colors.red : Colors.green,
                }}
              />
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 11, color: Colors.textMuted }}>0</Text>
              <Text
                style={{ fontSize: 11, color: Colors.green, fontWeight: "700" }}
              >
                목표 {goalKcal.toLocaleString()}kcal
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-around",
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              {[
                {
                  label: "탄수화물",
                  val: dietData?.totalCarbs ?? 0,
                  goal: goalCarbs,
                },
                {
                  label: "단백질",
                  val: dietData?.totalProtein ?? 0,
                  goal: goalProtein,
                },
                { label: "지방", val: dietData?.totalFat ?? 0, goal: goalFat },
              ].map(({ label, val, goal }) => {
                const isOverGoal = goal > 0 && val > goal;
                const valueColor = isOverGoal ? Colors.red : Colors.text;

                return (
                  <View key={label} style={{ alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: valueColor,
                      }}
                    >
                      {Math.round(val)}
                      <Text style={{ fontSize: 11, color: valueColor }}>g</Text>
                    </Text>
                    <Text style={{ fontSize: 10, color: Colors.textMuted }}>
                      {label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isOverGoal ? Colors.red : Colors.textPlaceholder,
                      }}
                    >
                      / {goal}g
                    </Text>

                    <View
                      style={{
                        width: 50,
                        height: 4,
                        backgroundColor: Colors.border,
                        borderRadius: 99,
                        marginTop: 4,
                      }}
                    >
                      <View
                        style={{
                          width:
                            `${goal > 0 ? Math.min((val / goal) * 100, 100) : 0}%` as any,
                          height: 4,
                          borderRadius: 99,
                          backgroundColor: isOverGoal
                            ? Colors.red
                            : Colors.green,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* 식사별 기록 */}
        {MEAL_TYPES.map(({ key, label }) => {
          const mealGroup = dietData?.meals.find((m) => m.mealType === key);
          const foods = mealGroup?.foods ?? [];
          const mealCal = foods.reduce((s, f) => s + f.calories, 0);

          return (
            <View key={key} style={{ marginBottom: 14 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "700",
                      color: Colors.text,
                    }}
                  >
                    {label}
                  </Text>
                  {mealCal > 0 && (
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                      {Math.round(mealCal)} kcal
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setAddMealType(key);
                    setSearchQuery("");
                    setSearchResults([]);
                    setAddForm(emptyAddFoodForm);
                    setEditingFoodId(null);
                    setShowAddModal(true);
                  }}
                  style={{
                    backgroundColor: Colors.greenLight,
                    borderWidth: 1,
                    borderColor: Colors.green + "44",
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.green,
                      fontWeight: "700",
                    }}
                  >
                    + 추가
                  </Text>
                </TouchableOpacity>
              </View>

              {foods.length === 0 ? (
                <View
                  style={{
                    backgroundColor: Colors.bgSub,
                    borderRadius: 10,
                    padding: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderStyle: "dashed",
                  }}
                >
                  <Text style={{ fontSize: 12, color: Colors.textPlaceholder }}>
                    기록된 식품이 없어요
                  </Text>
                </View>
              ) : (
                foods.map((food) => (
                  <TouchableOpacity
                    key={food.id}
                    onLongPress={() => deleteFood(food.id)}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      padding: 12,
                      marginBottom: 4,
                      borderLeftWidth: 3,
                      borderLeftColor: Colors.green,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      flexDirection: "row",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color: Colors.text,
                        }}
                      >
                        {food.foodName}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: Colors.text,
                          marginTop: 2,
                        }}
                      >
                        탄 {food.carbs}g · 단 {food.protein}g · 지 {food.fat}g
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 6 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: Colors.green,
                        }}
                      >
                        {food.calories}kcal
                      </Text>
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        <TouchableOpacity
                          onPress={() => openEditFood(food, key)}
                          style={{
                            backgroundColor: "#fff",
                            borderWidth: 1,
                            borderColor: Colors.border,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: Colors.textSub,
                              fontWeight: "700",
                            }}
                          >
                            수정
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => deleteFood(food.id)}
                          style={{
                            backgroundColor: Colors.red + "11",
                            borderWidth: 1,
                            borderColor: Colors.red + "44",
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 10,
                              color: Colors.red,
                              fontWeight: "700",
                            }}
                          >
                            삭제
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}

        {/* 트레이너 피드백 */}
        {selectedDateFeedbacks.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  width: 3,
                  height: 16,
                  backgroundColor: Colors.blue,
                  borderRadius: 2,
                }}
              />
              <Text
                style={{ fontSize: 15, fontWeight: "700", color: Colors.text }}
              >
                트레이너 피드백
              </Text>
            </View>

            {selectedDateFeedbacks.map((fb) => (
              <View
                key={fb.id}
                style={{
                  backgroundColor: Colors.blueBg,
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: Colors.blue,
                  borderWidth: 1,
                  borderColor: Colors.blue + "44",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                    {fb.targetDate}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 13, color: Colors.text, lineHeight: 20 }}
                >
                  {fb.comment}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 목표값 수정 모달 */}
      <Modal visible={showGoalModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
              maxHeight: "88%",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                  alignSelf: "center",
                  marginBottom: 16,
                }}
              />
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 6,
                }}
              >
                목표값 수정
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 16,
                }}
              >
                체중 기반으로 자동 계산하거나 직접 수정할 수 있어요.
              </Text>

              <View
                style={{
                  backgroundColor: Colors.bgSub,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: Colors.text,
                    marginBottom: 8,
                  }}
                >
                  목적에 맞게 칼로리 설정
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textSub,
                    lineHeight: 20,
                  }}
                >
                  🔻 다이어트 → 유지 칼로리 -300~500kcal{"\n"}
                  🔺 벌크업 → 유지 칼로리 +300~500kcal{"\n"}
                  ⚖️ 건강 유지 → 유지 칼로리 그대로
                </Text>

                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: Colors.text,
                    marginTop: 14,
                    marginBottom: 8,
                  }}
                >
                  탄·단·지(g) 계산
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: Colors.textSub,
                    lineHeight: 20,
                  }}
                >
                  BW = 체중(kg){"\n"}
                  🍗 단백질 = BW × 1.6~2.6g{"\n"}
                  🥑 지방 = BW × 0.5~1.0g{"\n"}
                  🍚 탄수화물 = 목표 칼로리 - 단백질 kcal - 지방 kcal의 남은 값
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                현재 체중: {bodyWeight ? `${bodyWeight}kg` : "미입력"}
              </Text>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                {[
                  { key: "DIET", label: "다이어트" },
                  { key: "MAINTAIN", label: "유지" },
                  { key: "BULK", label: "벌크업" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => applyAutoGoals(item.key as GoalPurpose)}
                    style={{
                      flex: 1,
                      backgroundColor:
                        goalPurpose === item.key ? Colors.green : Colors.bgSub,
                      borderWidth: 1,
                      borderColor:
                        goalPurpose === item.key ? Colors.green : Colors.border,
                      borderRadius: 10,
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "800",
                        color:
                          goalPurpose === item.key ? "#fff" : Colors.textSub,
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {[
                { label: "총칼로리", key: "kcal", unit: "kcal" },
                { label: "탄수화물", key: "carbs", unit: "g" },
                { label: "단백질", key: "protein", unit: "g" },
                { label: "지방", key: "fat", unit: "g" },
              ].map((item) => (
                <View key={item.key} style={{ marginBottom: 12 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    {item.label}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                    }}
                  >
                    <TextInput
                      value={
                        goalForm[
                          item.key as "kcal" | "carbs" | "protein" | "fat"
                        ]
                      }
                      onChangeText={(v) =>
                        setGoalForm((prev) => ({
                          ...prev,
                          [item.key as "kcal" | "carbs" | "protein" | "fat"]:
                            v.replace(/[^0-9]/g, ""),
                        }))
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textPlaceholder}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        fontSize: 16,
                        fontWeight: "700",
                        color: Colors.text,
                      }}
                    />
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                      {item.unit}
                    </Text>
                  </View>
                </View>
              ))}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setShowGoalModal(false)}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>
                    취소
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveGoals}
                  style={{
                    flex: 2,
                    backgroundColor: Colors.green,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    저장
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 음식 추가 모달 */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 40,
              maxHeight: "88%",
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: Colors.border,
                  borderRadius: 99,
                  alignSelf: "center",
                  marginBottom: 16,
                }}
              />

              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "800",
                  color: Colors.text,
                  marginBottom: 4,
                }}
              >
                {MEAL_TYPES.find((m) => m.key === addMealType)?.label}{" "}
                {editingFoodId ? "수정" : "추가"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 16,
                }}
              >
                음식 검색 후 g/개수를 수정하거나 직접 입력할 수 있어요.
              </Text>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <TextInput
                  value={searchQuery}
                  onChangeText={(text) => {
                    setSearchQuery(text);
                  }}
                  placeholder="음식 이름 검색..."
                  placeholderTextColor={Colors.textPlaceholder}
                  style={{
                    flex: 1,
                    backgroundColor: Colors.bgSub,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    color: Colors.text,
                  }}
                />
              </View>

              {searchResults.length > 0 && (
                <View>
                  {searchResults.map((item) => (
                    <TouchableOpacity
                      key={item.foodId}
                      onPress={() => selectSearchFood(item)}
                      style={{
                        backgroundColor: Colors.bgSub,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 6,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: Colors.text,
                          }}
                        >
                          {item.foodName}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: Colors.textMuted,
                            marginTop: 2,
                          }}
                        >
                          탄 {item.carbs}g · 단 {item.protein}g · 지 {item.fat}g
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "800",
                          color: Colors.gold,
                        }}
                      >
                        {item.calories}kcal
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text
                style={{ fontSize: 12, color: Colors.textSub, marginBottom: 6 }}
              >
                음식명
              </Text>
              <TextInput
                value={addForm.foodName}
                onChangeText={(v) =>
                  setAddForm((prev) => ({ ...prev, foodName: v }))
                }
                placeholder="예: 닭가슴살"
                placeholderTextColor={Colors.textPlaceholder}
                style={{
                  backgroundColor: Colors.bgSub,
                  borderWidth: 1,
                  borderColor: Colors.border,
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 14,
                  color: Colors.text,
                  marginBottom: 12,
                }}
              />

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    기준량
                  </Text>
                  <TextInput
                    value={addForm.baseAmount}
                    onChangeText={(v) =>
                      setAddForm((prev) => ({
                        ...prev,
                        baseAmount: v.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="100"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                      color: Colors.text,
                    }}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    섭취량
                  </Text>
                  <TextInput
                    value={addForm.amount}
                    onChangeText={(v) =>
                      setAddForm((prev) => ({
                        ...prev,
                        amount: v.replace(/[^0-9.]/g, ""),
                      }))
                    }
                    keyboardType="decimal-pad"
                    placeholder="100"
                    placeholderTextColor={Colors.textPlaceholder}
                    style={{
                      backgroundColor: Colors.bgSub,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      borderRadius: 10,
                      padding: 12,
                      fontSize: 14,
                      color: Colors.text,
                    }}
                  />
                </View>

                <View style={{ width: 82 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: Colors.textSub,
                      marginBottom: 6,
                    }}
                  >
                    단위
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: Colors.bgSub,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: Colors.border,
                      overflow: "hidden",
                    }}
                  >
                    {(["g", "개"] as const).map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        onPress={() =>
                          setAddForm((prev) => ({ ...prev, unit }))
                        }
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: "center",
                          backgroundColor:
                            addForm.unit === unit
                              ? Colors.green
                              : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "700",
                            color:
                              addForm.unit === unit ? "#fff" : Colors.textSub,
                          }}
                        >
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 12,
                  color: Colors.textMuted,
                  marginBottom: 8,
                }}
              >
                아래 영양정보는 기준량 기준으로 입력하세요. 섭취량에 맞춰 자동
                계산돼요.
              </Text>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  { key: "calories", label: "칼로리" },
                  { key: "carbs", label: "탄수" },
                ].map((item) => (
                  <View key={item.key} style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.textSub,
                        marginBottom: 6,
                      }}
                    >
                      {item.label}
                    </Text>
                    <TextInput
                      value={addForm[item.key as keyof AddFoodForm] as string}
                      onChangeText={(v) =>
                        setAddForm((prev) => ({
                          ...prev,
                          [item.key]: v.replace(/[^0-9.]/g, ""),
                        }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textPlaceholder}
                      style={{
                        backgroundColor: Colors.bgSub,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 14,
                        color: Colors.text,
                      }}
                    />
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {[
                  { key: "protein", label: "단백질" },
                  { key: "fat", label: "지방" },
                ].map((item) => (
                  <View key={item.key} style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        color: Colors.textSub,
                        marginBottom: 6,
                      }}
                    >
                      {item.label}
                    </Text>
                    <TextInput
                      value={addForm[item.key as keyof AddFoodForm] as string}
                      onChangeText={(v) =>
                        setAddForm((prev) => ({
                          ...prev,
                          [item.key]: v.replace(/[^0-9.]/g, ""),
                        }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={Colors.textPlaceholder}
                      style={{
                        backgroundColor: Colors.bgSub,
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 10,
                        padding: 12,
                        fontSize: 14,
                        color: Colors.text,
                      }}
                    />
                  </View>
                ))}
              </View>

              <View
                style={{
                  backgroundColor: Colors.greenLight,
                  borderWidth: 1,
                  borderColor: Colors.green + "44",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: Colors.green,
                    marginBottom: 6,
                  }}
                >
                  계산된 섭취량
                </Text>
                <Text style={{ fontSize: 12, color: Colors.textSub }}>
                  {addForm.amount || 0}
                  {addForm.unit} 기준 · {adjustedFood.calories}kcal · 탄{" "}
                  {adjustedFood.carbs}g · 단 {adjustedFood.protein}g · 지{" "}
                  {adjustedFood.fat}g
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddModal(false);
                    setSearchQuery("");
                    setSearchResults([]);
                    setAddForm(emptyAddFoodForm);
                    setEditingFoodId(null);
                  }}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 14, color: Colors.textSub }}>
                    닫기
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveFood}
                  disabled={adding}
                  style={{
                    flex: 2,
                    backgroundColor: Colors.green,
                    borderRadius: 12,
                    padding: 14,
                    alignItems: "center",
                    opacity: adding ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}
                  >
                    {adding
                      ? editingFoodId
                        ? "수정 중..."
                        : "추가 중..."
                      : editingFoodId
                        ? "수정하기"
                        : "추가하기"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}