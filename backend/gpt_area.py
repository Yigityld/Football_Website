import requests
from bs4 import BeautifulSoup
from bs4.element import Tag
import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional
import time
import os

# Ortam değişkeninden Hugging Face token’ını al
HF_TOKEN = os.getenv("HF_TOKEN")
# Sadece Space API kullanılacak, model adı ve endpoint güncel
MODEL = "openai-community/gpt2"
HF_SPACE_API_URL = "https://husodu73-my-ollama-space.hf.space/api/predict"
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
        img = a.find("img")
        if isinstance(img, Tag) and img.has_attr("alt"):
            alt = img.get("alt")
            alt_str = ""
            if isinstance(alt, list):
                alt_str = " ".join(alt)
            elif isinstance(alt, str):
                alt_str = alt
            alt_text = alt_str.strip().lower()
            if team_name.lower() in alt_text:
                href = a.get("href")
                if isinstance(href, str):
                    print(f"[LOG] search_team_url: Found url={href}")
                    return f"https://www.transfermarkt.com.tr{href}"
        text = a.get_text(strip=True)
        if text.lower() == team_name.lower():
            href = a.get("href")
            if isinstance(href, str):
                print(f"[LOG] search_team_url: Found url={href}")
                return f"https://www.transfermarkt.com.tr{href}"
    if results:
        href = results[0].get("href")
        if isinstance(href, str):
            print(f"[LOG] search_team_url: Fallback url={href}")
            return f"https://www.transfermarkt.com.tr{href}"
    print(f"[ERROR] search_team_url: No results for {team_name}")
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
    def fetch_matches_from_url(url: str) -> List[Dict]:
        print(f"[LOG] fetch_matches_from_url: url={url}")
        headers = {"User-Agent": "Mozilla/5.0"}
        response = safe_get(url, headers=headers, timeout=30)
        if response is None or response.status_code != 200:
            print(f"[ERROR] fetch_matches_from_url: No response or bad status for {url}")
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        div_responsive = soup.find("div", class_="responsive-table")
        if not isinstance(div_responsive, Tag):
            print(f"[ERROR] fetch_matches_from_url: No responsive-table div")
            return []

        tbody = div_responsive.find("tbody")
        if not isinstance(tbody, Tag):
            print(f"[ERROR] fetch_matches_from_url: No tbody")
            return []

        matches: List[Dict] = []
        for row in tbody.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) < 10:
                continue
            try:
                tarih = cols[1].get_text(strip=True)
                skor = cols[-1].get_text(strip=True)
                parts = skor.split(":")
                rakip = cols[6].get_text(strip=True)
                emoji = ""

                if temizle_takim_adi(rakip) == team_name_Temizle(team_name):
                    rakip = cols[4].get_text(strip=True)
                    if len(parts) == 2:
                        rakip_gol, takim_gol = int(parts[0]), int(parts[1])
                        emoji = get_match_result_emoji(takim_gol, rakip_gol)
                else:
                    if len(parts) == 2:
                        takim_gol, rakip_gol = int(parts[0]), int(parts[1])
                        emoji = get_match_result_emoji(takim_gol, rakip_gol)

                dizilis = cols[-4].get_text(strip=True)
                if re.match(r"\d+:\d+", skor):
                    matches.append({
                        "tarih": tarih,
                        "rakip": rakip,
                        "sonuc": skor,
                        "dizilis": dizilis or "Yok",
                        "emoji": emoji
                    })
            except (ValueError, IndexError) as e:
                print(f"[ERROR] fetch_matches_from_url: {e}")
                continue

            if len(matches) >= 500:
                break

        print(f"[LOG] fetch_matches_from_url: matches found={len(matches)}")
        return matches

    team_url = search_team_url(team_name)
    team_id = get_team_id_from_url(team_url) if team_url else None
    if not team_id:
        print(f"[ERROR] get_team_last_5_matches_with_tactics: No team_id for {team_name}")
        return [], 0, 0, 0, {}

    slug = team_name.lower().replace(" ", "-")
    base_url = f"https://www.transfermarkt.com.tr/{slug}/spielplandatum/verein/{team_id}/plus/1"
    matches = fetch_matches_from_url(base_url)
    if len(matches) < 5:
        alt_url = f"https://www.transfermarkt.com.tr/{slug}/spielplandatum/verein/{team_id}/saison_id/2024/plus/1"
        matches = fetch_matches_from_url(alt_url)

    last_5 = matches[-5:][::-1] if matches else []
    wins = sum(1 for m in last_5 if m.get("emoji") == "✅")
    draws = sum(1 for m in last_5 if m.get("emoji") == "🤝")
    losses = sum(1 for m in last_5 if m.get("emoji") == "❌")
    performance = analyze_team_performance(last_5)
    print(f"[LOG] get_team_last_5_matches_with_tactics: last_5={last_5}")
    return last_5, wins, draws, losses, performance

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

    prompt = f"""You are a football analyst.\n\nTeam A (“{team_a}”) – last 5 matches:\n{last5_a}\nRecord: {wins_a} wins, {draws_a} draws, {losses_a} losses.\n\nTeam B (“{team_b}”) – last 5 matches:\n{last5_b}\nRecord: {wins_b} wins, {draws_b} draws, {losses_b} losses.\n\nHead-to-head (last 5 meetings):\n{h2h}\n\nBased on ONLY the data above, predict the score of the next match between {team_a} and {team_b}.\nAnswer only in this exact format:\nPrediction: {team_a} X – Y {team_b}\n\nDo not add any extra commentary, explanation, or text.\n"""
    print(f"[LOG] prepare_the_prompt: prompt=\n{prompt}")
    return prompt

