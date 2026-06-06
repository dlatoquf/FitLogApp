#주간분석
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import pymysql
from fastapi import FastAPI, HTTPException
from datetime import datetime, timedelta

app = FastAPI()

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

def is_trainer_pro(trainer_id: int, conn) -> bool:
    query = "SELECT plan FROM trainers WHERE id = %s"
    with conn.cursor() as cursor:
        cursor.execute(query, [trainer_id])
        result = cursor.fetchone()
    return result is not None and result[0] == 'PRO'

@app.get("/api/trainer/member-management/{trainer_id}/{member_id}")
def get_member_management(trainer_id: int, member_id: int):
    conn = get_db_connection()
    try:
        if not is_trainer_pro(trainer_id, conn):
            raise HTTPException(status_code=403, detail="PRO 트레이너만 사용 가능한 기능입니다.")

        # ==========================================
        # 💡 [성능 최적화] 파이썬에서 이번 주 월요일 날짜 구하기
        # ==========================================
        today = datetime.now()
        monday_date = (today - timedelta(days=today.weekday())).strftime('%Y-%m-%d')

        # 1. 이번 주 운동 기록 일수 (월~일 기준)
        weekly_workout_query = """
            SELECT
                COUNT(DISTINCT log_date) as total_workout_days,
                COUNT(DISTINCT CASE WHEN workout_type = 'PT' THEN log_date END) as pt_days,
                COUNT(DISTINCT CASE WHEN workout_type = 'PERSONAL' THEN log_date END) as personal_days
            FROM workout_logs
            WHERE member_id = %s AND log_date >= %s
        """
        df_w_days = pd.read_sql_query(weekly_workout_query, conn, params=[member_id, monday_date])

        total_workout_days = int(df_w_days.iloc[0]['total_workout_days']) if not df_w_days.empty else 0
        pt_days = int(df_w_days.iloc[0]['pt_days']) if not df_w_days.empty else 0
        personal_days = int(df_w_days.iloc[0]['personal_days']) if not df_w_days.empty else 0

        # 1-2. 이번 주 식단 기록 일수
        diet_query = """
            SELECT COUNT(DISTINCT date) as diet_days
            FROM diet_logs
            WHERE member_id = %s AND date >= %s
        """
        df_diet = pd.read_sql_query(diet_query, conn, params=[member_id, monday_date])
        diet_days = int(df_diet.iloc[0]['diet_days']) if not df_diet.empty else 0

        # ==========================================
        # 2. 자기주도 운동 비율 (이번 주 기준)
        # ==========================================
        workout_ratio_query = """
            SELECT workout_type, COUNT(*) as cnt 
            FROM workout_logs 
            WHERE member_id = %s AND log_date >= %s 
            GROUP BY workout_type
        """
        df_workout = pd.read_sql_query(workout_ratio_query, conn, params=[member_id, monday_date])

        total = df_workout['cnt'].sum() if not df_workout.empty else 0
        personal_cnt = df_workout[df_workout['workout_type'] == 'PERSONAL']['cnt'].sum() if not df_workout.empty and 'PERSONAL' in df_workout['workout_type'].values else 0
        self_ratio = round((personal_cnt / total * 100), 1) if total > 0 else 0

        return {
            "status": "success",
            "data": {
                "member_id": member_id,
                "weekly": {
                    "total_workout_days": total_workout_days,
                    "pt_days": pt_days,
                    "personal_days": personal_days,
                    "diet_days": diet_days
                },
                "metrics": {
                    "self_workout_ratio": self_ratio
                },
                "strategy": "자기주도형" if self_ratio > 50 else "밀착관리형"
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": f"오류 발생: {str(e)}"}
    finally:
        conn.close()