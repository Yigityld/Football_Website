import multiprocessing
import cv2
import numpy as np
# from ultralytics import YOLO  # type: ignore  # <-- KALDIRILDI
from sklearn.cluster import KMeans  # type: ignore
import yt_dlp  # type: ignore
import os
import base64
from fastapi import FastAPI, HTTPException, UploadFile, File, Form  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
import tempfile
import threading
from typing import Optional, Any, Dict
import requests
from bs4.element import Tag  # type: ignore
from datetime import datetime
import traceback
from fastapi.concurrency import run_in_threadpool

# İçerik Getirici Fonksiyonlar GPT Alanı için
from gpt_area import (
    get_team_last_5_matches_with_tactics,
    get_last_matches,
    prepare_the_prompt,
    sor_hf,
    predict_match,
    analyze_team_performance,
    analyze_referee_stats
)  # type: ignore

# Takım ve hakem bilgileri için (alias to avoid naming conflict)
from team_info import (
    get_team_info as fetch_team_info,
    get_referee_info,
    get_image_as_base64
)

app = FastAPI(title="Futbol Analiz API")  # type: ignore

# CORS ayarları - tüm origin'lere izin ver (production için güvenli değil ama test için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tüm origin'lere izin ver
    allow_credentials=False,  # allow_origins=["*"] ile birlikte False olmalı
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global değişkenler
team_a_color = None
team_b_color = None
analysis_running = False
analysis_thread: Optional[threading.Thread] = None
analysis_results: Optional[Dict[str, Any]] = None

# Renk çıkarım fonksiyonları

def extract_jersey_hsv(path: str) -> Optional[np.ndarray]:
    img = cv2.imread(path)
    if img is None:
        print(f"Forma dosyası okunamadı: {path}")
        return None
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return np.array(cv2.mean(hsv)[:3])


def get_hsv_mean(image: np.ndarray, box) -> np.ndarray:
    x1, y1, x2, y2 = map(int, box.xyxy[0])
    cropped = image[y1:y2, x1:x2]
    if cropped.size == 0:
        return np.array([0, 0, 0])
    hsv_image = cv2.cvtColor(cropped, cv2.COLOR_BGR2HSV)
    return np.array(cv2.mean(hsv_image)[:3])


def initialize_team_colors(player_boxes, frame: np.ndarray):
    hsv_values = []
    for box in player_boxes:
        hsv_mean = get_hsv_mean(frame, box)
        if hsv_mean is not None and hsv_mean.any():
            hsv_values.append(hsv_mean)
    if len(hsv_values) < 2:
        return None, None
    kmeans = KMeans(n_clusters=2, random_state=0).fit(hsv_values)
    colors = kmeans.cluster_centers_
    return (colors[0], colors[1]) if colors[0][1] < colors[1][1] else (colors[1], colors[0])


def classify_player(hsv_value: np.ndarray, team_a_color: np.ndarray, team_b_color: np.ndarray,
                    team_a_name: str, team_b_name: str) -> str:
    if team_a_color is None or team_b_color is None:
        return "Unknown"
    da = np.linalg.norm(hsv_value - team_a_color)
    db = np.linalg.norm(hsv_value - team_b_color)
    return team_a_name if da < db else team_b_name

# Video ve analiz fonksiyonu

