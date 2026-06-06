import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import pymysql
from fastapi import FastAPI

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
# 2. 권한(PRO 멤버십) 판독기 함수
# ==========================================
def is_member_trainer_pro(member_id: int, conn) -> bool:
    query = "SELECT t.plan FROM members m JOIN trainers t ON m.trainer_id = t.id WHERE m.id = %s"
    with conn.cursor() as cursor:
        cursor.execute(query, [member_id])
        result = cursor.fetchone()
    return result is not None and result[0] == 'PRO'

def is_trainer_pro(trainer_id: int, conn) -> bool:
    query = "SELECT plan FROM trainers WHERE id = %s"
    with conn.cursor() as cursor:
        cursor.execute(query, [trainer_id])
        result = cursor.fetchone()
    return result is not None and result[0] == 'PRO'

# ==========================================
# 3. FitLog 운동 습관 분석 API 엔드포인트
# ==========================================
@app.get("/api/analytics/workout-habit/{member_id}")
def get_workout_habit_analysis(member_id: int):
    conn = get_db_connection()
    try:
        # ① 월간 운동 참여율 (%)
        participation_query = """
            SELECT
                COUNT(DISTINCT log_date) AS actual_days,
                DAY(LAST_DAY(CURRENT_DATE)) AS total_days
            FROM workout_logs
            WHERE member_id = %s AND DATE_FORMAT(log_date, '%%Y-%%m') = DATE_FORMAT(CURRENT_DATE, '%%Y-%%m')
        """
        df_part = pd.read_sql_query(participation_query, conn, params=[member_id])
        monthly_workout_days = int(df_part.iloc[0]['actual_days']) if not df_part.empty else 0

        # ① 캘린더 히트맵 (최근 3개월)
        heatmap_query = """
            SELECT log_date AS workout_date, COUNT(workout_id) AS workout_count
            FROM workout_logs
            WHERE member_id = %s AND log_date >= DATE_SUB(CURRENT_DATE, INTERVAL 3 MONTH)
            GROUP BY log_date
            ORDER BY workout_date ASC
        """
        df_heatmap = pd.read_sql_query(heatmap_query, conn, params=[member_id])
        if not df_heatmap.empty:
            df_heatmap['workout_date'] = df_heatmap['workout_date'].astype(str)

        # ② 요일별 빈도 & 최다 운동 요일 TOP 2
        freq_query = """
            SELECT DAYNAME(log_date) AS day_of_week, COUNT(workout_id) AS frequency
            FROM workout_logs
            WHERE member_id = %s AND log_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
            GROUP BY day_of_week
            ORDER BY frequency DESC,
                     FIELD(day_of_week, 'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')
        """
        df_freq = pd.read_sql_query(freq_query, conn, params=[member_id])
        day_mapping = {'Monday': '월', 'Tuesday': '화', 'Wednesday': '수', 'Thursday': '목', 'Friday': '금', 'Saturday': '토', 'Sunday': '일'}

        top_2_days = []
        if not df_freq.empty:
            df_freq['day_of_week'] = df_freq['day_of_week'].map(day_mapping)

            # 최고 빈도값과 동일한 날 전부 뽑기
            max_freq = df_freq['frequency'].max()
            sorter = ['월', '화', '수', '목', '금', '토', '일']
            top_days_df = df_freq[df_freq['frequency'] == max_freq].copy()
            top_days_df['day_of_week'] = pd.Categorical(top_days_df['day_of_week'], categories=sorter, ordered=True)
            top_days_df = top_days_df.sort_values('day_of_week')
            top_2_days = top_days_df['day_of_week'].tolist()

            df_freq['day_of_week'] = pd.Categorical(df_freq['day_of_week'], categories=sorter, ordered=True)
            df_freq = df_freq.sort_values('day_of_week')

        # ③ 부위별 운동 균형 (하체 조건을 어깨보다 먼저)
        balance_query = """
            SELECT
                CASE
                    WHEN exercise_name LIKE '%%벤치%%' OR exercise_name LIKE '%%푸시업%%' OR exercise_name LIKE '%%체스트%%' OR exercise_name LIKE '%%펙덱%%' THEN '가슴'
                    WHEN exercise_name LIKE '%%풀업%%' OR exercise_name LIKE '%%로우%%' OR exercise_name LIKE '%%랫풀다운%%' OR exercise_name LIKE '%%데드리프트%%' THEN '등'
                    WHEN exercise_name LIKE '%%스쿼트%%' OR exercise_name LIKE '%%레그%%' OR exercise_name LIKE '%%런지%%' OR exercise_name LIKE '%%카프%%' THEN '하체'
                    WHEN exercise_name LIKE '%%컬%%' OR exercise_name LIKE '%%익스텐션%%' OR exercise_name LIKE '%%킥백%%' THEN '팔'
                    WHEN exercise_name LIKE '%%크런치%%' OR exercise_name LIKE '%%플랭크%%' OR exercise_name LIKE '%%레그레이즈%%' THEN '코어'
                    WHEN exercise_name LIKE '%%프레스%%' OR exercise_name LIKE '%%레이즈%%' THEN '어깨'
                    ELSE '기타'
                END AS target_body_part,
                COUNT(ws.set_id) AS part_set_count
            FROM workout_sets ws
            JOIN workout_logs wl ON ws.workout_id = wl.workout_id
            WHERE wl.member_id = %s AND wl.log_date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
            GROUP BY target_body_part HAVING target_body_part != '기타'
        """
        df_balance = pd.read_sql_query(balance_query, conn, params=[member_id])
        if not df_balance.empty:
            total_sets = df_balance['part_set_count'].sum()
            df_balance['part_percentage'] = round((df_balance['part_set_count'] / total_sets) * 100, 1)

        return {
            "status": "success",
            "data": {
                "metrics": {
                    "monthly_workout_days": monthly_workout_days,
                    "top_2_workout_days": top_2_days
                },
                "charts": {
                    "heatmap_data": df_heatmap.to_dict(orient='records') if not df_heatmap.empty else [],
                    "bar_chart_data": df_freq.to_dict(orient='records') if not df_freq.empty else [],
                    "radar_chart_data": df_balance.to_dict(orient='records') if not df_balance.empty else []
                }
            }
        }

    except Exception as e:
        return {"status": "error", "message": f"분석 중 오류 발생: {str(e)}"}
    finally:
        conn.close()
