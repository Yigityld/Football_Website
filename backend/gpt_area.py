import requests
from bs4 import BeautifulSoup
from bs4.element import Tag
import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import time
import os

# Hugging Face Space Gradio API endpointi
HF_SPACE_API_URL = "https://husodu73-my-ollama-space.hf.space/predict"

# Ortam değişkeninden Hugging Face token’ını al
HF_TOKEN = os.getenv("HF_TOKEN")
# Sadece Space API kullanılacak, model adı ve endpoint güncel
MODEL = "openai-community/gpt2"
HF_SPACE_HEADERS = {
    "Authorization": f"Bearer {HF_TOKEN}",
    "Content-Type": "application/json"
}


if not HF_TOKEN:
    # Ortam değişkeni olarak bulunamazsa, Secret Files yolunu dene
    secret_file_path = "/etc/secrets/HF_TOKEN"
    if os.path.exists(secret_file_path):
        try:
            with open(secret_file_path, 'r') as f:
                HF_TOKEN = f.read().strip() # Dosyanın içeriğini oku ve boşlukları temizle
            print("HF_TOKEN başarıyla Secret Files dosyasından okundu.")
        except Exception as e:
            raise RuntimeError(f"HF_TOKEN Secret Files dosyasından okunurken bir hata oluştu: {e}")
    else:
        # Ne ortam değişkeninde ne de Secret Files yolunda bulunamadı
        raise RuntimeError("HF_TOKEN tanımlı değil. Lütfen ortam değişkeni olarak ekleyin veya Secret Files olarak doğru şekilde yüklediğinizden emin olun.")

# Artık HF_TOKEN'i kullanabilirsiniz
print(f"Kullanılan HF_TOKEN: {'*' * len(HF_TOKEN) if HF_TOKEN else 'Yok'}") # Güvenlik için token'ın kendisini yazdırma


# Eski MODEL ve API_URL tanımlarını kaldırdım
# HF_TOKEN = os.getenv("HF_TOKEN")
# MODEL = "mistralai/Mistral-7B-Instruct-v0.2"
# API_URL = f"https://api-inference.huggingface.co/models/{MODEL}"
# HF_SPACE_HEADERS = {
#     "Authorization": f"Bearer {HF_TOKEN}",
#     "Content-Type": "application/json"
# }

# --- Takım URL ve ID çekme fonksiyonları ---
def safe_get(url, headers=None, timeout=30, retries=3, wait=2):
    print(f"[LOG] safe_get: url={url}, headers={headers}, timeout={timeout}")
    for attempt in range(retries):
        try:
            return requests.get(url, headers=headers, timeout=timeout)
        except requests.exceptions.Timeout:
            print(f"[WARN] Timeout, retrying {attempt+1}/{retries}... {url}")
            time.sleep(wait)
        except Exception as e:
            print(f"[ERROR] safe_get error: {e} {url}")
            break
    print(f"[ERROR] safe_get: All retries failed for {url}")
    return None


def search_team_url(team_name: str) -> Optional[str]:
    print(f"[LOG] search_team_url: team_name={team_name}")
    query = team_name.replace(" ", "+")
    search_url = f"https://www.transfermarkt.com.tr/schnellsuche/ergebnis/schnellsuche?query={query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    response = safe_get(search_url, headers=headers, timeout=30)
    if response is None or response.status_code != 200:
        print(f"[ERROR] search_team_url: No response or bad status for {search_url}")
        return None
    soup = BeautifulSoup(response.text, "html.parser")
    results = [r for r in soup.select("a[href*='/startseite/verein/']") if isinstance(r, Tag)]
    for a in results:
        text = a.get_text(strip=True).lower()
        if team_name.lower() in text:
            href = a.get("href")
            if isinstance(href, str):
                print(f"[LOG] search_team_url: Found url={href}")
                return f"https://www.transfermarkt.com.tr{href}"
    print(f"[ERROR] search_team_url: No matching result for {team_name}")
    return None


