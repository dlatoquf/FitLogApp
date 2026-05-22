import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import pymysql
from fastapi import FastAPI, HTTPException

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
# 2. 트레이너 PRO 권한 체크
# ==========================================
def is_trainer_pro(trainer_id: int, conn) -> bool:
    query = "SELECT plan FROM trainers WHERE id = %s"
    with conn.cursor() as cursor:
        cursor.execute(query, [trainer_id])
        result = cursor.fetchone()
    return result is not None and result[0] == 'PRO'

# ==========================================
# 3. 회원 분석 API (자기주도 비율 & 식단 반영률)
# ==========================================
@app.get("/api/trainer/member-analysis/{trainer_id}/{member_id}")
def get_member_analysis(trainer_id: int, member_id: int):
    conn = get_db_connection()
    try:
        # 1. PRO 트레이너 권한 체크
        if not is_trainer_pro(trainer_id, conn):
            raise HTTPException(status_code=403, detail="PRO 트레이너만 사용 가능한 기능입니다.")

        # 2. 자기주도 운동 비율 분석
        workout_query = "SELECT workout_type, COUNT(*) as cnt FROM workout_logs WHERE member_id = %s GROUP BY workout_type"
        df_workout = pd.read_sql_query(workout_query, conn, params=[member_id])
        
        total = df_workout['cnt'].sum() if not df_workout.empty else 0
        personal_cnt = df_workout[df_workout['workout_type'] == 'PERSONAL']['cnt'].sum() if 'PERSONAL' in df_workout['workout_type'].values else 0
        self_ratio = round((personal_cnt / total * 100), 1) if total > 0 else 0

        # 3. 식단 피드백 반영률 분석
        feedback_query = "SELECT target_date FROM diet_feedbacks WHERE member_id = %s ORDER BY target_date DESC LIMIT 1"
        df_feedback = pd.read_sql_query(feedback_query, conn, params=[member_id])
        
        avg_calories = 0
        if not df_feedback.empty:
            last_date = df_feedback['target_date'][0]
            diet_query = "SELECT AVG(calories) as avg_cal FROM diet_logs WHERE member_id = %s AND date >= %s"
            df_diet = pd.read_sql_query(diet_query, conn, params=[member_id, last_date])
            avg_calories = round(df_diet['avg_cal'][0], 1) if not df_diet.empty and pd.notna(df_diet['avg_cal'][0]) else 0

        # 4. 결과 반환
        return {
            "status": "success",
            "data": {
                "member_id": member_id,
                "metrics": {
                    "self_workout_ratio": self_ratio,
                    "avg_calories_after_feedback": avg_calories
                },
                "strategy": "자기주도형" if self_ratio > 50 else "밀착관리형"
            }
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()