def main_analysis(
    team_a: str,
    team_b: str,
    main_ref: Optional[str],
    side_ref: Optional[str],
    team_a_jersey_path: Optional[str] = None,
    team_b_jersey_path: Optional[str] = None,
    youtube_url: Optional[str] = None
) -> Dict[str, Any]:
    global team_a_color, team_b_color
    try:
        team_a_info = fetch_team_info(team_a)
        team_b_info = fetch_team_info(team_b)
        main_ref_info, main_ref_img = get_referee_info(main_ref) if main_ref else ("", None)
        side_ref_info, side_ref_img = get_referee_info(side_ref) if side_ref else ("", None)
        team_a_matches, team_a_wins, team_a_draws, team_a_losses, team_a_performance = get_team_last_5_matches_with_tactics(team_a)
        team_b_matches, team_b_wins, team_b_draws, team_b_losses, team_b_performance = get_team_last_5_matches_with_tactics(team_b)
        head_to_head_matches = get_last_matches(team_a, team_b)
        logo_url_a = team_a_info.get("Logo URL")
        team_a_logo = get_image_as_base64(logo_url_a) if isinstance(logo_url_a, str) else None
        logo_url_b = team_b_info.get("Logo URL")
        team_b_logo = get_image_as_base64(logo_url_b) if isinstance(logo_url_b, str) else None
        main_ref_photo = get_image_as_base64(main_ref_img) if main_ref_img else None
        side_ref_photo = get_image_as_base64(side_ref_img) if side_ref_img else None
        main_ref_analysis = analyze_referee_stats(main_ref_info) if main_ref_info else None
        side_ref_analysis = analyze_referee_stats(side_ref_info) if side_ref_info else None
        summary_data = {
            "teams": {
                "team_a": {
                    "name": team_a,
                    "info": team_a_info,
                    "logo": team_a_logo,
                    "last_matches": team_a_matches,
                    "stats": {"wins": team_a_wins, "draws": team_a_draws, "losses": team_a_losses},
                    "performance_analysis": team_a_performance
                },
                "team_b": {
                    "name": team_b,
                    "info": team_b_info,
                    "logo": team_b_logo,
                    "last_matches": team_b_matches,
                    "stats": {"wins": team_b_wins, "draws": team_b_draws, "losses": team_b_losses},
                    "performance_analysis": team_b_performance
                }
            },
            "referees": {
                "main": {"name": main_ref, "info": main_ref_info, "photo": main_ref_photo, "referee_analysis": main_ref_analysis} if main_ref else None,
                "side": {"name": side_ref, "info": side_ref_info, "photo": side_ref_photo, "referee_analysis": side_ref_analysis} if side_ref else None
            },
            "head_to_head": head_to_head_matches
        }
        return summary_data
    except Exception as e:
        traceback.print_exc()
        raise



@app.on_event("startup")
async def startup_event() -> None:
    pass


@app.get("/")
async def root() -> Dict[str, str]:
    return {"message": "API çalışıyor", "status": "ok"}

@app.get("/test")
async def test() -> Dict[str, str]:
    return {"message": "Test endpoint çalışıyor", "cors": "enabled"}

@app.get("/test-fetch")
async def test_fetch():
    import requests
    try:
        r = requests.get("https://www.transfermarkt.com.tr", timeout=30)
        return {"status": r.status_code}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/start-analysis")
async def start_analysis(
    team_a: str = Form(...),
    team_b: str = Form(...),
    main_ref: Optional[str] = Form(None),
    side_ref: Optional[str] = Form(None),
    youtube_url: Optional[str] = Form(None),
    team_a_jersey: Optional[UploadFile] = File(None),
    team_b_jersey: Optional[UploadFile] = File(None)
) -> Dict[str, str]:
    global analysis_running, analysis_thread, analysis_results
    if analysis_running:
        raise HTTPException(status_code=400, detail="Analiz zaten çalışıyor")
    tmp = tempfile.gettempdir()
    ta_path = tb_path = None
    if team_a_jersey:
        filename_a: str = str(team_a_jersey.filename)
        ta_path = os.path.join(tmp, filename_a)
        with open(ta_path, 'wb') as f:
            f.write(await team_a_jersey.read())
    if team_b_jersey:
        filename_b: str = str(team_b_jersey.filename)
        tb_path = os.path.join(tmp, filename_b)
        with open(tb_path, 'wb') as f:
            f.write(await team_b_jersey.read())
    analysis_running = True
    analysis_results = None

    def run():
        global analysis_results, analysis_running
        try:
            analysis_results = main_analysis(team_a, team_b, main_ref, side_ref, ta_path, tb_path, youtube_url)
        except Exception as e:
            traceback.print_exc()
        finally:
            analysis_running = False

    analysis_thread = threading.Thread(target=run, daemon=True)
    analysis_thread.start()
    return {"status": "started"}

@app.get("/analysis-status")
async def analysis_status() -> Any:
    if analysis_thread and analysis_thread.is_alive():
        return {"status": "running"}
    if analysis_results is not None:
        return {"status": "completed", "results": analysis_results}
    return {"status": "idle"}

@app.post("/predict-match")
async def predict_match_endpoint(team_a: str = Form(...), team_b: str = Form(...)) -> Dict[str, str]:
    prediction = await run_in_threadpool(predict_match, team_a, team_b)
    return {"prediction": prediction}

@app.get("/team-info/{team_name}")
async def team_info_endpoint(team_name: str) -> Any:
    maclar, w, d, l, performance = get_team_last_5_matches_with_tactics(team_name)
    return {"team_name": team_name, "last_5": maclar, "stats": {"w": w, "d": d, "l": l}}

if __name__ == "__main__":
    import uvicorn  # type: ignore

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")