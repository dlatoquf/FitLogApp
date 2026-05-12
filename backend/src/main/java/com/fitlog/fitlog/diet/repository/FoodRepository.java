package com.fitlog.fitlog.diet.repository;

import com.fitlog.fitlog.diet.entity.Food;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FoodRepository extends JpaRepository<Food, Long> {

    // 내부 DB 검색 (한글 이름 기준, 최대 10개)
    @Query("SELECT f FROM Food f WHERE f.foodName LIKE %:keyword% ORDER BY f.foodName")
    List<Food> findByFoodNameContaining(@Param("keyword") String keyword);
}