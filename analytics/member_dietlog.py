import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import pymysql
from fastapi import FastAPI, HTTPException
from datetime import datetime, timedelta

app = FastAPI()

# ==========================================
# 1. DB 설정 및 연결 함수
# ==========================================
DB_CONFIG = {
    "host": "switchyard.proxy.rlwy.net",        
    "user": "root",       
    "password": "AUjyFJnHTFFlZHmOyPLIoZiKWqTzhSYO", 
    "db": "railway",                 
    "port": 48785
}

def get_db_connection():
    return pymysql.connect(
        host=DB_CONFIG["host"],
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        database=DB_CONFIG["db"], 
        port=DB_CONFIG["port"]
    )

# ==========================================
# 2. 회원용 PRO 권한 체크
# ==========================================
def is_member_trainer_pro(member_id: int, conn) -> bool:
    query = """
        SELECT t.plan 
        FROM members m 
        JOIN trainers t ON m.trainer_id = t.id 
        WHERE m.id = %s
    """
    with conn.cursor() as cursor:
        cursor.execute(query, [member_id])
        result = cursor.fetchone()
    return result is not None and result[0] == 'PRO'

# ==========================================
# 3. 식단 패턴 분석 API (이번 주 기준)
# ==========================================
@app.get("/api/analytics/diet-pattern/{member_id}")
def get_diet_pattern(member_id: int):
    conn = get_db_connection()
    try:
        # 이번 주 월요일 날짜 구하기
        today = datetime.now()
        monday_date = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')

        # 이번 주 식단 데이터 가져오기
        query = """
            SELECT date, calories, protein 
            FROM diet_logs 
            WHERE member_id = %s AND date >= %s
        """
        df = pd.read_sql_query(query, conn, params=[member_id, monday_date])
        
        # 이번 주 운동 일수 (월~일 기준)
        workout_query = """
            SELECT COUNT(DISTINCT log_date) as workout_days
            FROM workout_logs
            WHERE member_id = %s AND YEARWEEK(log_date, 1) = YEARWEEK(CURDATE(), 1)
        """
        df_workout = pd.read_sql_query(workout_query, conn, params=[member_id])
        workout_days = int(df_workout.iloc[0]['workout_days']) if not df_workout.empty else 0

        # 이번 주 기록이 전혀 없을 때 방어 로직
        if df.empty:
            return {
                "status": "success",
                "data": {
                    "metrics": {
                        "avg_calories": 0,
                        "avg_protein": 0,
                        "integrity_score": 0,
                        "workout_days": workout_days
                    },
                    "warnings": ["이번 주 식단 기록이 전혀 없어요!"]
                }
            }

        # ==========================================
        # 💡 [핵심 로직 변경] 입력한 일수만큼만 정확하게 평균 내기
        # 하루에 여러 끼니(아침/점심/저녁)를 썼을 수 있으므로, 먼저 날짜별로 합산(sum)을 합니다.
        # ==========================================
        daily_totals = df.groupby('date')[['calories', 'protein']].sum()
        
        # 날짜별로 합산된 값들의 평균을 구합니다. 
        # 만약 월~일 중 4일만 입력했다면 자동으로 총합을 4로 나누어 평균을 냅니다.
        avg_calories = daily_totals['calories'].mean()
        avg_protein = daily_totals['protein'].mean()
        
        # 성실도 (이번 주 7일 중 실제 기록한 일수 비율)
        record_days = daily_totals.index.nunique()
        integrity_score = round((record_days / 7) * 100, 1)

        # 경고 메시지 리스트 구성
        warnings_list = []
        if pd.notna(avg_protein) and avg_protein < 100:
            warnings_list.append("단백질 섭취가 부족해요!")
        if integrity_score < 50:
            warnings_list.append("이번 주 식단 기록이 조금 부족해요!")

        return {
            "status": "success",
            "data": {
                "member_id": member_id,
                "metrics": {
                    "avg_calories": round(avg_calories, 0) if pd.notna(avg_calories) else 0,
                    "avg_protein": round(avg_protein, 1) if pd.notna(avg_protein) else 0,
                    "integrity_score": integrity_score,
                    "workout_days": workout_days
                },
                "warnings": warnings_list
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()