def get_team_id_from_url(team_url: str) -> Optional[str]:
    print(f"[LOG] get_team_id_from_url: team_url={team_url}")
    if not team_url:
        print(f"[ERROR] get_team_id_from_url: team_url is None")
        return None
    match = re.search(r"/verein/(\d+)", team_url)
    if match:
        print(f"[LOG] get_team_id_from_url: team_id={match.group(1)}")
    else:
        print(f"[ERROR] get_team_id_from_url: No match")
    return match.group(1) if match else None


def find_team_id(team_name: str) -> Optional[str]:
    url = search_team_url(team_name)
    return get_team_id_from_url(url) if url else None


def temizle_takim_adi(adi: str) -> str:
    return re.sub(r"\(.*?\)", "", adi).strip().lower()


def get_match_result_emoji(team_score: int, opponent_score: int) -> str:
    if team_score > opponent_score:
        return "✅"
    if team_score == opponent_score:
        return "🤝"
    return "❌"


def team_name_Temizle(team_name: str) -> str:
    name = team_name.lower().strip()
    name = re.sub(r'\bfc\b', '', name)
    return name.strip()

def analyze_team_performance(matches):
    # 2.5 üst, handikap, karşılıklı gol, galibiyet analizleri
    over_2_5_count = 0
    all_win = True
    handicap_win_count = 0
    both_teams_scored_count = 0
    for m in matches:
        try:
            parts = (m.get('sonuc') or '').split(':')
            g1, g2 = int(parts[0]), int(parts[1])
            if g1 + g2 > 2:
                over_2_5_count += 1
            if g1 - g2 > 1:
                handicap_win_count += 1
            if g1 == g2 or g1 == 0 or g2 == 0:
                pass
            else:
                both_teams_scored_count += 1
            if m.get('emoji') != '✅':
                all_win = False
        except:
            all_win = False
    return {
        'over_2_5_count': over_2_5_count,
        'all_win': all_win,
        'handicap_win_count': handicap_win_count,
        'both_teams_scored_count': both_teams_scored_count
    }

def analyze_referee_stats(ref_info_html):
    import re
    stats = {'avg_yellow': '-', 'avg_penalty': '-', 'avg_red': '-'}
    if not ref_info_html:
        return stats
    try:
        mac_match = re.search(r'Maç: (\d+)', ref_info_html)
        sari_match = re.search(r'Sarı Kart: (\d+)', ref_info_html)
        iki_sari_match = re.search(r'2\. Sarıdan Kırmızı: (\d+)', ref_info_html)
        direkt_kirmizi_match = re.search(r'Direkt Kırmızı: (\d+)', ref_info_html)
        pen_match = re.search(r'Penaltı: (\d+)', ref_info_html)
        if not (mac_match and sari_match and iki_sari_match and direkt_kirmizi_match and pen_match):
            return stats
        mac = int(mac_match.group(1))
        sari = int(sari_match.group(1))
        iki_sari = int(iki_sari_match.group(1))
        direkt_kirmizi = int(direkt_kirmizi_match.group(1))
        pen = int(pen_match.group(1))
        stats['avg_yellow'] = str(round(sari / mac, 2)) if mac else '-'
        stats['avg_penalty'] = str(round(pen / mac, 2)) if mac else '-'
        stats['avg_red'] = str(round((iki_sari + direkt_kirmizi) / mac, 2)) if mac else '-'
    except:
        pass
    return stats

