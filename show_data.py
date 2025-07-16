# show_data.py
import sqlite3, json

conn = sqlite3.connect("analysis.db")
cur  = conn.cursor()

# ① images 테이블
cur.execute("SELECT id, path, filename FROM images;")
images = cur.fetchall()

# ② geometry_metrics 테이블
cur.execute("SELECT * FROM geometry_metrics;")
geom = cur.fetchall()

print("=== images ===")
print(json.dumps(images, ensure_ascii=False, indent=2))
print("\n=== geometry_metrics ===")
print(json.dumps(geom, ensure_ascii=False, indent=2))

conn.close()
