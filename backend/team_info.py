import requests
from bs4 import BeautifulSoup
from bs4.element import Tag
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple, Coroutine
import base64
import asyncio
from functools import lru_cache
import time

# --- Takım URL ve ID çekme fonksiyonları ---
def search_team_url(team_name: str) -> Optional[str]:
    query = team_name.replace(" ", "+")
    search_url = f"https://www.transfermarkt.com.tr/schnellsuche/ergebnis/schnellsuche?query={query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = safe_get(search_url, headers=headers, timeout=30)
        if resp is None:
            return None
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        results = [a for a in soup.select("a[href*='/startseite/verein/']") if isinstance(a, Tag)]
        for a in results:
            img = a.find("img")
            if isinstance(img, Tag) and img.has_attr("alt"):
                alt = img.get("alt")
                alt_str = ""
                if isinstance(alt, list):
                    alt_str = " ".join(alt)
                elif isinstance(alt, str):
                    alt_str = alt
                if team_name.lower() in alt_str.strip().lower():
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
    except requests.exceptions.Timeout:
        return None
    except Exception as e:
        pass
    return None


def get_team_id_from_url(team_url: Optional[str]) -> Optional[str]:
    if not team_url:
        return None
    match = re.search(r"/verein/(\d+)", team_url)
    result = match.group(1) if match else None
    return result


def find_team_id(team_name: str) -> Optional[str]:
    url = search_team_url(team_name)
    result = get_team_id_from_url(url) if url else None
    return result


def temizle_takim_adi(adi: str) -> str:
    result = re.sub(r"\(.*?\)", "", adi).strip().lower()
    return result


def get_match_result_emoji(team_score: int, opponent_score: int) -> str:
    if team_score > opponent_score:
        return "✅"
    if team_score == opponent_score:
        return "🤝"
    return "❌"


def team_name_Temizle(team_name: str) -> str:
    name = team_name.lower().strip()
    name = re.sub(r'\bfc\b', '', name)
    result = name.strip()
    return result

# --- Takımın son 5 maçını getir ---
def get_team_last_5_matches_with_tactics(team_name: str) -> Tuple[List[Dict[str, Any]], int, int, int, int , int]:
    def fetch_matches(url: str) -> List[Dict[str, Any]]:
        try:
            r = safe_get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
            if r is None:
                return []
            if r.status_code != 200:
                return []
            s = BeautifulSoup(r.text, "html.parser")
            div = s.find("div", class_="responsive-table")
            if not isinstance(div, Tag):
                return []
            body = div.find("tbody")
            if not isinstance(body, Tag):
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
                if re.match(r"\d+:\d+", sc):
                    out.append({"tarih": t, "rakip": opp, "sonuc": sc, "dizilis": df, "emoji": em})
                if len(out)>=500:
                    break
            return out
        except Exception as e:
            return []

    url1 = None
    tid = None
    u = search_team_url(team_name)
    if u:
        tid = get_team_id_from_url(u)
    if not tid:
        return [],0,0,0,0,0
    slug = team_name.lower().replace(" ", "-")
    url1 = f"https://www.transfermarkt.com.tr/{slug}/spielplandatum/verein/{tid}/plus/1"
    m = fetch_matches(url1)
    if len(m)<5:
        url2 = f"https://www.transfermarkt.com.tr/{slug}/spielplandatum/verein/{tid}/saison_id/2024/plus/1"
        m = fetch_matches(url2)
    last5 = m[-5:][::-1]
    w = sum(1 for x in last5 if x["emoji"]=="✅")
    wh = 0
    for match in last5:
        if match["emoji"] == "✅":
            try:
                g1, g2 = map(int, match["sonuc"].split(":"))
                fark = abs(g1 - g2)
                if fark >= 2:
                    wh += 1
            except:
                continue
    d = sum(1 for x in last5 if x["emoji"]=="🤝")
    l = sum(1 for x in last5 if x["emoji"]=="❌")
    kg = 0
    for match in last5:
        try:
            g1, g2 = map(int, match["sonuc"].split(":"))
            if g1 != 0 and g2 != 0:
                kg += 1
        except:
            continue
    return last5, w, d, l, wh, kg

def analyze_referee_stats(ref_stats: dict) -> None:
    sari_kart = ref_stats.get('Sarı Kart', 0) / ref_stats.get('Maç', 1)
    kirmizi_kart = (ref_stats.get('2. Sarıdan Kırmızı', 0) + ref_stats.get('Direkt Kırmızı', 0)) / ref_stats.get('Maç', 1)
    penalti = ref_stats.get('Penaltı', 0) / ref_stats.get('Maç', 1)

    print(f"🟡 Hakemin  Maç başı Sarı Kart Sayısı: {sari_kart:.2f}")
    print(f"🟥 Hakemin Maç başı Kırmızı Kart Ortalaması: {kirmizi_kart:.2f}")
    print(f"🟡 Hakemin  Maç başı Penaltı Sayısı: {penalti:.2f}")

