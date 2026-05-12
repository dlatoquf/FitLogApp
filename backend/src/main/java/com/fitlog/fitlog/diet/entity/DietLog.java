package com.fitlog.fitlog.diet.entity;

import com.fitlog.fitlog.member.entity.Member;
import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "diet_logs")
public class DietLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(columnDefinition = "BIGINT COMMENT '식단 기록 고유 ID (PK)'")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false, columnDefinition = "BIGINT COMMENT 'members 테이블 FK'")
    private Member member;

    @Column(nullable = false, columnDefinition = "DATE COMMENT '식단 기록 날짜'")
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "ENUM('BREAKFAST','LUNCH','DINNER','SNACK') COMMENT '식사 유형'")
    private MealType mealType;

    @Column(name = "food_name_en", columnDefinition = "VARCHAR(255) COMMENT '음식 영어 이름'")
    private String foodNameEn;

    @Column(name = "food_name_ko", columnDefinition = "VARCHAR(255) COMMENT '음식 한글 이름'")
    private String foodNameKo;

    @Column(columnDefinition = "DOUBLE COMMENT '칼로리 (kcal)'")
    private Double calories;

    @Column(columnDefinition = "DOUBLE COMMENT '탄수화물 (g)'")
    private Double carbs;

    @Column(columnDefinition = "DOUBLE COMMENT '단백질 (g)'")
    private Double protein;

    @Column(columnDefinition = "DOUBLE COMMENT '지방 (g)'")
    private Double fat;

    public enum MealType {
        BREAKFAST, LUNCH, DINNER, SNACK
    }

    public Long getId() { return id; }
    public Member getMember() { return member; }
    public LocalDate getDate() { return date; }
    public MealType getMealType() { return mealType; }
    public String getFoodNameEn() { return foodNameEn; }
    public String getFoodNameKo() { return foodNameKo; }
    public Double getCalories() { return calories; }
    public Double getCarbs() { return carbs; }
    public Double getProtein() { return protein; }
    public Double getFat() { return fat; }

    public void setMember(Member member) { this.member = member; }
    public void setDate(LocalDate date) { this.date = date; }
    public void setMealType(MealType mealType) { this.mealType = mealType; }
    public void setFoodNameEn(String foodNameEn) { this.foodNameEn = foodNameEn; }
    public void setFoodNameKo(String foodNameKo) { this.foodNameKo = foodNameKo; }
    public void setCalories(Double calories) { this.calories = calories; }
    public void setCarbs(Double carbs) { this.carbs = carbs; }
    public void setProtein(Double protein) { this.protein = protein; }
    public void setFat(Double fat) { this.fat = fat; }
}
