#트레이너홈
import pandas as pd
import pymysql
from fastapi import FastAPI, HTTPException

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

@app.get("/api/trainer/dashboard/{trainer_id}")
def get_trainer_dashboard(trainer_id: int):
    conn = get_db_connection()
    try:
        if not is_trainer_pro(trainer_id, conn):
            raise HTTPException(status_code=403, detail="PRO 트레이너만 사용 가능합니다.")

        # 1. 이번 주 수업 진행률 (CONFIRMED + COMPLETED인 실제 수업만)
        class_query = """
            SELECT
                COUNT(CASE WHEN status IN ('CONFIRMED', 'COMPLETED') THEN 1 END) as total_classes,
                COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_classes
            FROM schedules
            WHERE trainer_id = %s
            AND YEARWEEK(date, 1) = YEARWEEK(CURDATE(), 1)
        """
        df_class = pd.read_sql_query(class_query, conn, params=[trainer_id])

        total = int(df_class.iloc[0]['total_classes']) if not df_class.empty else 0
        completed = int(df_class.iloc[0]['completed_classes']) if not df_class.empty else 0
        attendance_rate = round((completed / total * 100), 1) if total > 0 else 0

        # 2. 담당 회원 이번 주 (월~일) 앱 기록률
        member_record_query = """
            SELECT m.id as member_id,
                   COUNT(DISTINCT w.log_date) as workout_days,
                   COUNT(DISTINCT d.date) as diet_days
            FROM members m
            LEFT JOIN workout_logs w ON m.id = w.member_id
                AND YEARWEEK(w.log_date, 1) = YEARWEEK(CURDATE(), 1)
            LEFT JOIN diet_logs d ON m.id = d.member_id
                AND YEARWEEK(d.date, 1) = YEARWEEK(CURDATE(), 1)
            WHERE m.trainer_id = %s
            GROUP BY m.id
        """
        df_records = pd.read_sql_query(member_record_query, conn, params=[trainer_id])

        # 이번 주 월요일부터 오늘까지 경과 일수 (1~7)
        import datetime
        today_dow = datetime.date.today().weekday()  # 0=월, 6=일
        days_elapsed = today_dow + 1  # 월=1, 화=2, ..., 일=7

        workout_avg = round((df_records['workout_days'] / days_elapsed).mean() * 100, 1) if not df_records.empty else 0
        diet_avg = round((df_records['diet_days'] / days_elapsed).mean() * 100, 1) if not df_records.empty else 0

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
    except HTTPException:
        raise
    except Exception as e:
        return {"status": "error", "message": f"오류 발생: {str(e)}"}
    finally:
        conn.close()
