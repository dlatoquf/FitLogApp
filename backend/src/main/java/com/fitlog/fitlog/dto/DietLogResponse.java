package com.fitlog.fitlog.dto;

import java.util.List;

public class DietLogResponse {
    private String date;
    private double totalCalories;
    private double totalCarbs;
    private double totalProtein;
    private double totalFat;
    private List<MealGroup> meals;

    public record MealGroup(String mealType, List<FoodItem> foods) {}
    public record FoodItem(
            Long id, String foodName,
            double calories, double carbs, double protein, double fat
    ) {}

    public DietLogResponse(String date, double totalCalories, double totalCarbs,
                           double totalProtein, double totalFat, List<MealGroup> meals) {
        this.date = date;
        this.totalCalories = totalCalories;
        this.totalCarbs = totalCarbs;
        this.totalProtein = totalProtein;
        this.totalFat = totalFat;
        this.meals = meals;
    }

    public String getDate() { return date; }
    public double getTotalCalories() { return totalCalories; }
    public double getTotalCarbs() { return totalCarbs; }
    public double getTotalProtein() { return totalProtein; }
    public double getTotalFat() { return totalFat; }
    public List<MealGroup> getMeals() { return meals; }
}