# video_processor.py

import cv2
import numpy as np
from ultralytics import YOLO
from sklearn.cluster import KMeans
import base64
import tempfile
import os
import yt_dlp
from datetime import datetime
import logging

logger = logging.getLogger("video_processor")
logging.basicConfig(level=logging.INFO)

def extract_jersey_hsv(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        return None
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    return np.array(cv2.mean(hsv)[:3])

def get_hsv_mean(image: np.ndarray, box) -> np.ndarray:
    x1, y1, x2, y2 = map(int, box.xyxy[0])
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return np.zeros(3)
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    return np.array(cv2.mean(hsv)[:3])

def initialize_team_colors(player_boxes, frame):
    hsv_vals = [get_hsv_mean(frame, b) for b in player_boxes]
    km = KMeans(n_clusters=2, random_state=0).fit(hsv_vals)
    c1, c2 = km.cluster_centers_
    # Saturation küçük olana A deyip sırala
    return (c1, c2) if c1[1] < c2[1] else (c2, c1)

def classify_player(hsv, team_a_color, team_b_color, name_a, name_b):
    if team_a_color is None or team_b_color is None:
        return "Unknown"
    da = np.linalg.norm(hsv - team_a_color)
    db = np.linalg.norm(hsv - team_b_color)
    return name_a if da < db else name_b

def process_video(
    video_source: str,
    team_a_color, team_b_color,
    team_a_name, team_b_name,
    main_ref_name, side_ref_name,
    class_thresholds: dict,
    max_samples=5, sample_rate=30
):
    """
    - video_source: video dosya yolu veya YouTube URL’i
    - team_* ve ref_* adları, renkleri
    - class_thresholds: {'player':0.6, 'ball':0.5, 'main referee':0.5, 'side referee':0.5, ...}
    """

    logger.info(f"process_video çağrıldı: source={video_source}")
    # 1) YouTube URL ise indir
    temp_path = video_source
    if video_source.startswith("http"):
        temp_path = os.path.join(tempfile.gettempdir(),
                                 f"match_{int(datetime.now().timestamp())}.mp4")
        ydl_opts = {
            'quiet': True,
            'format': 'bestvideo[ext=mp4]',
            'outtmpl': temp_path
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_source])

    cap = cv2.VideoCapture(temp_path)
    model = YOLO(os.path.join(os.getcwd(), "model", "bestdeneme.pt"))
    class_names = [n.lower() for n in model.names.values()]

    annotated_frames = []
    frame_count = 0
    samples = 0

    while cap.isOpened() and samples < max_samples:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % sample_rate == 0:
            res = model(frame)[0]
            boxes = res.boxes

            # 1) Oyuncu kutuları
            player_boxes = [b for b in boxes 
                            if class_names[int(b.cls[0])] == "player"]

            # 2) İlk oyuncu kutularında renk init
            if team_a_color is None and len(player_boxes) >= 14:
                team_a_color, team_b_color = initialize_team_colors(player_boxes, frame)
                logger.info("Takım renkleri otomatik belirlendi")

            # 3) Başlıklar için en iyi (en yüksek confid.) tek kutu
            top_ball = top_main = top_side = None

            # 4) Tüm kutuları etiketle
            annotated = frame.copy()
            for b in boxes:
                cls = int(b.cls[0])
                name_raw = class_names[cls]
                conf = float(b.conf[0])
                if conf < class_thresholds.get(name_raw, 0.5):
                    continue

                x1, y1, x2, y2 = map(int, b.xyxy[0])
                if name_raw == "player":
                    hsv = get_hsv_mean(frame, b)
                    team = classify_player(hsv, team_a_color, team_b_color, team_a_name, team_b_name)
                    color = (0,255,0) if team == team_a_name else (0,140,255)
                    label = team
                elif name_raw == "ball":
                    if not top_ball or conf > top_ball["conf"]:
                        top_ball = {"box":b, "conf":conf}
                    continue
                elif name_raw == "main referee":
                    if not top_main or conf > top_main["conf"]:
                        top_main = {"box":b, "conf":conf}
                    continue
                elif name_raw == "side referee":
                    if not top_side or conf > top_side["conf"]:
                        top_side = {"box":b, "conf":conf}
                    continue
                else:
                    color = (255,255,255)
                    label = name_raw.title()

                cv2.rectangle(annotated, (x1,y1), (x2,y2), color, 2)
                cv2.putText(annotated, label, (x1,y1-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

            # 5) Top ve hakemleri de çiz
            for ref, ref_name, ref_color_key in [
                (top_ball,    "Ball",           (0,0,255)),
                (top_main,    main_ref_name,    (255,255,0)),
                (top_side,    side_ref_name,    (255,0,0))
            ]:
                if ref:
                    b = ref["box"]
                    x1, y1, x2, y2 = map(int, b.xyxy[0])
                    cv2.rectangle(annotated, (x1,y1), (x2,y2), ref_color_key, 2)
                    cv2.putText(annotated, ref_name, (x1,y1-10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, ref_color_key, 2)

            # 6) Frame’i base64 olarak kaydet
            _, buf = cv2.imencode('.jpg', annotated)
            annotated_frames.append(base64.b64encode(buf).decode('utf-8'))
            samples += 1

        frame_count += 1

    cap.release()
    logger.info(f"process_video bitti: {samples} frame döndü")
    return annotated_frames