# --- Geliştirilmiş HF Inference API çağrısı ---
def sor_hf(prompt: str) -> str:
    print(f"[LOG] sor_hf: prompt=\n{prompt}")
    payload = {
        "inputs": prompt,
        "options": {"use_cache": False},
        "parameters": {
            "max_new_tokens": 20,
            "return_full_text": False,
            "do_sample": False
        }
    }
    print(f"[LOG] sor_hf: POST URL={HF_SPACE_API_URL}")
    print(f"[LOG] sor_hf: payload={payload}")
    try:
        r = requests.post(HF_SPACE_API_URL, headers=HF_SPACE_HEADERS, json=payload, timeout=30)
        print(f"[LOG] sor_hf: response status={r.status_code}")
        print(f"[LOG] sor_hf: response text={r.text[:500]}")
    except Exception as e:
        print(f"[ERROR] sor_hf: Exception during POST: {e}")
        return f"[ERROR] sor_hf: Exception during POST: {e}"
    if r.status_code == 404:
        print(f"[ERROR] sor_hf: 404 Not Found")
        return ("HF API Hatası 404: Model bulunamadı. "
                "Lütfen Hugging Face'de “mistralai/Mistral-7B-Instruct-v0.2” sayfasına gidip "
                "lisansı kabul ettiğinizden emin olun ve MODEL değişkeninizi kontrol edin.")
    if not r.ok:
        print(f"[ERROR] sor_hf: API error {r.status_code}")
        return f"HF API Hatası {r.status_code}: {r.text.strip() or '<empty>'}"
    try:
        data = r.json()
        print(f"[LOG] sor_hf: response json={data}")
    except ValueError:
        print(f"[ERROR] sor_hf: Non-JSON response")
        return f"HF API non-JSON yanıt: {r.text[:200]}"
    if isinstance(data, dict) and data.get("error"):
        print(f"[ERROR] sor_hf: API error in response: {data['error']}")
        return f"HF Hata: {data['error']}"
    if isinstance(data, list) and data:
        print(f"[LOG] sor_hf: generated_text={data[0].get('generated_text', 'Cevap alınamadı.')}")
        return data[0].get("generated_text", "Cevap alınamadı.")
    print(f"[ERROR] sor_hf: Unexpected response format: {data}")
    return f"HF API’den beklenmeyen format: {data}"

# --- predict_match fonksiyonu ---
def predict_match(team_a: str, team_b: str) -> str:
    print(f"[LOG] predict_match: team_a={team_a}, team_b={team_b}")
    maclar_a, wins_a, draws_a, losses_a, _ = get_team_last_5_matches_with_tactics(team_a)
    maclar_b, wins_b, draws_b, losses_b, _ = get_team_last_5_matches_with_tactics(team_b)
    ikili = get_last_matches(team_a, team_b)

    prompt = prepare_the_prompt(
        ikili,
        team_a, maclar_a, wins_a, draws_a, losses_a,
        team_b, maclar_b, wins_b, draws_b, losses_b
    )
    result = sor_hf(prompt)
    print(f"[LOG] predict_match: result={result}")
    return result