# --- Takımın son 5 maçını (diziliş + skor) getir ---
def get_team_last_5_matches_with_tactics(team_name: str) -> Tuple[List[Dict], int, int, int, dict]:
    print(f"[LOG] get_team_last_5_matches_with_tactics: team_name={team_name}")
    def fetch_matches(url: str) -> List[Dict]:
        print(f"[DEBUG] fetch_matches çağrıldı: {url}")
        try:
            r = safe_get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
            if r is None:
                print(f"[DEBUG] fetch_matches başarısız! (timeout/retry)")
                return []
            print(f"[DEBUG] fetch_matches status: {r.status_code}")
            if r.status_code != 200:
                print(f"[DEBUG] fetch_matches başarısız!")
                return []
            s = BeautifulSoup(r.text, "html.parser")
            div = s.find("div", class_="responsive-table")
            if not isinstance(div, Tag):
                print(f"[DEBUG] fetch_matches responsive-table yok!")
                return []
            body = div.find("tbody")
            if not isinstance(body, Tag):
                print(f"[DEBUG] fetch_matches tbody yok!")
                return []
            out = []
            toplam_gol = 0
            for row in body.find_all("tr") if isinstance(body, Tag) else []:
                cols = row.find_all("td") if isinstance(row, Tag) else []
                if len(cols) < 10:
                    continue
                t = cols[1].get_text(strip=True)
                sc = cols[-1].get_text(strip=True)
                parts = sc.split(":")
                opp = cols[6].get_text(strip=True)
                em = ""
                try:
                    if temizle_takim_adi(opp) == team_name_Temizle(team_name):
                        opp = cols[4].get_text(strip=True)
                        if len(parts) == 2:
                            og, tg = map(int, parts)
                            toplam_gol += tg + og
                            em = get_match_result_emoji(tg, og)
                    else:
                        if len(parts) == 2:
                            tg, og = map(int, parts)
                            toplam_gol += tg + og
                            em = get_match_result_emoji(tg, og)
                except Exception:
                    continue 
                df = cols[-4].get_text(strip=True) or "Yok"
                #print(f"[DEBUG] dizilis: {df}")
                #print(f"[DEBUG] toplam_gol: {toplam_gol}")
                if re.match(r"\d+:\d+", sc):
                    out.append({"tarih": t, "rakip": opp, "sonuc": sc, "dizilis": df, "emoji": em})
                if len(out)>=500:
                    break
            print(f"[DEBUG] fetch_matches dönen maç sayısı: {len(out)}")
            return out
        except Exception as e:
            print(f"[DEBUG] fetch_matches HATA: {e}")
            import traceback; traceback.print_exc()
            return []

    url1 = None
    tid = None
    u = search_team_url(team_name)
    print(f"[DEBUG] get_team_last_5_matches_with_tactics search_team_url: {u}")
    if u:
        tid = get_team_id_from_url(u)
        print(f"[DEBUG] get_team_last_5_matches_with_tactics team_id: {tid}")
    if not tid:
        print(f"[DEBUG] get_team_last_5_matches_with_tactics team_id yok!")
        return [],0,0,0,{}
    slug = team_name.lower().replace(" ","-")
    url1 = f"https://www.transfermarkt.com.tr/{slug}/spielplandatum/verein/{tid}/plus/1"
    m = fetch_matches(url1)
    if len(m)<5:
        url2 = f"https://www.transfermarkt.com.tr/{slug}/spielplandatum/verein/{tid}/saison_id/2024/plus/1"
        m = fetch_matches(url2)
    last5 = m[-5:][::-1]
    w = sum(1 for x in last5 if x["emoji"]=="✅")
    d = sum(1 for x in last5 if x["emoji"]=="🤝")
    l = sum(1 for x in last5 if x["emoji"]=="❌")
    performance = analyze_team_performance(last5)

    #print(f"[DEBUG] get_team_last_5_matches_with_tactics last5: {last5}")
    return last5, w, d, l, performance

