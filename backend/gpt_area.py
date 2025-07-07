import requests
from bs4 import BeautifulSoup
from bs4.element import Tag
import re
from datetime import datetime
from typing import List, Dict, Tuple, Optional

# --- Takım URL ve ID çekme fonksiyonları ---
def search_team_url(team_name: str) -> Optional[str]:
    query = team_name.replace(" ", "+")
    search_url = f"https://www.transfermarkt.com.tr/schnellsuche/ergebnis/schnellsuche?query={query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(search_url, headers=headers)
    if response.status_code != 200:
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
                    return f"https://www.transfermarkt.com.tr{href}"
        text = a.get_text(strip=True)
        if text.lower() == team_name.lower():
            href = a.get("href")
            if isinstance(href, str):
                return f"https://www.transfermarkt.com.tr{href}"
    if results:
        href = results[0].get("href")
        if isinstance(href, str):
            return f"https://www.transfermarkt.com.tr{href}"
    return None


def get_team_id_from_url(team_url: str) -> Optional[str]:
    if not team_url:
        return None
    match = re.search(r"/verein/(\d+)", team_url)
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

# --- Takımın son 5 maçını (diziliş + skor) getir ---
def get_team_last_5_matches_with_tactics(team_name: str) -> Tuple[List[Dict], int, int, int]:
    def fetch_matches_from_url(url: str) -> List[Dict]:
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        div_responsive = soup.find("div", class_="responsive-table")
        if not isinstance(div_responsive, Tag):
            return []

        tbody = div_responsive.find("tbody")
        if not isinstance(tbody, Tag):
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
            except (ValueError, IndexError):
                continue

            if len(matches) >= 500:
                break

        return matches

    team_url = search_team_url(team_name)
    team_id = get_team_id_from_url(team_url) if team_url else None
    if not team_id:
        return [], 0, 0, 0

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
    return last_5, wins, draws, losses

# --- İki takım arası son 5 maç ---
def get_last_matches(team_a: str, team_b: str) -> List[Dict]:
    team_a_id = find_team_id(team_a)
    team_b_id = find_team_id(team_b)
    if not team_a_id or not team_b_id:
        return []

    url = f"https://www.transfermarkt.com.tr/vergleich/bilanzdetail/verein/{team_a_id}/gegner_id/{team_b_id}"
    headers = {"User-Agent": "Mozilla/5.0"}
    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table", class_="items")
    if not isinstance(table, Tag):
        return []

    tbody = table.find("tbody")
    if not isinstance(tbody, Tag):
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
        except (ValueError, IndexError):
            continue
    return matches[:5]

# --- Prompt hazırlama ---
def hazirla_prompt_string(
    matches: List[Dict], team_a: str, maclar_a: List[Dict], wins_a: int, draws_a: int, losses_a: int,
    team_b: str, maclar_b: List[Dict], wins_b: int, draws_b: int, losses_b: int
) -> str:
    prompt = f"Sen bir futbol yorumcusun.\n\n"
    prompt += f"{team_a} takımının son 5 maçı:\n"
    for m in maclar_a:
        prompt += f"{m['tarih']} vs {m['rakip']} | Sonuç: {m['sonuc']} | Diziliş: {m['dizilis']}\n"
    prompt += f"Son 5 maçta: {wins_a} galibiyet ✅, {draws_a} beraberlik 🤝, {losses_a} mağlubiyet ❌\n\n"
    prompt += f"{team_b} takımının son 5 maçı:\n"
    for m in maclar_b:
        prompt += f"{m['tarih']} vs {m['rakip']} | Sonuç: {m['sonuc']} | Diziliş: {m['dizilis']}\n"
    prompt += f"Son 5 maçta: {wins_b} galibiyet ✅, {draws_b} beraberlik 🤝, {losses_b} mağlubiyet ❌\n\n"
    prompt += f"{team_a} ve {team_b} arasındaki son 5 maç:\n"
    for m in matches:
        prompt += f"{m['date']} - {m['guest_team']} {m['result']} {m['home_team']}\n"
    prompt += (
        "\nLütfen sadece bir sonraki maçın tahmini skorunu şu formatta yaz:\n" +
        f"Tahmin: {team_a} X - Y {team_b} (Burada X ve Y yerine kendi rakam tercihlerini yaz (0,1,2,3,4,5 gibi))\n" +
        "Başka hiçbir şey yazma."
    )
    return prompt

# --- LLM'ye sorgu gönderme ---
def sor_local_llm(prompt: str, model: str = "mistral") -> str:
    try:
        url = "http://localhost:11434/generate"
        headers = {"Content-Type": "application/json"}
        data = {"model": model, "prompt": prompt, "stream": False}
        response = requests.post(url, headers=headers, json=data)
        if response.ok:
            json_data = response.json()
            if isinstance(json_data, dict):
                return json_data.get("response", "")
        return f"Hata: {response.status_code} - {response.text}"
    except Exception as e:
        return f"LLM bağlantısı başarısız: {e}"

# --- Dışa açılan fonksiyon ---
def predict_match(team_a: str, team_b: str) -> str:
    maclar_a, wins_a, draws_a, losses_a = get_team_last_5_matches_with_tactics(team_a)
    maclar_b, wins_b, draws_b, losses_b = get_team_last_5_matches_with_tactics(team_b)
    ikili = get_last_matches(team_a, team_b)
    prompt = hazirla_prompt_string(ikili, team_a, maclar_a, wins_a, draws_a, losses_a, team_b, maclar_b, wins_b, draws_b, losses_b)
    return sor_local_llm(prompt)
