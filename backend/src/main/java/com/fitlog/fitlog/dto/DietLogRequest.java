package com.fitlog.fitlog.dto;

public class DietLogRequest {
    private String date;
    private String mealType;
    private String foodName;
    private Double calories;
    private Double carbs;
    private Double protein;
    private Double fat;
    private String fatSecretFoodId;

    public String getDate() { return date; }
    public String getMealType() { return mealType; }
    public String getFoodName() { return foodName; }
    public Double getCalories() { return calories; }
    public Double getCarbs() { return carbs; }
    public Double getProtein() { return protein; }
    public Double getFat() { return fat; }
    public String getFatSecretFoodId() { return fatSecretFoodId; }
}