# --- İki takım arası son 5 maç ---
def get_last_matches(team_a: str, team_b: str) -> List[Dict]:
    print(f"[LOG] get_last_matches: team_a={team_a}, team_b={team_b}")
    team_a_id = find_team_id(team_a)
    team_b_id = find_team_id(team_b)
    if not team_a_id or not team_b_id:
        print(f"[ERROR] get_last_matches: No team_id for {team_a} or {team_b}")
        return []

    url = f"https://www.transfermarkt.com.tr/vergleich/bilanzdetail/verein/{team_a_id}/gegner_id/{team_b_id}"
    headers = {"User-Agent": "Mozilla/5.0"}
    response = safe_get(url, headers=headers, timeout=30)
    if response is None or response.status_code != 200:
        print(f"[ERROR] get_last_matches: No response or bad status for {url}")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table", class_="items")
    if not isinstance(table, Tag):
        print(f"[ERROR] get_last_matches: No table")
        return []

    tbody = table.find("tbody")
    if not isinstance(tbody, Tag):
        print(f"[ERROR] get_last_matches: No tbody")
        return []

    matches: List[Dict] = []
    for row in tbody.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) < 10:
            continue
        try:
            date_text = cols[6].get_text(strip=True)
            match_date = datetime.strptime(date_text, "%d.%m.%Y")
            home_tag = cols[10].find('a')
            home = home_tag['title'] if isinstance(home_tag, Tag) and home_tag.has_attr('title') else cols[10].get_text(strip=True)
            guest_tag = cols[8].find('a')
            guest = guest_tag['title'] if isinstance(guest_tag, Tag) and guest_tag.has_attr('title') else cols[8].get_text(strip=True)
            result = cols[9].get_text(strip=True)
            if result.startswith("-"):
                continue
            matches.append({
                "date": match_date.strftime("%d.%m.%Y"),
                "home_team": home,
                "guest_team": guest,
                "result": result
            })
        except (ValueError, IndexError) as e:
            print(f"[ERROR] get_last_matches: {e}")
            continue
    print(f"[LOG] get_last_matches: matches found={len(matches)}")
    return matches[:5]

# --- Prompt hazırlama (aynı kalıyor) ---
def prepare_the_prompt(
    matches: List[Dict],
    team_a: str,
    maclar_a: List[Dict],
    wins_a: int,
    draws_a: int,
    losses_a: int,
    team_b: str,
    maclar_b: List[Dict],
    wins_b: int,
    draws_b: int,
    losses_b: int
) -> str:
    print(f"[LOG] prepare_the_prompt: team_a={team_a}, team_b={team_b}")
    last5_a = "\n".join(
        f"{m['tarih']} vs {m['rakip']} | Result: {m['sonuc']} | Formation: {m['dizilis']}"
        for m in maclar_a
    )
    last5_b = "\n".join(
        f"{m['tarih']} vs {m['rakip']} | Result: {m['sonuc']} | Formation: {m['dizilis']}"
        for m in maclar_b
    )
    h2h = "\n".join(
        f"{m['date']} - {m['guest_team']} {m['result']} {m['home_team']}"
        for m in matches
    )

    prompt = f"""You are a football analyst.\n\nTeam A (“{team_a}”) – last 5 matches:\n{last5_a}\nRecord: {wins_a} wins, {draws_a} draws, {losses_a} losses.\n\nTeam B (“{team_b}”) –
    last 5 matches:\n{last5_b}\nRecord: {wins_b} wins, {draws_b} draws, {losses_b} losses.\n\nHead-to-head (last 5 meetings):\n{h2h}\n\n
    Based on ONLY the data above, predict the score of the next match between {team_a} and {team_b}.\nAnswer only in this exact format:\nPrediction:
    {team_a} X – Y {team_b}\n\nDo not add any extra commentary, explanation, or text.\n"""

    print(f"[LOG] prepare_the_prompt: prompt=\n{prompt}")
    return prompt

