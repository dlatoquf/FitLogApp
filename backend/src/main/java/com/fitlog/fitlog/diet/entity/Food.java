package com.fitlog.fitlog.diet.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "foods")
public class Food {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "food_id")
    private Long foodId;

    @Column(name = "food_code")
    private String foodCode;

    @Column(name = "food_name", nullable = false)
    private String foodName;

    @Column(name = "data_type")
    private String dataType;

    @Column(name = "base_amount")
    private String baseAmount;

    @Column(name = "food_weight")
    private String foodWeight;

    @Column(name = "calories")
    private Float calories = 0f;

    @Column(name = "protein")
    private Float protein = 0f;

    @Column(name = "fat")
    private Float fat = 0f;

    @Column(name = "carbohydrate")
    private Float carbohydrate = 0f;

    @Column(name = "sugar")
    private Float sugar = 0f;

    @Column(name = "sodium")
    private Float sodium = 0f;

    @Column(name = "cholesterol")
    private Float cholesterol = 0f;

    @Column(name = "saturated_fat")
    private Float saturatedFat = 0f;

    @Column(name = "trans_fat")
    private Float transFat = 0f;

    @Column(name = "dietary_fiber")
    private Float dietaryFiber = 0f;

    @Column(name = "calcium")
    private Float calcium = 0f;

    @Column(name = "vitamin_c")
    private Float vitaminC = 0f;

    @Column(name = "company_name")
    private String companyName;

    @Column(name = "source_name")
    private String sourceName;

    @Column(name = "data_base_date")
    private LocalDate dataBaseDate;

    @Column(name = "source_type")
    private String sourceType = "korea_db";

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    // Getters
    public Long getFoodId() { return foodId; }
    public String getFoodCode() { return foodCode; }
    public String getFoodName() { return foodName; }
    public String getDataType() { return dataType; }
    public String getBaseAmount() { return baseAmount; }
    public String getFoodWeight() { return foodWeight; }
    public Float getCalories() { return calories; }
    public Float getProtein() { return protein; }
    public Float getFat() { return fat; }
    public Float getCarbohydrate() { return carbohydrate; }
    public Float getSugar() { return sugar; }
    public Float getSodium() { return sodium; }
    public Float getCholesterol() { return cholesterol; }
    public Float getSaturatedFat() { return saturatedFat; }
    public Float getTransFat() { return transFat; }
    public Float getDietaryFiber() { return dietaryFiber; }
    public Float getCalcium() { return calcium; }
    public Float getVitaminC() { return vitaminC; }
    public String getCompanyName() { return companyName; }
    public String getSourceName() { return sourceName; }
    public LocalDate getDataBaseDate() { return dataBaseDate; }
    public String getSourceType() { return sourceType; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    // Setters
    public void setFoodCode(String foodCode) { this.foodCode = foodCode; }
    public void setFoodName(String foodName) { this.foodName = foodName; }
    public void setDataType(String dataType) { this.dataType = dataType; }
    public void setBaseAmount(String baseAmount) { this.baseAmount = baseAmount; }
    public void setFoodWeight(String foodWeight) { this.foodWeight = foodWeight; }
    public void setCalories(Float calories) { this.calories = calories; }
    public void setProtein(Float protein) { this.protein = protein; }
    public void setFat(Float fat) { this.fat = fat; }
    public void setCarbohydrate(Float carbohydrate) { this.carbohydrate = carbohydrate; }
    public void setSugar(Float sugar) { this.sugar = sugar; }
    public void setSodium(Float sodium) { this.sodium = sodium; }
    public void setCholesterol(Float cholesterol) { this.cholesterol = cholesterol; }
    public void setSaturatedFat(Float saturatedFat) { this.saturatedFat = saturatedFat; }
    public void setTransFat(Float transFat) { this.transFat = transFat; }
    public void setDietaryFiber(Float dietaryFiber) { this.dietaryFiber = dietaryFiber; }
    public void setCalcium(Float calcium) { this.calcium = calcium; }
    public void setVitaminC(Float vitaminC) { this.vitaminC = vitaminC; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public void setSourceName(String sourceName) { this.sourceName = sourceName; }
    public void setDataBaseDate(LocalDate dataBaseDate) { this.dataBaseDate = dataBaseDate; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
}