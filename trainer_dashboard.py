import pandas as pd
import pymysql
from fastapi import FastAPI, HTTPException
from datetime import datetime

app = FastAPI()

# DB 연결 정보 (기존과 동일)
def get_db_connection():
    return pymysql.connect(
        host="switchyard.proxy.rlwy.net",
        user="root",
        password="AUjyFJnHTFFlZHmOyPLIoZiKWqTzhSYO",
        database="railway",
        port=48785
    )

def is_trainer_pro(trainer_id: int, conn) -> bool:
    query = "SELECT plan FROM trainers WHERE id = %s"
    with conn.cursor() as cursor:
        cursor.execute(query, [trainer_id])
        result = cursor.fetchone()
    return result is not None and result[0] == 'PRO'

@app.get("/api/trainer/dashboard/{trainer_id}")
def get_trainer_dashboard(trainer_id: int):
    conn = get_db_connection()
    try:
        if not is_trainer_pro(trainer_id, conn):
            raise HTTPException(status_code=403, detail="PRO 트레이너만 사용 가능합니다.")

        # 1. 수업 진행률 (보내주신 쿼리 활용)
        class_query = """
            SELECT 
                COUNT(*) as total_classes,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_classes
            FROM schedules 
            WHERE trainer_id = %s 
            AND YEARWEEK(date, 1) = YEARWEEK(CURDATE(), 1)
        """
        df_class = pd.read_sql_query(class_query, conn, params=[trainer_id])
        
        total = int(df_class['total_classes'][0]) if not df_class.empty else 0
        completed = int(df_class['completed_classes'][0]) if not df_class.empty else 0
        attendance_rate = round((completed / total * 100), 1) if total > 0 else 0

        # 2. 담당 회원 평균 앱 기록률 (운동 & 식단)
        member_record_query = """
            SELECT m.id as member_id,
                   COUNT(DISTINCT w.log_date) as workout_days,
                   COUNT(DISTINCT d.date) as diet_days
            FROM members m
            LEFT JOIN workout_logs w ON m.id = w.member_id AND w.log_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            LEFT JOIN diet_logs d ON m.id = d.member_id AND d.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            WHERE m.trainer_id = %s
            GROUP BY m.id
        """
        df_records = pd.read_sql_query(member_record_query, conn, params=[trainer_id])
        
        workout_avg = round((df_records['workout_days'] / 7).mean() * 100, 1) if not df_records.empty else 0
        diet_avg = round((df_records['diet_days'] / 7).mean() * 100, 1) if not df_records.empty else 0

        return {
            "status": "success",
            "data": {
                "class_progress": {
                    "total": total,
                    "completed": completed,
                    "attendance_rate": attendance_rate
                },
                "member_engagement": {
                    "avg_workout_record_rate": workout_avg,
                    "avg_diet_record_rate": diet_avg
                }
            }
        }
    finally:
        conn.close()