import sqlite3

def run():
    # 1. Add column to user_library
    with sqlite3.connect("user_library.db") as conn:
        try:
            conn.execute("ALTER TABLE user_library ADD COLUMN anime_title TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass # Already exists
            
    # 2. Backfill existing records
    with sqlite3.connect("user_library.db") as u_conn:
        with sqlite3.connect("anime_data.db") as a_conn:
            u_cursor = u_conn.cursor()
            a_cursor = a_conn.cursor()
            
            u_cursor.execute("SELECT mal_id FROM user_library")
            for row in u_cursor.fetchall():
                mal_id = row[0]
                a_cursor.execute("SELECT title_english, title FROM anime WHERE mal_id = ?", (mal_id,))
                a_row = a_cursor.fetchone()
                if a_row:
                    title = a_row[0] or a_row[1]
                    u_cursor.execute("UPDATE user_library SET anime_title = ? WHERE mal_id = ?", (title, mal_id))
        
        u_conn.commit()

run()
print("Migration completed.")