# --- Gradio Space API'ye uygun yeni queue tabanlı inference fonksiyonu ---
def sor_hf(prompt: str) -> str:
    import uuid
    import json
    session_hash = f"sess-{uuid.uuid4().hex[:8]}"
    fn_index = 0  # app.py'de tek bir fonksiyon var, genellikle 0 olur
    trigger_id = 12  # zorunlu değil ama örnekte 12 idi, burada 0 kullanıyoruz
    join_url = "https://husodu73-llmff.hf.space/gradio_api/queue/join"
    data_url = "https://husodu73-llmff.hf.space/gradio_api/queue/data"
    headers = {"Content-Type": "application/json"}
    join_payload = {
        "data": [[prompt]],
        "event_data": None,
        "fn_index": fn_index,
        "trigger_id": trigger_id,
        "session_hash": session_hash
    }
    print(f"[GPT_TAHMIN] [sor_hf] Prompt hazırlanıyor: {prompt[:200]}...")
    try:
        print(f"[GPT_TAHMIN] [sor_hf] queue/join endpointine istek atılıyor... (session_hash={session_hash})")
        join_resp = requests.post(join_url, headers=headers, data=json.dumps(join_payload), timeout=30)
        print(f"[GPT_TAHMIN] [sor_hf] queue/join status: {join_resp.status_code}")
        if join_resp.status_code != 200:
            print(f"[GPT_TAHMIN] [sor_hf] queue/join başarısız: {join_resp.text}")
            return f"[ERROR] queue/join failed: {join_resp.status_code} {join_resp.text}"
        join_json = join_resp.json()
        print(f"[GPT_TAHMIN] [sor_hf] queue/join yanıtı: {join_json}")
        event_id = join_json.get("event_id") or join_json.get("event_id", None)
        print(f"[GPT_TAHMIN] [sor_hf] event_id: {event_id}")
        if not event_id:
            print(f"[GPT_TAHMIN] [sor_hf] event_id alınamadı: {join_json}")
            return f"[ERROR] queue/join: event_id alınamadı: {join_json}"
    except Exception as e:
        print(f"[GPT_TAHMIN] [sor_hf] queue/join exception: {e}")
        return f"[ERROR] queue/join exception: {e}"

    # Sonucu polling ile al
    import time
    print(f"[GPT_TAHMIN] [sor_hf] queue/data polling başlıyor... (event_id={event_id})")
    for i in range(60):  # 60 sn boyunca dene (her 1 sn'de bir)
        try:
            poll_url = f"{data_url}?session_hash={session_hash}&event_id={event_id}"
            print(f"[GPT_TAHMIN] [sor_hf] ({i+1}. deneme) queue/data: {poll_url}")
            poll_resp = requests.get(poll_url, timeout=10)
            print(f"[GPT_TAHMIN] [sor_hf] queue/data status: {poll_resp.status_code}")
            if not poll_resp.ok:
                print(f"[GPT_TAHMIN] [sor_hf] queue/data başarısız: {poll_resp.text}")
                time.sleep(1)
                continue
            poll_json = poll_resp.json()
            print(f"[GPT_TAHMIN] [sor_hf] queue/data yanıtı: {poll_json}")
            if isinstance(poll_json, dict) and "data" in poll_json and isinstance(poll_json["data"], list):
                print(f"[GPT_TAHMIN] [sor_hf] Tahmin alındı: {poll_json['data'][0][:200]}...")
                return poll_json["data"][0]
            if poll_json.get("status") == "generating":
                print(f"[GPT_TAHMIN] [sor_hf] Hala üretiliyor...")
                time.sleep(1)
                continue
            print(f"[GPT_TAHMIN] [sor_hf] queue/data beklenmeyen yanıt: {poll_json}")
            return f"[ERROR] queue/data: {poll_json}"
        except Exception as e:
            print(f"[GPT_TAHMIN] [sor_hf] queue/data exception: {e}")
            time.sleep(1)
            continue
    print(f"[GPT_TAHMIN] [sor_hf] 60 sn içinde sonuç alınamadı.")
    return "[ERROR] queue/data: 60 sn içinde sonuç alınamadı."


def predict_match(team_a: str, team_b: str) -> str:
    print(f"[GPT_TAHMIN] [predict_match] Butona basıldı! team_a={team_a}, team_b={team_b}")
    maclar_a, wins_a, draws_a, losses_a, _ = get_team_last_5_matches_with_tactics(team_a)
    print(f"[GPT_TAHMIN] [predict_match] {team_a} son 5 maç: {maclar_a}")
    maclar_b, wins_b, draws_b, losses_b, _ = get_team_last_5_matches_with_tactics(team_b)
    print(f"[GPT_TAHMIN] [predict_match] {team_b} son 5 maç: {maclar_b}")
    ikili = get_last_matches(team_a, team_b)
    print(f"[GPT_TAHMIN] [predict_match] Head-to-head maçlar: {ikili}")
    prompt = prepare_the_prompt(
        ikili,
        team_a, maclar_a, wins_a, draws_a, losses_a,
        team_b, maclar_b, wins_b, draws_b, losses_b
    )
    print(f"[GPT_TAHMIN] [predict_match] Hazırlanan prompt:\n{prompt}")
    result = sor_hf(prompt)
    print(f"[GPT_TAHMIN] [predict_match] Sonuç: {result}")
    return result