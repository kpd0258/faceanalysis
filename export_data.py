# export_data.py

import pandas as pd
from sqlalchemy import create_engine
from database import DATABASE_URL  # database.py에서 DATABASE_URL을 export해 두셨다면
from datetime import datetime
from pathlib import Path

def main():
    # 1) DB 커넥션
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

    # 2) 각 테이블 읽어오기
    df_img  = pd.read_sql_table("images",            engine)
    df_geom = pd.read_sql_table("geometry_metrics",  engine)
    df_tex  = pd.read_sql_table("texture_metrics",   engine)
    df_col  = pd.read_sql_table("color_metrics",     engine)
    df_ctx  = pd.read_sql_table("context_metrics",   engine)

    # 3) images.id → image_id로 이름 변경
    df_img = df_img.rename(columns={"id": "image_id"})

    # 4) 서브 테이블들의 고유 PK(id) 컬럼 삭제
    df_geom = df_geom.drop(columns=["id"])
    df_tex  = df_tex.drop(columns=["id"])
    df_col  = df_col.drop(columns=["id"])
    df_ctx  = df_ctx.drop(columns=["id"])

    # 5) LEFT JOIN 방식으로 순차 병합
    df = (
        df_img
        .merge(df_geom, on="image_id", how="left")
        .merge(df_tex,  on="image_id", how="left")
        .merge(df_col,  on="image_id", how="left")
        .merge(df_ctx,  on="image_id", how="left")
    )

    # 6) 원하는 순서로 컬럼 정렬 (예시)
    cols = ["image_id", "filename", "path"] + [c for c in df.columns if c not in ("image_id", "filename", "path")]
    df = df[cols]

    # 7) 백업 디렉터리 준비 (workspace/db_backup)
    script_dir   = Path(__file__).resolve().parent
    backup_dir   = script_dir / "db_backup"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # 8) 현재 시각을 기반으로 파일명 생성 (YYYYMMDDHHMM)
    timestamp    = datetime.now().strftime("%Y%m%d%H%M")
    csv_path     = backup_dir / f"{timestamp}.csv"

    # 9) CSV 파일로 저장 (UTF-8 BOM)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    print(f"✔ '{csv_path}' 생성 완료")

    # 10) (선택) Excel 파일로도 저장하려면 아래 주석 해제
    # xlsx_path = backup_dir / f"{timestamp}.xlsx"
    # df.to_excel(xlsx_path, index=False)
    # print(f"✔ '{xlsx_path}' 생성 완료")

if __name__ == "__main__":
    main()
