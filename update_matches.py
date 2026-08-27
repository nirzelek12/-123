import os
import requests
import firebase_admin
from firebase_admin import credentials, db

# התחברות לפיירבייס
database_url = "https://hablnacos-default-rtdb.firebaseio.com"
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={
        'databaseURL': database_url
    })

def update_real_madrid_schedule():
    print("מושך את לוח המשחקים המעודכן של ריאל מדריד...")
    
    # מפתח ה-API שלך משובץ כאן
    API_KEY = "8b3c6d47ddef42e887990aad1606bc12"
    headers = { 'X-Auth-Token': API_KEY }
    
    # מזהה ריאל מדריד ב-Football-Data הוא 86
    url = "https://api.football-data.org/v4/teams/86/matches?status=SCHEDULED"
    
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        matches_list = []
        
        for m in data.get('matches', []):
            match_id = f"api_m_{m['id']}"
            competition = m['competition']['name']
            
            # זיהוי קבוצת הבית והחוץ
            home_team = m['homeTeam']['name']
            away_team = m['awayTeam']['name']
            is_home = m['homeTeam']['id'] == 86
            
            home_away = "ריאל מדריד - " + away_team if is_home else home_team + " - ריאל מדריד"
            
            utc_date = m['utcDate'] # מגיע בפורמט ISO כמו 2026-09-20T20:00:00Z
            date_part = utc_date.split("T")[0]
            time_part = utc_date.split("T")[1][:5] # שעה בפורמט HH:MM
            
            matches_list.append({
                "id": match_id,
                "match": home_away,
                "date": date_part,
                "time": time_part,
                "comp": competition
            })
        
        # שמירה ישירה לפיירבייס
        if matches_list:
            db.ref('league_data/matches').set(matches_list)
            print(f"עודכנו בהצלחה {len(matches_list)} משחקים לפיירבייס!")
    else:
        print("שגיאה במשיכת הנתונים:", response.status_code)

if __name__ == "__main__":
    update_real_madrid_schedule()
