import requests
from bs4 import BeautifulSoup
from bs4.element import Tag
import re
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import base64

# --- Takım URL ve ID çekme fonksiyonları ---
def search_team_url(team_name: str) -> Optional[str]:
    print(f"[DEBUG] search_team_url çağrıldı: {team_name}")
    query = team_name.replace(" ", "+")
    search_url = f"https://www.transfermarkt.com.tr/schnellsuche/ergebnis/schnellsuche?query={query}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = requests.get(search_url, headers=headers, timeout=30)
        print(f"[DEBUG] search_team_url status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"[DEBUG] search_team_url başarısız!")
            return None
        soup = BeautifulSoup(resp.text, "html.parser")
        results = [a for a in soup.select("a[href*='/startseite/verein/']") if isinstance(a, Tag)]
        print(f"[DEBUG] search_team_url bulunan sonuç sayısı: {len(results)}")
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
                        print(f"[DEBUG] search_team_url eşleşen alt bulundu: {href}")
                        return f"https://www.transfermarkt.com.tr{href}"
            text = a.get_text(strip=True)
            if text.lower() == team_name.lower():
                href = a.get("href")
                if isinstance(href, str):
                    print(f"[DEBUG] search_team_url eşleşen text bulundu: {href}")
                    return f"https://www.transfermarkt.com.tr{href}"
        if results:
            href = results[0].get("href")
            if isinstance(href, str):
                print(f"[DEBUG] search_team_url ilk sonuç döndü: {href}")
                return f"https://www.transfermarkt.com.tr{href}"
    except requests.exceptions.Timeout:
        print("[ERROR] search_team_url zaman aşımına uğradı.")
        return None
    except Exception as e:
        print(f"[DEBUG] search_team_url HATA: {e}")
        import traceback; traceback.print_exc()
    return None


def get_team_id_from_url(team_url: Optional[str]) -> Optional[str]:
    print(f"[DEBUG] get_team_id_from_url çağrıldı: {team_url}")
    if not team_url:
        print(f"[DEBUG] get_team_id_from_url: url yok!")
        return None
    match = re.search(r"/verein/(\d+)", team_url)
    result = match.group(1) if match else None
    print(f"[DEBUG] get_team_id_from_url sonucu: {result}")
    return result


def find_team_id(team_name: str) -> Optional[str]:
    print(f"[DEBUG] find_team_id çağrıldı: {team_name}")
    url = search_team_url(team_name)
    print(f"[DEBUG] find_team_id url: {url}")
    result = get_team_id_from_url(url) if url else None
    print(f"[DEBUG] find_team_id sonucu: {result}")
    return result


def temizle_takim_adi(adi: str) -> str:
    result = re.sub(r"\(.*?\)", "", adi).strip().lower()
    print(f"[DEBUG] temizle_takim_adi: {adi} -> {result}")
    return result


def get_match_result_emoji(team_score: int, opponent_score: int) -> str:
    print(f"[DEBUG] get_match_result_emoji: {team_score}-{opponent_score}")
    if team_score > opponent_score:
        return "✅"
    if team_score == opponent_score:
        return "🤝"
    return "❌"


def team_name_Temizle(team_name: str) -> str:
    name = team_name.lower().strip()
    name = re.sub(r'\bfc\b', '', name)
    result = name.strip()
    print(f"[DEBUG] team_name_Temizle: {team_name} -> {result}")
    return result

# --- Takımın son 5 maçını getir ---
def get_team_last_5_matches_with_tactics(team_name: str) -> Tuple[List[Dict[str, Any]], int, int, int]:
    print(f"[DEBUG] get_team_last_5_matches_with_tactics çağrıldı: {team_name}")
    def fetch_matches(url: str) -> List[Dict[str, Any]]:
        print(f"[DEBUG] fetch_matches çağrıldı: {url}")
        try:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
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
            for row in body.find_all("tr") if isinstance(body, Tag) else []:
                cols = row.find_all("td") if isinstance(row, Tag) else []
                if len(cols) < 10:
                    continue
                t = cols[1].get_text(strip=True)
                sc = cols[-1].get_text(strip=True)
                parts = sc.split(":")
                opp = cols[6].get_text(strip=True)
                em = ""
                if temizle_takim_adi(opp) == team_name_Temizle(team_name):
                    opp = cols[4].get_text(strip=True)
                    if len(parts)==2:
                        og, tg = map(int, parts)
                        em = get_match_result_emoji(tg, og)
                else:
                    if len(parts)==2:
                        tg, og = map(int, parts)
                        em = get_match_result_emoji(tg, og)
                df = cols[-4].get_text(strip=True) or "Yok"
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
        return [],0,0,0
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
    print(f"[DEBUG] get_team_last_5_matches_with_tactics last5: {last5}")
    return last5,w,d,l

# İki takım arası son 5 maç

def get_last_matches(team_a: str, team_b: str) -> List[Dict[str, Any]]:
    print(f"[DEBUG] get_last_matches çağrıldı: {team_a} vs {team_b}")
    a_id = find_team_id(team_a)
    b_id = find_team_id(team_b)
    print(f"[DEBUG] get_last_matches team_ids: {a_id}, {b_id}")
    if not a_id or not b_id:
        print(f"[DEBUG] get_last_matches team_id yok!")
        return []
    url = f"https://www.transfermarkt.com.tr/vergleich/bilanzdetail/verein/{a_id}/gegner_id/{b_id}"
    try:
        r = requests.get(url, headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        print(f"[DEBUG] get_last_matches status: {r.status_code}")
        if r.status_code!=200:
            print(f"[DEBUG] get_last_matches başarısız!")
            return []
        s = BeautifulSoup(r.text,"html.parser")
        t = s.find("table",class_="items")
        if not isinstance(t,Tag): 
            print(f"[DEBUG] get_last_matches table yok!")
            return []
        tb = t.find("tbody")
        if not isinstance(tb,Tag): 
            print(f"[DEBUG] get_last_matches tbody yok!")
            return []
        res=[]
        for row in tb.find_all("tr") if isinstance(tb, Tag) else []:
            cols=row.find_all("td") if isinstance(row, Tag) else []
            if len(cols)<10: continue
            dt=cols[6].get_text(strip=True)
            try: dtt=datetime.strptime(dt,"%d.%m.%Y")
            except: continue
            h_a=cols[10].find("a") if isinstance(cols[10], Tag) else None
            home=h_a.get("title") if isinstance(h_a,Tag) and h_a.has_attr("title") else cols[10].get_text(strip=True)
            g_a=cols[8].find("a") if isinstance(cols[8], Tag) else None
            guest=g_a.get("title") if isinstance(g_a,Tag) and g_a.has_attr("title") else cols[8].get_text(strip=True)
            rsc=cols[9].get_text(strip=True)
            if not rsc.startswith("-"):
                res.append({"date":dtt.strftime("%d.%m.%Y"),"home_team":home,"guest_team":guest,"result":rsc})
        print(f"[DEBUG] get_last_matches dönen maç sayısı: {len(res)}")
        return res[:5]
    except Exception as e:
        print(f"[DEBUG] get_last_matches HATA: {e}")
        import traceback; traceback.print_exc()
        return []

# Hakem URL

def search_referee(name: str) -> Optional[str]:
    q=name.replace(" ","+")
    u=f"https://www.transfermarkt.com.tr/schnellsuche/ergebnis/schnellsuche?query={q}"
    try:
        r=requests.get(u,headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r.status_code!=200: return None
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
        r=requests.get(u,headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r.status_code!=200: return f"<b>❌ Hata:{r.status_code}</b>",None
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
    print(f"[DEBUG] get_team_info çağrıldı: {name}")
    try:
        url = search_team_url(name)
        print(f"[DEBUG] search_team_url sonucu: {url}")
        if not url:
            print("[DEBUG] Takım URL bulunamadı!")
            return {}
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = requests.get(url, headers=headers, timeout=30)
        print(f"[DEBUG] requests.get status: {resp.status_code}")
        if resp.status_code != 200:
            print(f"[DEBUG] Takım sayfası çekilemedi! Status: {resp.status_code}")
            return {}
        soup = BeautifulSoup(resp.text, "html.parser")
        tn = soup.find("h1", class_="data-header__headline-wrapper")
        team_name = tn.get_text(strip=True) if isinstance(tn, Tag) else "?"
        print(f"[DEBUG] Takım adı: {team_name}")
        lg = soup.find("span", class_="data-header__club")
        league_name = lg.get_text(strip=True) if isinstance(lg, Tag) else "?"
        print(f"[DEBUG] Lig adı: {league_name}")
        league_rank = "?"
        for label in soup.find_all("span", class_="data-header__label"):
            if "Lig Sıralaması" in label.get_text():
                cont = label.find_next_sibling("span", class_="data-header__content")
                if isinstance(cont, Tag):
                    a = cont.find("a")
                    league_rank = a.get_text(strip=True) if isinstance(a, Tag) else cont.get_text(strip=True)
                break
        print(f"[DEBUG] Lig sıralaması: {league_rank}")
        logo_div = soup.find("div", class_="data-header__profile-container")
        logo_img = logo_div.find("img") if isinstance(logo_div, Tag) else None
        logo_url = logo_img["src"] if isinstance(logo_img, Tag) and logo_img.has_attr("src") else None
        print(f"[DEBUG] Logo URL: {logo_url}")
        cups: list[str] = []
        for cup in soup.find_all("a", class_="data-header__success-data") if isinstance(soup, Tag) else []:
            title = cup.get("title", "Kupa") if isinstance(cup, Tag) else "Kupa"
            num = cup.find("span", class_="data-header__success-number") if isinstance(cup, Tag) else None
            cups.append(f"{title}: {num.get_text(strip=True) if isinstance(num, Tag) else '?'}")
        print(f"[DEBUG] Kupalar: {cups}")
        market = soup.find("a", class_="data-header__market-value-wrapper")
        squad_value = market.get_text(strip=True) if isinstance(market, Tag) else "?"
        print(f"[DEBUG] Kadro değeri: {squad_value}")
        def find_data(label_text: str) -> str:
            for li in soup.select("ul.data-header__items li") if isinstance(soup, Tag) else []:
                if label_text in li.get_text():
                    cont = li.find("span", class_="data-header__content") if isinstance(li, Tag) else None
                    return cont.get_text(strip=True) if isinstance(cont, Tag) else "?"
            return "?"
        age_avg = find_data("Yaş ortalaması")
        stadium = find_data("Stadyum")
        print(f"[DEBUG] Yaş ortalaması: {age_avg}")
        print(f"[DEBUG] Stadyum: {stadium}")
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
        print(f"[DEBUG] get_team_info sonucu: {result}")
        return result
    except requests.exceptions.Timeout:
        print("[ERROR] get_team_info zaman aşımına uğradı.")
        return {}
    except Exception as e:
        print(f"[DEBUG] get_team_info HATA: {e}")
        import traceback; traceback.print_exc()
        return {}


def get_image_as_base64(url: str) -> Optional[str]:
    if not url: return None
    try:
        r=requests.get(url,headers={"User-Agent":"Mozilla/5.0"}, timeout=30)
        if r.status_code==200:
            return base64.b64encode(r.content).decode()
    except Exception as e:
        print(f"get_image_as_base64 error:{e}")
    return None
