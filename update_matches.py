import os
import requests
import firebase_admin
from firebase_admin import credentials, db
from datetime import datetime, timedelta

# התחברות לפיירבייס
database_url = "https://hablnacos-default-rtdb.firebaseio.com"
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={
        'databaseURL': database_url
    })

# מיפוי שמות מפעלים מאנגלית לעברית
COMPETITION_MAPPING = {
    "Primera Division": "ליגה",
    "UEFA Champions League": "ליגת האלופות",
    "Copa del Rey": "גביע המלך",
    "Supercopa de España": "סופר קופה ספרדי",
    "UEFA Super Cup": "סופר קופה אירופי"
}

def parse_utc_to_israel_time(utc_str):
    """ממיר מחרוזת UTC לזמן ישראל (כולל התאמה בסיסית לשעון קיץ/חורף)"""
    # UTC string format: 2026-09-20T20:00:00Z
    dt_utc = datetime.strptime(utc_str.replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
    
    # בדיקה פשוטה האם מדובר בחודשי שעון קיץ בישראל (מרץ עד אוקטובר בקירוב)
    is_dst = 3 <= dt_utc.month <= 10
    offset_hours = 3 if is_dst else 2
    
    dt_il = dt_utc + timedelta(hours=offset_hours)
    return dt_il.strftime("%Y-%m-%d"), dt_il.strftime("%H:%M")

def update_real_madrid_schedule():
    print("מושך את לוח המשחקים המעודכן של ריאל מדריד...")
    
    API_KEY = "8b3c6d47ddef42e887990aad1606bc12"
    headers = { 'X-Auth-Token': API_KEY }
    url = "https://api.football-data.org/v4/teams/86/matches?status=SCHEDULED"
    
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        
        # שליפת המשחקים הקיימים מהפיירבייס כדי לא לאבד נתונים
        existing_matches_ref = db.ref('league_data/matches')
        existing_matches = existing_matches_ref.get() or []
        
        # המרת הרשימה הקיימת למילון לפי ID לנוחות עדכון
        matches_dict = {m['id']: m for m in existing_matches if isinstance(m, dict) and 'id' in m}
        
        new_matches_count = 0
        for m in data.get('matches', []):
            match_id = f"api_m_{m['id']}"
            eng_competition = m['competition']['name']
            competition = COMPETITION_MAPPING.get(eng_competition, eng_competition)
            
            home_team = m['homeTeam']['name']
            away_team = m['awayTeam']['name']
            is_home = m['homeTeam']['id'] == 86
            
            home_away = "ריאל מדריד - " + away_team if is_home else home_team + " - ריאל מדריד"
            
            date_part, time_part = parse_utc_to_israel_time(m['utcDate'])
            
            match_data = {
                "id": match_id,
                "match": home_away,
                "date": date_part,
                "time": time_part,
                "comp": competition
            }
            
            # אם המשחק כבר קיים, נעדכן תאריך/שעה/מסגרת במידת הצורך מבלי לגעת בדברים אחרים
            if match_id in matches_dict:
                matches_dict[match_id].update(match_data)
            else:
                matches_dict[match_id] = match_data
                new_matches_count += 1
        
        # המרה חזרה למערך שמסודר לפי תאריך
        updated_matches_list = list(matches_dict.values())
        updated_matches_list.sort(key=lambda x: (x.get('date', ''), x.get('time', '')))
        
        # שמירה מעודכנת בלי לדרוס אזורים אחרים כמו predictions
        existing_matches_ref.set(updated_matches_list)
        print(f"העדכון הושלם! נוספו {new_matches_count} משחקים חדשים, סך הכל במערכת: {len(updated_matches_list)} משחקים.")
    else:
        print("שגיאה במשיכת הנתונים:", response.status_code)

if __name__ == "__main__":
    update_real_madrid_schedule()