def analyze_team_performance(team_name: str, matches: list[dict], w: int, d: int, l: int, handikap: int, karsilikli: int) -> None:
    total_goals = 0
    ust_olan_mac = 0
    for match in matches:
        if ':' in match['sonuc']:
            g1, g2 = map(int, match['sonuc'].split(':'))
            mac_gol = g1 + g2
            if mac_gol > 2:
                ust_olan_mac += 1
            total_goals += mac_gol

    ust_gol = total_goals / 5

    

def get_last_matches(team_a: str, team_b: str) -> List[Dict[str, Any]]:
    a_id = find_team_id(team_a)
    b_id = find_team_id(team_b)
    if not a_id or not b_id:
        return []
    url = f"https://www.transfermarkt.com.tr/vergleich/bilanzdetail/verein/{a_id}/gegner_id/{b_id}"
    try:
        r = safe_get(url, headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r is None:
            return []
        if r.status_code!=200:
            return []
        s = BeautifulSoup(r.text, "html.parser")
        table = s.find("table", class_="items")
        if not isinstance(table, Tag):
            return []
        tbody = table.find("tbody")
        if not isinstance(tbody, Tag):
            return []
        matches: List[Dict[str, Any]] = []
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
                continue
        return matches[:5]
    except Exception as e:
        return []

# Hakem URL

def search_referee(name: str) -> Optional[str]:
    q=name.replace(" ","+")
    u=f"https://www.transfermarkt.com.tr/schnellsuche/ergebnis/schnellsuche?query={q}"
    try:
        r = safe_get(u, headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r is None or r.status_code!=200: return None
        s=BeautifulSoup(r.text,"html.parser")
        l=s.find("a",href=re.compile(r"/profil/schiedsrichter/"))
        if isinstance(l,Tag):
            href=l.get("href")
            if isinstance(href,str): return f"https://www.transfermarkt.com.tr{href}"
    except Exception as e:
        print(f"search_referee error:{e}")
    return None

# Hakem bilgisi

def get_referee_info(name: str, season:str="2024") -> Tuple[str,Optional[str]]:
    u=search_referee(name)
    if not u: return "<b>❌ Hakem bulunamadı.</b>",None
    if not u.endswith("/"): u+="/"
    u+=f"saison/{season}"
    try:
        r = safe_get(u, headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r is None or r.status_code!=200: return f"<b>❌ Hata:{r.status_code if r else 'timeout'}</b>",None
        s=BeautifulSoup(r.text,"html.parser")
        img_tag = s.find("img", class_="data-header__profile-image")
        img_url: Optional[str] = None
        if isinstance(img_tag, Tag) and img_tag.has_attr("src"):
            src_attr = img_tag.get("src")
            if isinstance(src_attr, str):
                img_url = src_attr
            elif isinstance(src_attr, list) and src_attr:
                img_url = src_attr[0]
        spans=s.select("div.info-table--equal-space > span.info-table__content--bold")
        dob=spans[0].get_text(strip=True) if spans else "?"
        birthplace=next((sp.get_text(strip=True) for sp in spans if isinstance(sp,Tag) and "Türkiye" in sp.get_text()),"?")
        stats={"Maç":0,"Sarı Kart":0,"2. Sarıdan Kırmızı":0,"Direkt Kırmızı":0,"Penaltı":0}
        form=s.find("form",action=re.compile(r"/profil/schiedsrichter"))
        if isinstance(form,Tag):
            action=form.get("action")
            if isinstance(action,str):
                full=f"https://www.transfermarkt.com.tr{action}"
                sel=form.select_one("select[name='saison_id']")
                if isinstance(sel,Tag):
                    opt=next((o for o in sel.find_all("option") if season in o.get_text()),None)
                    if isinstance(opt,Tag) and opt.get("value"): 
                        data={"funktion":"1","saison_id":opt.get("value")} 
                        rr=requests.post(full,headers={"User-Agent":"Mozilla/5.0"},data=data)
                        ss=BeautifulSoup(rr.text,"html.parser")
                        tb2=ss.find("table",class_="items")
                        if isinstance(tb2,Tag):
                            tbod=tb2.find("tbody")
                            if isinstance(tbod,Tag):
                                for rw in tbod.find_all("tr"):
                                    cd=rw.find_all("td")
                                    if len(cd)>=7:
                                        try:
                                            stats["Maç"]+=int(cd[2].get_text(strip=True))
                                            stats["Sarı Kart"]+=int(cd[3].get_text(strip=True))
                                            stats["2. Sarıdan Kırmızı"]+=int(cd[4].get_text(strip=True))
                                            stats["Direkt Kırmızı"]+=int(cd[5].get_text(strip=True))
                                            stats["Penaltı"]+=int(cd[6].get_text(strip=True))
                                        except: pass
        html=f"<b>📋 Hakem:</b> {name.title()}<br><b>🎂 Doğum Tarihi/Yaş:</b> {dob}<br><b>📍 Doğum Yeri:</b> {birthplace}<br><b>📊 {season} Sezonu İstatistikleri:</b><br>"+"".join([f"{k}: {v}<br>" for k,v in stats.items()])
        return html,img_url
    except Exception as e:
        print(f"get_referee_info error:{e}")
        return f"<b>❌ Hata:{e}</b>",None

# Takım bilgisi
def get_team_info(name: str) -> Dict[str, Any]:
    try:
        url = search_team_url(name)
        if not url:
            return {}
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code != 200:
            return {}
        soup = BeautifulSoup(resp.text, "html.parser")
        tn = soup.find("h1", class_="data-header__headline-wrapper")
        team_name = tn.get_text(strip=True) if isinstance(tn, Tag) else "?"
        lg = soup.find("span", class_="data-header__club")
        league_name = lg.get_text(strip=True) if isinstance(lg, Tag) else "?"
        league_rank = "?"
        for label in soup.find_all("span", class_="data-header__label"):
            if "Lig Sıralaması" in label.get_text():
                cont = label.find_next_sibling("span", class_="data-header__content")
                if isinstance(cont, Tag):
                    a = cont.find("a")
                    league_rank = a.get_text(strip=True) if isinstance(a, Tag) else cont.get_text(strip=True)
                break
        logo_div = soup.find("div", class_="data-header__profile-container")
        logo_img = logo_div.find("img") if isinstance(logo_div, Tag) else None
        logo_url = logo_img["src"] if isinstance(logo_img, Tag) and logo_img.has_attr("src") else None
        cups: list[str] = []
        for cup in soup.find_all("a", class_="data-header__success-data") if isinstance(soup, Tag) else []:
            title = cup.get("title", "Kupa") if isinstance(cup, Tag) else "Kupa"
            num = cup.find("span", class_="data-header__success-number") if isinstance(cup, Tag) else None
            cups.append(f"{title}: {num.get_text(strip=True) if isinstance(num, Tag) else '?'}")
        market = soup.find("a", class_="data-header__market-value-wrapper")
        squad_value = market.get_text(strip=True) if isinstance(market, Tag) else "?"
        def find_data(label_text: str) -> str:
            for li in soup.select("ul.data-header__items li") if isinstance(soup, Tag) else []:
                if label_text in li.get_text():
                    cont = li.find("span", class_="data-header__content") if isinstance(li, Tag) else None
                    return cont.get_text(strip=True) if isinstance(cont, Tag) else "?"
            return "?"
        age_avg = find_data("Yaş ortalaması")
        stadium = find_data("Stadyum")
        result = {
            "Takım": team_name,
            "Lig": league_name,
            "Lig Sıralaması": league_rank,
            "Logo URL": logo_url,
            "Kupalar": cups,
            "Kadro Değeri": squad_value,
            "Yaş Ortalaması": age_avg,
            "Stadyum": stadium
        }
        return result
    except requests.exceptions.Timeout:
        return {}
    except Exception as e:
        import traceback; traceback.print_exc()
        return {}


def get_image_as_base64(url: str) -> Optional[str]:
    if not url: return None
    try:
        r = safe_get(url, headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r is not None and r.status_code==200:
            return base64.b64encode(r.content).decode()
    except Exception as e:
        print(f"get_image_as_base64 error:{e}")
    return None

# --- Takım URL ve ID çekme fonksiyonları ---
@lru_cache(maxsize=128)
def search_team_url_cached(team_name: str) -> Optional[str]:
    return search_team_url(team_name)

async def async_search_team_url(team_name: str) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, search_team_url_cached, team_name)

async def async_get_team_id_from_url(team_url: Optional[str]) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_team_id_from_url, team_url)

@lru_cache(maxsize=128)
def find_team_id_cached(team_name: str) -> Optional[str]:
    return find_team_id(team_name)

async def async_find_team_id(team_name: str) -> Optional[str]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, find_team_id_cached, team_name)

# --- Takımın son 5 maçını getir ---
@lru_cache(maxsize=128)
def get_team_last_5_matches_with_tactics_cached(team_name: str):
    return get_team_last_5_matches_with_tactics(team_name)

async def async_get_team_last_5_matches_with_tactics(team_name: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_team_last_5_matches_with_tactics_cached, team_name)

@lru_cache(maxsize=128)
def get_last_matches_cached(team_a: str, team_b: str):
    return get_last_matches(team_a, team_b)

async def async_get_last_matches(team_a: str, team_b: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_last_matches_cached, team_a, team_b)

@lru_cache(maxsize=128)
def get_team_info_cached(name: str):
    return get_team_info(name)

async def async_get_team_info(name: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_team_info_cached, name)

@lru_cache(maxsize=128)
def get_referee_info_cached(name: str, season: str = "2024"):
    return get_referee_info(name, season)

async def async_get_referee_info(name: str, season: str = "2024"):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_referee_info_cached, name, season)

@lru_cache(maxsize=128)
def get_image_as_base64_cached(url: str):
    return get_image_as_base64(url)

async def async_get_image_as_base64(url: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_image_as_base64_cached, url)

def safe_get(url, headers=None, timeout=30, retries=3, wait=2):
    for attempt in range(retries):
        try:
            return requests.get(url, headers=headers, timeout=timeout)
        except requests.exceptions.Timeout:
            print(f"[WARN] Timeout, retrying {attempt+1}/{retries}... {url}")
            time.sleep(wait)
        except Exception as e:
            print(f"[ERROR] safe_get error: {e} {url}")
            break
    return None
