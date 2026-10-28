#!/usr/bin/env python3
"""App Store 提出用画像（1320×2868）を 100% ネイティブ HTML/CSS/SVG で Chrome 描画する。

元スクショ（472×1024）の拡大によるボケをゼロにするため、
アプリ内の全画面（ホーム・探索・ジャンル・ツール・情報源）もすべて
実際の data/feed.json・data/sources.json・src/theme/tokens.ts から
ベクター／ネイティブ解像度で直接レンダリングする。
"""
from __future__ import annotations

import html as html_mod
import json
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from PIL import Image

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
REPO = ROOT.parent.parent
OUT_JA = ROOT / "submit" / "ja"
OUT_EN = ROOT / "submit" / "en"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

FEED_PATH = REPO / "data" / "feed.json"
SOURCES_PATH = REPO / "data" / "sources.json"

W, H = 1320, 2868

FEED = json.loads(FEED_PATH.read_text(encoding="utf-8"))
SOURCES = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
FEED_BY_ID = {a["id"]: a for a in FEED}


def esc(s: str) -> str:
  return html_mod.escape(s, quote=True)


def favicon_url(site_url: str) -> str:
  host = urlparse(site_url).hostname or site_url
  return f"https://www.google.com/s2/favicons?domain={host}&sz=128"


STATUS_BAR_SVG = """
<div class="ios-status">
  <span class="ios-time">9:41</span>
  <div class="ios-island"></div>
  <div class="ios-right">
    <svg width="24" height="15" viewBox="0 0 20 13" fill="white">
      <rect x="0" y="9" width="3.2" height="4" rx="1"/>
      <rect x="4.8" y="6.5" width="3.2" height="6.5" rx="1"/>
      <rect x="9.6" y="3.5" width="3.2" height="9.5" rx="1"/>
      <rect x="14.4" y="0" width="3.2" height="13" rx="1"/>
    </svg>
    <svg width="21" height="15" viewBox="0 0 18 13" fill="white">
      <path d="M9 10.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm-4.1-2.1a6 6 0 0 1 8.2 0l1.3-1.4a8 8 0 0 0-10.8 0l1.3 1.4zm-3-3a10.2 10.2 0 0 1 14.2 0l1.4-1.4a12.2 12.2 0 0 0-17 0l1.4 1.4z"/>
    </svg>
    <svg width="33" height="15" viewBox="0 0 28 13" fill="none">
      <rect x="0.7" y="0.7" width="23.6" height="11.6" rx="3.2" stroke="white" stroke-opacity="0.45" stroke-width="1.2"/>
      <rect x="2.4" y="2.4" width="20.2" height="8.2" rx="1.8" fill="white"/>
      <path d="M25.6 4.2v4.6a2.2 2.2 0 0 0 0-4.6z" fill="white" fill-opacity="0.45"/>
    </svg>
  </div>
</div>
"""


def bottom_tabs_html(active: str, lang: str) -> str:
  labels = (
    {"home": "ホーム", "explore": "探索", "saved": "保存済み", "settings": "設定"}
    if lang == "ja"
    else {"home": "Home", "explore": "Explore", "saved": "Saved", "settings": "Settings"}
  )
  icons = {
    "home": '<path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z"/>',
    "explore": '<circle cx="12" cy="12" r="9"/><polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5"/>',
    "saved": '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
    "settings": '<line x1="4" y1="7" x2="20" y2="7"/><circle cx="9" cy="7" r="2.2" fill="#0E1117"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2.2" fill="#0E1117"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="11" cy="17" r="2.2" fill="#0E1117"/>',
  }
  items = []
  for key in ("home", "explore", "saved", "settings"):
    cls = "b-tab active" if key == active else "b-tab"
    items.append(
      f'<div class="{cls}">'
      f'<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{icons[key]}</svg>'
      f'<span>{labels[key]}</span>'
      f"</div>"
    )
  return f'<div class="bottom-bar">{"".join(items)}</div>'


COMMON_APP_CSS = """
  .ios-status {
    height: 88px;
    padding: 0 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #fff;
    position: relative;
    flex-shrink: 0;
  }
  .ios-time {
    font-size: 30px; font-weight: 700; letter-spacing: -0.02em;
  }
  .ios-island {
    position: absolute;
    left: 50%; top: 18px;
    transform: translateX(-50%);
    width: 214px; height: 52px;
    background: #000;
    border-radius: 30px;
  }
  .ios-right {
    display: flex; align-items: center; gap: 11px;
  }
  .bottom-bar {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    height: 146px;
    background: rgba(12, 16, 23, 0.96);
    border-top: 2px solid #232A38;
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 20px 18px 20px;
    z-index: 20;
  }
  .b-tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #7E8798;
    font-size: 21px;
    font-weight: 700;
  }
  .b-tab.active {
    color: #F2F3F5;
  }
"""


def build_home_screen_inner(lang: str) -> str:
  """ネイティブ解像度のホーム画面（OpenAI FDE記事・ソース別タブ）。"""
  art = FEED_BY_ID["art-1792933326508-y1ms9"]
  openai_fav = favicon_url("https://openai.com")

  if lang == "ja":
    title = art["translations"]["ja"]["title"]
    summary = art["translations"]["ja"]["summary"]
    t_rec, t_src, t_tool = "おすすめ", "ソース別", "ツール別"
    c_all, c_openai, c_api, c_edit = "すべて", "OpenAI 公式", "OpenAI API...", "＋ 編集"
    tag_dev, tag_biz = "開発", "ビジネス"
    banner_title = "エンジニアが現場で顧客のAI実装を直接支援する独…"
    src_name = "OpenAI 公式"
    meta = "10月22日 · ChatGPT · 2/6"
    hint = "長押しで元記事へ"
    r_save, r_share, r_orig, r_hide = "保存", "共有", "元記事", "興味なし"
  else:
    # ENは日本語と同じ行数・ボリューム（見出し3行＋本文7〜8行）に合わせる
    title = (
      "What Is Forward Deployed Engineering at OpenAI? "
      "How Engineers Embed Inside Customer Teams to Ship AI"
    )
    summary = (
      "OpenAI detailed its Forward Deployed Engineer (FDE) role—specialists who work directly inside customer "
      "environments to deploy production AI systems. FDEs bridge model research and enterprise engineering, "
      "turning complex API integrations into working software alongside client teams. In the AI era, deep "
      "workflow integration and hands-on deployment are becoming the real differentiators beyond raw model specs."
    )
    t_rec, t_src, t_tool = "For you", "By source", "By tool"
    c_all, c_openai, c_api, c_edit = "All", "OpenAI Official", "OpenAI API...", "+ Edit"
    tag_dev, tag_biz = "Development", "Business"
    banner_title = "What is Forward Deployed Engineerin…"
    src_name = "OpenAI Official"
    meta = "Oct 22 · ChatGPT · 2/6"
    hint = "Long-press for original"
    r_save, r_share, r_orig, r_hide = "Save", "Share", "Original", "Not for me"

  return f"""
  <div class="app-home">
    {STATUS_BAR_SVG}
    <div class="top-tabs">
      <div class="t-tab">{t_rec}</div>
      <div class="t-tab active">{t_src}<div class="t-bar"></div></div>
      <div class="t-tab">{t_tool}</div>
    </div>
    <div class="chip-row">
      <div class="chip">{c_all}</div>
      <div class="chip active">
        <img class="chip-ico" src="{openai_fav}">
        <span>{c_openai}</span>
      </div>
      <div class="chip">
        <img class="chip-ico" src="{openai_fav}">
        <span>{c_api}</span>
      </div>
      <div class="chip dashed">{c_edit}</div>
    </div>

    <div class="banner-card">
      <div class="banner-circle">O</div>
      <div class="banner-arc"></div>
      <div class="banner-tags">
        <span class="b-tag primary">ChatGPT</span>
        <span class="b-tag"><span class="dot"></span>{tag_dev}</span>
        <span class="b-tag">{tag_biz}</span>
      </div>
      <div class="banner-bottom">
        <div class="banner-src-ico"><img src="{openai_fav}"></div>
        <div class="banner-txt">
          <div class="banner-hl">{esc(banner_title)}</div>
          <div class="banner-sub">{src_name}</div>
        </div>
        <div class="banner-hint">{hint}</div>
      </div>
    </div>

    <div class="article-body">
      <div class="src-row">
        <div class="src-ico"><img src="{openai_fav}"></div>
        <div>
          <div class="src-title">{src_name}</div>
          <div class="src-meta">{meta}</div>
        </div>
      </div>

      <div class="main-Area">
        <div class="text-col">
          <div class="art-h1 {"en" if lang == "en" else ""}">{esc(title)}</div>
          <div class="art-sum {"en" if lang == "en" else ""}">{esc(summary)}</div>
        </div>
        <div class="rail-col">
          <div class="rail-btn">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
            <span>{r_save}</span>
          </div>
          <div class="rail-btn">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span>{r_share}</span>
          </div>
          <div class="rail-btn">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>{r_orig}</span>
          </div>
          <div class="rail-btn">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="5.7" y1="5.7" x2="18.3" y2="18.3"/></svg>
            <span>{r_hide}</span>
          </div>
        </div>
      </div>
    </div>

    {bottom_tabs_html("home", lang)}
  </div>
  """


HOME_INNER_CSS = """
  .app-home {
    width: 100%; height: 100%;
    background: #0B1512;
    color: #F2F3F5;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .top-tabs {
    display: flex;
    justify-content: center;
    gap: 58px;
    padding: 12px 0 18px 0;
    font-size: 28px;
    font-weight: 800;
    color: #9AA4B2;
  }
  .t-tab { position: relative; padding-bottom: 12px; }
  .t-tab.active { color: #F2F3F5; }
  .t-bar {
    position: absolute;
    left: -8px; right: -8px; bottom: 0;
    height: 6px; border-radius: 3px;
    background: #10A37F;
  }
  .chip-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 6px 32px 22px 32px;
    overflow: hidden;
  }
  .chip {
    height: 76px;
    padding: 0 28px;
    border-radius: 38px;
    border: 2px solid #2A3A35;
    background: #111E1A;
    color: #D5DBE3;
    font-size: 25px;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 14px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .chip.active {
    background: #10A37F;
    border-color: #10A37F;
    color: #07120E;
  }
  .chip.dashed {
    border-style: dashed;
    border-color: #556660;
    background: rgba(17,30,26,0.85);
    color: #F2F3F5;
  }
  .chip-ico {
    width: 38px; height: 38px;
    border-radius: 10px;
    background: #fff;
    padding: 3px;
  }
  .banner-card {
    margin: 0 32px;
    height: 318px;
    border-radius: 34px;
    background: linear-gradient(135deg, #122821 0%, #0E1F1A 100%);
    border: 2px solid #1E3A31;
    position: relative;
    overflow: hidden;
    padding: 26px 28px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .banner-circle {
    position: absolute;
    right: -30px; top: -40px;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: rgba(16, 163, 127, 0.22);
    color: rgba(16, 163, 127, 0.18);
    font-size: 180px;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .banner-tags {
    display: flex; gap: 14px; position: relative; z-index: 2;
  }
  .b-tag {
    padding: 10px 22px;
    border-radius: 24px;
    background: rgba(10, 18, 15, 0.78);
    border: 1.5px solid #26453B;
    color: #E2E8F0;
    font-size: 22px;
    font-weight: 800;
    display: flex; align-items: center; gap: 8px;
  }
  .b-tag.primary {
    background: #10A37F;
    border-color: #10A37F;
    color: #06130F;
  }
  .b-tag .dot {
    width: 11px; height: 11px; border-radius: 50%; background: #10A37F;
  }
  .banner-bottom {
    display: flex;
    align-items: flex-end;
    gap: 20px;
    position: relative; z-index: 2;
  }
  .banner-src-ico {
    width: 68px; height: 68px;
    border-radius: 18px;
    background: #1C2E28;
    border: 2px solid #2E4B42;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .banner-src-ico img {
    width: 46px; height: 46px; border-radius: 10px; background: #fff; padding: 3px;
  }
  .banner-txt { flex: 1; min-width: 0; }
  .banner-hl {
    font-size: 27px; font-weight: 900; line-height: 1.32; color: #fff;
    margin-bottom: 6px;
  }
  .banner-sub { font-size: 21px; font-weight: 700; color: #9CB3AB; }
  .banner-hint {
    padding: 9px 18px;
    border-radius: 18px;
    background: rgba(0,0,0,0.65);
    color: #D5DBE3;
    font-size: 18px;
    font-weight: 700;
    white-space: nowrap;
  }
  .article-body {
    padding: 28px 32px 0 32px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .src-row {
    display: flex; align-items: center; gap: 20px;
    margin-bottom: 22px;
  }
  .src-ico {
    width: 66px; height: 66px;
    border-radius: 33px;
    background: #182823;
    border: 2px solid #28423A;
    display: flex; align-items: center; justify-content: center;
  }
  .src-ico img {
    width: 42px; height: 42px; border-radius: 9px; background: #fff; padding: 3px;
  }
  .src-title { font-size: 27px; font-weight: 900; color: #F2F3F5; }
  .src-meta { font-size: 22px; font-weight: 600; color: #94A39E; margin-top: 2px; }
  .main-Area {
    display: flex;
    gap: 22px;
    flex: 1;
  }
  .text-col { flex: 1; }
  .art-h1 {
    font-size: 37px;
    font-weight: 900;
    line-height: 1.36;
    color: #FFFFFF;
    margin-bottom: 22px;
    letter-spacing: -0.01em;
  }
  .art-h1.en {
    font-size: 38px;
    line-height: 1.3;
    margin-bottom: 24px;
  }
  .art-sum {
    font-size: 28.5px;
    font-weight: 500;
    line-height: 1.58;
    color: #D5DBE3;
  }
  .art-sum.en {
    font-size: 30px;
    line-height: 1.52;
  }
  .rail-col {
    width: 96px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 90px;
    gap: 32px;
  }
  .rail-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: #D3D8E0;
    font-size: 19px;
    font-weight: 700;
    text-align: center;
  }
"""


def hero_html(lang: str) -> str:
  """01: ダークカードヒーロー（吹き出し枠なし・文字は全白・アイコン2つとAIだけライム）。"""
  home_inner = build_home_screen_inner(lang)
  if lang == "ja":
    kicker = "隙間時間でAIビジネスの波に乗る"
    h1 = "AIニュースを、<br>1枚ずつスワイプ"
    sub = "通勤・休憩・隙間時間に、<br>要点だけサクッと。"
    f1_t = "長文は読まなくていい"
    f1_b = "公式発表も開発トレンドも、<br>1枚の短い要約カードに凝縮"
    f2_t = "ツール×ジャンルで自分専用に"
    f2_b = "興味のあるAIツールと情報源だけを<br>選んで迷わず追える"
  else:
    kicker = "Ride the AI business wave in spare moments"
    h1 = "Swipe AI News,<br>One Card at a Time"
    sub = "Just the essentials—on your<br>commute or in a break."
    f1_t = "Skip the long reads"
    f1_b = "Model launches and builder news<br>distilled into one short card"
    f2_t = "Tailored by tool × genre"
    f2_b = "Follow only the AI tools and sources<br>you want to stay on top of"

  return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{
    width: {W}px; height: {H}px; overflow: hidden;
    background: #000;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }}
  .card {{
    position: absolute;
    left: 28px; top: 32px;
    width: {W - 56}px; height: {H - 64}px;
    background: #141416;
    border: 2px solid #2a2a2e;
    border-radius: 76px;
    overflow: hidden;
    padding: 96px 76px 0 76px;
  }}
  .kicker {{
    color: #FFFFFF;
    font-size: {"48px" if lang == "ja" else "43px"};
    font-weight: 800;
    text-align: center;
    letter-spacing: 0.02em;
    margin-bottom: {"34px" if lang == "ja" else "30px"};
  }}
  .h1 {{
    color: #FFFFFF;
    font-size: {"116px" if lang == "ja" else "110px"};
    font-weight: 900;
    line-height: 1.2;
    text-align: center;
    letter-spacing: -0.02em;
    margin-bottom: {"34px" if lang == "ja" else "30px"};
  }}
  .sub {{
    color: #FFFFFF;
    font-size: {"46px" if lang == "ja" else "43px"};
    font-weight: 800;
    line-height: 1.42;
    text-align: center;
    margin-bottom: {"58px" if lang == "ja" else "52px"};
  }}
  .feats {{
    display: flex;
    flex-direction: column;
    gap: {"46px" if lang == "ja" else "40px"};
    margin-bottom: {"56px" if lang == "ja" else "50px"};
    padding-left: 8px;
  }}
  .feat {{
    display: flex;
    align-items: center;
    gap: 36px;
  }}
  .feat-icon {{
    width: 112px; height: 112px;
    border-radius: 28px;
    background: #1C2320;
    border: 2px solid #2A3832;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }}
  .feat-title {{
    color: #FFFFFF;
    font-size: {"48px" if lang == "ja" else "45px"};
    font-weight: 900;
    line-height: 1.28;
    margin-bottom: 10px;
  }}
  .feat-body {{
    color: #FFFFFF;
    font-size: {"36px" if lang == "ja" else "34px"};
    font-weight: 700;
    line-height: 1.44;
  }}
  .brand {{
    color: #FFFFFF;
    font-size: 78px;
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.05;
    padding-left: 8px;
    margin-top: 6px;
    position: relative;
    z-index: 6;
  }}
  .brand-dot {{
    display: inline-block;
    color: #B6F24A;
  }}
  .phone-stage {{
    position: absolute;
    right: -195px;
    bottom: -430px;
    width: 960px;
    height: 1900px;
    perspective: 2200px;
    z-index: 3;
  }}
  .phone-3d {{
    width: 862px;
    height: 1852px;
    background: linear-gradient(180deg, #e8e9ec 0%, #b8bac0 50%, #dcdfe4 100%);
    border-radius: 112px;
    padding: 18px;
    box-shadow:
      -32px 40px 90px rgba(0,0,0,0.78),
      -6px 10px 0px #8d9098,
      inset 0 0 3px rgba(255,255,255,0.9);
    transform: rotate(-28deg) rotateX(12deg) rotateY(-8deg) scale(0.86);
    transform-origin: center center;
  }}
  .phone-bezel {{
    width: 100%; height: 100%;
    background: #0b0f14;
    border-radius: 96px;
    padding: 14px;
    overflow: hidden;
  }}
  .phone-screen {{
    width: 100%; height: 100%;
    border-radius: 84px;
    overflow: hidden;
    background: #0B1512;
  }}
  {COMMON_APP_CSS}
  {HOME_INNER_CSS}
</style></head>
<body>
  <div class="card">
    <div class="kicker">{kicker}</div>
    <div class="h1">{h1}</div>
    <div class="sub">{sub}</div>

    <div class="feats">
      <div class="feat">
        <div class="feat-icon">
          <!-- Swipe cards icon -->
          <svg width="68" height="68" viewBox="0 0 64 64" fill="none" stroke="#B6F24A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="14" y="14" width="36" height="42" rx="7"/>
            <path d="M20 8h28a6 6 0 0 1 6 6v30"/>
            <line x1="23" y1="28" x2="41" y2="28"/>
            <line x1="23" y1="38" x2="35" y2="38"/>
          </svg>
        </div>
        <div>
          <div class="feat-title">{f1_t}</div>
          <div class="feat-body">{f1_b}</div>
        </div>
      </div>

      <div class="feat">
        <div class="feat-icon">
          <!-- Sliders / filter icon -->
          <svg width="68" height="68" viewBox="0 0 64 64" fill="none" stroke="#B6F24A" stroke-width="5" stroke-linecap="round">
            <line x1="10" y1="18" x2="54" y2="18"/>
            <circle cx="24" cy="18" r="6" fill="#1C2320"/>
            <line x1="10" y1="34" x2="54" y2="34"/>
            <circle cx="42" cy="34" r="6" fill="#1C2320"/>
            <line x1="10" y1="50" x2="54" y2="50"/>
            <circle cx="28" cy="50" r="6" fill="#1C2320"/>
          </svg>
        </div>
        <div>
          <div class="feat-title">{f2_t}</div>
          <div class="feat-body">{f2_b}</div>
        </div>
      </div>
    </div>

    <div class="brand">Fast News <span class="brand-dot">AI</span></div>

    <div class="phone-stage">
      <div class="phone-3d">
        <div class="phone-bezel">
          <div class="phone-screen">
            {home_inner}
          </div>
        </div>
      </div>
    </div>
  </div>
</body></html>
"""


def calai_frame_wrap(line1: str, line2: str, lang: str, status_bg: str, inner_html: str, extra_css: str) -> str:
  return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  html, body {{
    width: {W}px; height: {H}px; overflow: hidden;
    background: #000;
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
    -webkit-font-smoothing: antialiased;
  }}
  .card {{
    position: absolute;
    left: 28px; top: 32px;
    width: {W - 56}px; height: {H - 64}px;
    background: #141416;
    border: 2px solid #2a2a2e;
    border-radius: 76px;
    overflow: hidden;
  }}
  .headline {{
    position: absolute;
    top: 225px; left: 0; right: 0;
    text-align: center;
    color: #fff;
    font-size: {"112px" if lang == "ja" else "106px"};
    font-weight: 900;
    line-height: 1.24;
    letter-spacing: -0.02em;
  }}
  .phone {{
    position: absolute;
    left: 50%;
    top: 640px;
    transform: translateX(-50%);
    width: 890px;
    height: 1980px;
    background: linear-gradient(180deg, #e8e9ec 0%, #b8bac0 50%, #dcdfe4 100%);
    border-radius: 118px;
    padding: 18px;
    box-shadow:
      0 40px 90px rgba(0,0,0,0.75),
      inset 0 0 3px rgba(255,255,255,0.9);
  }}
  .phone-inner {{
    width: 100%; height: 100%;
    background: #0a0b0e;
    border-radius: 102px;
    padding: 14px;
  }}
  .screen {{
    width: 100%; height: 100%;
    border-radius: 90px;
    overflow: hidden;
    background: {status_bg};
    display: flex;
    flex-direction: column;
    position: relative;
  }}
  {COMMON_APP_CSS}
  {extra_css}
</style></head>
<body>
  <div class="card">
    <div class="headline">{line1}<br>{line2}</div>
    <div class="phone">
      <div class="phone-inner">
        <div class="screen">
          {STATUS_BAR_SVG}
          {inner_html}
          {bottom_tabs_html("explore" if "explore-grid" in inner_html else "settings", lang)}
        </div>
      </div>
    </div>
  </div>
</body></html>
"""


def explore_shot_html(lang: str) -> str:
  """03: 探索グリッド（既存6枚の下に Stripe / n8n 等を続けて、下へスクロールできる感を出す）。"""
  ids = [
    ("art-1792969005386-yovkn", "Gemini", "#4285F4", "#fff", "10月13日" if lang == "ja" else "Oct 13"),
    ("art-1792968903014-uyw2n", "Cloudflare", "#F6821F", "#0E1117", "10月9日" if lang == "ja" else "Oct 9"),
    ("art-1792968500391-ou15m", "Vercel", "#E2E8F0", "#0E1117", "10月23日" if lang == "ja" else "Oct 23"),
    ("art-1792968482466-k964u", "Supabase", "#3ECF8E", "#0E1117", "10月15日" if lang == "ja" else "Oct 15"),
    ("art-1792968113507-q24s0", "Simon Willison...", "#B6F24A", "#0E1117", "10月22日" if lang == "ja" else "Oct 22"),
    ("art-1792967706224-fhkke", "PostHog", "#F9BD2B", "#0E1117", "9月15日" if lang == "ja" else "Sep 15"),
    ("art-1792936062936-vi6sg", "Stripe", "#818CF8", "#0E1117", "10月1日" if lang == "ja" else "Oct 1"),
    ("art-1792936054754-kmivq", "n8n", "#EA4B71", "#0E1117", "10月20日" if lang == "ja" else "Oct 20"),
    ("art-1792936035419-idsml", "GitHub Copilot", "#A855F7", "#0E1117", "10月22日" if lang == "ja" else "Oct 22"),
    ("art-1792935995692-ush9t", "ChatGPT", "#10A37F", "#0E1117", "10月22日" if lang == "ja" else "Oct 22"),
  ]
  cards_html = []
  for aid, badge, bg, fg, date_s in ids:
    a = FEED_BY_ID[aid]
    title = a["translations"][lang]["title"]
    src = a["source_name"]
    og = a.get("og_image_url")
    if og:
      thumb = f"""
        <div class="ex-thumb">
          <img class="ex-img" src="{esc(og)}">
          <span class="ex-badge" style="background:{bg};color:{fg}">{esc(badge)}</span>
          <div class="ex-src-bar">{esc(src)}</div>
        </div>
      """
    else:
      short_t = title.split("：")[-1] if "：" in title else title
      circle_txt = "O" if badge == "ChatGPT" else "SI"
      thumb = f"""
        <div class="ex-thumb fallback">
          <div class="fb-circle">{circle_txt}</div>
          <span class="ex-badge" style="background:{bg};color:{fg}">{esc(badge)}</span>
          <div class="fb-body">
            <div class="fb-hl">{esc(short_t[:36])}…</div>
            <div class="fb-src"><span class="fb-dot"></span>{esc(src)}</div>
          </div>
        </div>
      """
    cards_html.append(
      f"""
      <div class="ex-card">
        {thumb}
        <div class="ex-info">
          <div class="ex-title">{esc(title)}</div>
          <div class="ex-meta">{date_s} · {esc(src[:20])}…</div>
        </div>
      </div>
      """
    )

  placeholder = "AIニュース・ツール・キーワードを検索" if lang == "ja" else "Search AI news, tools, or keywords"
  inner = f"""
    <div class="ex-top">
      <div class="ex-search">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8E98A8" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg>
        <span>{placeholder}</span>
      </div>
      <div class="ex-save-btn">
        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#F2F3F5" stroke-width="2.2"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>
      </div>
    </div>
    <div class="explore-grid">
      {"".join(cards_html)}
    </div>
  """
  css = """
    .ex-top {
      display: flex; align-items: center; gap: 18px;
      padding: 8px 28px 18px 28px;
    }
    .ex-search {
      flex: 1; height: 78px;
      border-radius: 39px;
      background: #161C28;
      border: 2px solid #263042;
      display: flex; align-items: center; gap: 18px;
      padding: 0 28px;
      color: #8E98A8;
      font-size: 25px; font-weight: 600;
    }
    .ex-save-btn {
      width: 64px; height: 78px;
      display: flex; align-items: center; justify-content: center;
    }
    .explore-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 0 28px;
    }
    .ex-card {
      background: #161C28;
      border: 2px solid #263042;
      border-radius: 28px;
      overflow: hidden;
      display: flex; flex-direction: column;
    }
    .ex-thumb {
      height: 196px;
      position: relative;
      background: #1B2230;
      border-bottom: 2px solid #263042;
      overflow: hidden;
    }
    .ex-img {
      width: 100%; height: 100%; object-fit: cover; display: block;
    }
    .ex-badge {
      position: absolute; left: 16px; top: 14px;
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 19px; font-weight: 900;
      z-index: 2;
    }
    .ex-src-bar {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 20px 16px 8px 16px;
      background: linear-gradient(180deg, rgba(10,14,20,0) 0%, rgba(10,14,20,0.88) 100%);
      color: #F2F3F5;
      font-size: 18px; font-weight: 800;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ex-thumb.fallback {
      background: #18231E;
      padding: 16px;
      display: flex; flex-direction: column; justify-content: flex-end;
    }
    .fb-circle {
      position: absolute; right: -16px; top: -18px;
      width: 140px; height: 140px; border-radius: 50%;
      background: rgba(182,242,74,0.16);
      color: rgba(182,242,74,0.22);
      font-size: 68px; font-weight: 900;
      display: flex; align-items: center; justify-content: center;
    }
    .fb-hl {
      font-size: 21px; font-weight: 900; color: #fff; line-height: 1.28;
      margin-bottom: 6px;
    }
    .fb-src {
      font-size: 18px; font-weight: 700; color: #B8C4BE;
      display: flex; align-items: center; gap: 8px;
    }
    .fb-dot {
      width: 10px; height: 10px; border-radius: 50%; background: #B6F24A;
    }
    .ex-info {
      padding: 16px 18px 18px 18px;
    }
    .ex-title {
      font-size: 23px; font-weight: 800; color: #F2F3F5;
      line-height: 1.36;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .ex-meta {
      font-size: 18px; font-weight: 600; color: #8E98A8;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
  """
  l1, l2 = ("最新AI動向を", "まとめてチェック") if lang == "ja" else ("Catch up on AI", "all in one view")
  return calai_frame_wrap(l1, l2, lang, "#0E1117", inner, css)


def manage_header_html(lang: str) -> str:
  if lang == "ja":
    back = "‹ 設定に戻る"
    apply_btn = "この設定でスワイプ開始"
    p_head = "いまの掛け算設定（①×②×③）で流れるニュース"
    p_all = "全情報源 × 全ツール × 全ジャンルのAIニュース（フル表示）（該当 255件）"
  else:
    back = "‹ Back to settings"
    apply_btn = "Apply and start swiping"
    p_head = "News that will flow with ①×②×③"
    p_all = "All sources × all tools × all genres (full feed) (255 matches)"

  return f"""
    <div class="mg-top">
      <div class="mg-back">{back}</div>
      <div class="mg-apply">{apply_btn}</div>
    </div>
    <div class="mg-preview">
      <div class="mg-p-head"><span class="mg-dot"></span>{p_head}</div>
      <div class="mg-p-all">{p_all}</div>
    </div>
  """


MANAGE_COMMON_CSS = """
  .mg-top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 30px 20px 30px;
  }
  .mg-back {
    color: #B6F24A; font-size: 27px; font-weight: 800;
  }
  .mg-apply {
    background: #B6F24A; color: #0B110D;
    font-size: 25px; font-weight: 900;
    padding: 20px 34px; border-radius: 44px;
  }
  .mg-preview {
    margin: 0 30px 24px 30px;
    padding: 24px 28px;
    border-radius: 28px;
    background: #182314;
    border: 2.5px solid #B6F24A;
  }
  .mg-p-head {
    color: #B6F24A; font-size: 22px; font-weight: 800;
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 10px;
  }
  .mg-dot {
    width: 14px; height: 14px; border-radius: 50%; background: #B6F24A;
  }
  .mg-p-all {
    color: #F2F3F5; font-size: 24px; font-weight: 800; line-height: 1.38;
  }
  .mg-panel {
    margin: 0 30px;
    padding: 32px 28px;
    border-radius: 34px;
    background: #141923;
    border: 2px solid #232B3A;
  }
  .mg-sec-title {
    color: #F2F3F5; font-size: 30px; font-weight: 900; margin-bottom: 8px;
  }
  .mg-sec-sub {
    color: #8E98A8; font-size: 22px; font-weight: 600; margin-bottom: 26px;
  }
"""


GENRE_SVGS = {
  "アップデート": '<path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/>',
  "個人開発・収益化": '<path d="M12 2l3 6 6 .9-4.3 4.2 1 6-5.7-3-5.7 3 1-6L3 8.9 9 8l3-6z"/>',
  "マーケ・集客・ASO": '<path d="M3 17l6-6 4 4 8-8M14 7h7v7"/>',
  "SNS・ショート動画": '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 9l5 3-5 3V9z"/>',
  "課金・ペイウォール": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  "コスト・API料金": '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.8-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2"/>',
  "開発": '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  "ビジネス": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  "画像生成": '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="#B6F24A"/><path d="M21 15l-5-5L5 21"/>',
  "動画": '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4V8z"/>',
  "音声": '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
  "研究": '<path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3"/>',
  "セキュリティ": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
}

GENRE_EN = {
  "アップデート": "Updates",
  "個人開発・収益化": "Indie & monetization",
  "マーケ・集客・ASO": "Marketing & ASO",
  "SNS・ショート動画": "Social & short video",
  "課金・ペイウォール": "Billing & paywalls",
  "コスト・API料金": "Cost & API pricing",
  "開発": "Development",
  "ビジネス": "Business",
  "画像生成": "Image generation",
  "動画": "Video",
  "音声": "Audio",
  "研究": "Research",
  "セキュリティ": "Security",
}


def genres_shot_html(lang: str) -> str:
  """04: ジャンルで絞りこむ（完全ベクター）。"""
  pills = []
  for g, svg_inner in GENRE_SVGS.items():
    label = g if lang == "ja" else GENRE_EN[g]
    pills.append(
      f'<div class="g-pill">'
      f'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#B6F24A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">{svg_inner}</svg>'
      f'<span>{esc(label)}</span>'
      f"</div>"
    )

  if lang == "ja":
    u_title = "フィードを絞り込む（掛け算フィルタ）"
    u_desc = "ここで選んだ「① ジャンル × ② AIツール × ③ 情報源（ソース）」のすべてに一致するニュースが表示されます（未選択の項目は「すべて対象」になります）。"
    s_head = "① ジャンル（分野）で絞る"
    s_sub = "複数選択可・未選択なら全分野が対象"
    intro_block = f'<div class="mg-intro"><div class="mg-u-title">{u_title}</div><div class="mg-u-desc">{u_desc}</div></div>'
  else:
    s_head = "① Filter by genre"
    s_sub = "Multi-select · leave empty for all genres"
    intro_block = ""

  inner = f"""
    {manage_header_html(lang)}
    {intro_block}
    <div class="mg-panel">
      <div class="mg-sec-title">{s_head}</div>
      <div class="mg-sec-sub">{s_sub}</div>
      <div class="g-wrap">
        {"".join(pills)}
      </div>
    </div>
  """
  css = (
    MANAGE_COMMON_CSS
    + """
    .mg-intro { padding: 0 30px 24px 30px; }
    .mg-u-title { font-size: 38px; font-weight: 900; color: #F2F3F5; margin-bottom: 12px; }
    .mg-u-desc { font-size: 23px; font-weight: 500; color: #9AA4B2; line-height: 1.48; }
    .g-wrap { display: flex; flex-wrap: wrap; gap: 18px; }
    .g-pill {
      height: 82px;
      padding: 0 30px;
      border-radius: 41px;
      background: #1B2230;
      border: 2px solid #384357;
      color: #F2F3F5;
      font-size: 25px;
      font-weight: 800;
      display: flex; align-items: center; gap: 14px;
    }
  """
  )
  l1, l2 = ("ジャンルで", "絞りこむ") if lang == "ja" else ("Filter", "by genre")
  return calai_frame_wrap(l1, l2, lang, "#0E1117", inner, css)


TOOLS_LIST = [
  ("Claude", "https://www.anthropic.com"),
  ("ChatGPT", "https://openai.com"),
  ("Gemini", "https://deepmind.google"),
  ("Cursor", "https://www.cursor.com"),
  ("Windsurf", "https://windsurf.com"),
  ("Bolt", "https://bolt.new"),
  ("Lovable", "https://lovable.dev"),
  ("Devin", "https://cognition.ai"),
  ("RevenueCat", "https://www.revenuecat.com"),
  ("Stripe", "https://stripe.com"),
  ("PostHog", "https://posthog.com"),
  ("Appfigures", "https://appfigures.com"),
  ("Resend", "https://resend.com"),
  ("CapCut", "https://www.capcut.com"),
  ("HeyGen", "https://www.heygen.com"),
  ("Framer", "https://www.framer.com"),
  ("Vercel", "https://vercel.com"),
  ("Supabase", "https://supabase.com"),
  ("Cloudflare", "https://www.cloudflare.com"),
  ("Dify", "https://dify.ai"),
  ("n8n", "https://n8n.io"),
  ("Ollama", "https://ollama.com"),
  ("OpenRouter", "https://openrouter.ai"),
  ("GitHub Copilot", "https://github.com"),
  ("Perplexity", "https://www.perplexity.ai"),
  ("Grok", "https://x.ai"),
  ("Midjourney", "https://www.midjourney.com"),
  ("Runway", "https://runwayml.com"),
  ("ElevenLabs", "https://elevenlabs.io"),
  ("Notion", "https://www.notion.so"),
  ("Mistral", "https://mistral.ai"),
  ("Meta AI", "https://ai.meta.com"),
]


def tools_shot_html(lang: str) -> str:
  """05: AIツールで絞りこむ（完全ベクター＋下までぎっしり続く一覧）。"""
  pills = []
  for name, url in TOOLS_LIST:
    fav = favicon_url(url)
    pills.append(
      f'<div class="t-pill">'
      f'<img class="t-fav" src="{fav}">'
      f'<span>{esc(name)}</span>'
      f"</div>"
    )
  if lang == "ja":
    s_head = "② AIツール・モデルで絞る"
    s_sub = "複数選択可・未選択なら全ツールが対象"
    s3_head = "③ 情報源（ソース）で絞る"
    s3_sub = "カテゴリごとに一括オン／オフも可能"
    s3_cat = "公式ブログ・モデル提供元"
  else:
    s_head = "② Filter by AI tool / model"
    s_sub = "Multi-select · leave empty for all tools"
    s3_head = "③ Filter by source"
    s3_sub = "Toggle individual feeds or whole categories"
    s3_cat = "Official model & lab blogs"

  inner = f"""
    {manage_header_html(lang)}
    <div class="mg-panel" style="padding-bottom: 34px; margin-bottom: 24px;">
      <div class="mg-sec-title">{s_head}</div>
      <div class="mg-sec-sub">{s_sub}</div>
      <div class="t-wrap">
        {"".join(pills)}
      </div>
    </div>
    <div class="mg-panel" style="padding-bottom: 80px;">
      <div class="mg-sec-title">{s3_head}</div>
      <div class="mg-sec-sub">{s3_sub}</div>
      <div style="color:#B6F24A; font-size:24px; font-weight:900;">{s3_cat}</div>
    </div>
  """
  css = (
    MANAGE_COMMON_CSS
    + """
    .t-wrap { display: flex; flex-wrap: wrap; gap: 16px; }
    .t-pill {
      height: 78px;
      padding: 0 28px 0 20px;
      border-radius: 39px;
      background: #1B2230;
      border: 2px solid #384357;
      color: #F2F3F5;
      font-size: 25px;
      font-weight: 800;
      display: flex; align-items: center; gap: 14px;
    }
    .t-fav {
      width: 38px; height: 38px;
      border-radius: 10px;
      background: #fff;
      padding: 3px;
    }
  """
  )
  l1, l2 = ("AIツールで", "絞りこむ") if lang == "ja" else ("Filter", "by tool")
  return calai_frame_wrap(l1, l2, lang, "#0E1117", inner, css)


SOURCES_EDITOR_GROUP = [
  ("Cursor Changelog", "https://www.cursor.com", "AIコードエディタ Cursor 新機能・更新", "Cursor AI editor updates"),
  ("Windsurf (Codeium) Changelog", "https://windsurf.com", "エージェント型IDE Windsurf / Cascade 更新", "Windsurf / Cascade agentic IDE updates"),
  ("Bolt.new (StackBlitz) Blog", "https://bolt.new", "ブラウザ完結フルスタックAI生成 Bolt.new 更新", "Bolt.new in-browser full-stack AI updates"),
  ("Lovable Blog / Changelog", "https://lovable.dev", "個人開発で人気のAIアプリビルダー Lovable 新機能", "Lovable AI app builder features"),
  ("Cognition (Devin) Blog", "https://cognition.ai", "自律型AIエンジニア Devin アップデート・料金", "Devin autonomous engineer updates & pricing"),
  ("GitHub Copilot Changelog", "https://github.com", "GitHub Copilot 機能追加・モデル対応", "GitHub Copilot features & model support"),
]

SOURCES_INFRA_GROUP = [
  ("Vercel / v0 Blog", "https://vercel.com", "v0・AI SDK・Next.js 個人開発インフラ更新", "v0, AI SDK & Next.js indie infra updates"),
  ("Supabase Blog", "https://supabase.com", "BaaS・pgvector・MCP連携リリース", "BaaS, pgvector & MCP releases"),
  ("Cloudflare Workers AI / Blog", "https://www.cloudflare.com", "格安エッジAI・Workers・R2・D1 新機能", "Affordable edge AI, Workers, R2 & D1 features"),
  ("Dify Blog / Releases", "https://dify.ai", "OSSのAIワークフロー・エージェント構築 Dify", "Dify open-source AI workflows & agents"),
  ("n8n Blog (AI Automation)", "https://n8n.io", "セルフホスト可能なAI自動化・マーケ自動化連携", "Self-hosted AI automation & marketing ops"),
  ("Ollama Blog", "https://ollama.com", "Mac/PC で動かすローカルLLM・APIコストゼロ運用", "Local LLMs on Mac/PC with zero API cost"),
  ("OpenRouter Announcements", "https://openrouter.ai", "全LLM統合API・無料枠・単価比較の更新", "Unified LLM APIs, free tiers & rate comparisons"),
  ("LangChain / LangGraph Blog", "https://www.langchain.com", "AIエージェント構築・LangGraph ワークフロー更新", "AI agents & LangGraph workflow updates"),
]


def sources_shot_html(lang: str) -> str:
  """06: 欲しい情報だけを狙い撃ち（下まで続く複数カテゴリの情報源トグル一覧）。"""
  def render_group(items):
    out = []
    for name, url, kind_ja, kind_en in items:
      fav = favicon_url(url)
      desc = kind_ja if lang == "ja" else kind_en
      out.append(
        f"""
        <div class="s-row">
          <div class="s-ico"><img src="{fav}"></div>
          <div class="s-txt">
            <div class="s-name">{esc(name)}</div>
            <div class="s-desc">{esc(desc)}</div>
          </div>
          <div class="s-toggle"><div class="s-knob"></div></div>
        </div>
        """
      )
    return "".join(out)

  # 上のカテゴリ末尾2件を見せてから、次のカテゴリ8件がずらっと下に続く構成（実機スクショと同じ密度）
  rows_top = render_group(SOURCES_EDITOR_GROUP[-2:])
  rows_infra = render_group(SOURCES_INFRA_GROUP)

  if lang == "ja":
    clr = "すべて解除"
    cat2 = "個人開発インフラ・自動化・ローカルLLM"
    cnt2 = "8 / 8 件オン"
  else:
    clr = "Clear all"
    cat2 = "Indie infra, automation & local LLM"
    cnt2 = "8 / 8 on"

  inner = f"""
    {manage_header_html(lang)}
    <div class="mg-panel" style="padding-top: 10px; padding-bottom: 120px;">
      <div class="s-list">
        {rows_top}
      </div>

      <div class="s-cat-head" style="margin-top:26px;">
        <div>
          <div class="s-cat-title">{cat2}</div>
          <div class="s-cat-cnt">{cnt2}</div>
        </div>
        <div class="s-clear">{clr}</div>
      </div>
      <div class="s-list">
        {rows_infra}
      </div>
    </div>
  """
  css = (
    MANAGE_COMMON_CSS
    + """
    .s-cat-head {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 18px;
      border-bottom: 2px solid #232B3A;
    }
    .s-cat-title { color: #B6F24A; font-size: 24px; font-weight: 900; margin-bottom: 6px; }
    .s-cat-cnt { color: #8E98A8; font-size: 21px; font-weight: 700; }
    .s-clear {
      padding: 14px 26px;
      border-radius: 30px;
      border: 2px solid #384357;
      background: #1B2230;
      color: #D5DBE3;
      font-size: 21px; font-weight: 800;
    }
    .s-row {
      display: flex; align-items: center; gap: 20px;
      padding: 20px 0;
      border-bottom: 1.5px solid #202836;
    }
    .s-ico {
      width: 68px; height: 68px;
      border-radius: 34px;
      background: #232B3B;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .s-ico img {
      width: 42px; height: 42px; border-radius: 10px; background: #fff; padding: 3px;
    }
    .s-txt { flex: 1; min-width: 0; }
    .s-name { color: #F2F3F5; font-size: 26px; font-weight: 900; margin-bottom: 4px; }
    .s-desc { color: #9AA4B2; font-size: 21px; font-weight: 600; line-height: 1.32; }
    .s-toggle {
      width: 96px; height: 56px;
      border-radius: 28px;
      background: #B6F24A;
      position: relative;
      flex-shrink: 0;
    }
    .s-knob {
      position: absolute; right: 5px; top: 5px;
      width: 46px; height: 46px;
      border-radius: 23px;
      background: #141923;
    }
  """
  )
  l1, l2 = ("欲しい情報だけを", "狙い撃ち") if lang == "ja" else ("Target only the", "sources you want")
  return calai_frame_wrap(l1, l2, lang, "#0E1117", inner, css)


def render_html(html: str, out_png: Path) -> None:
  """2倍の Retina 解像度（2640×5736）で描画してから LANCZOS で 1320×2868 に縮小。"""
  with tempfile.TemporaryDirectory() as tmp:
    hp = Path(tmp) / "page.html"
    raw_out = Path(tmp) / "shot.png"
    hp.write_text(html, encoding="utf-8")
    cmd = [
      CHROME,
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=2",
      "--virtual-time-budget=4000",
      f"--window-size={W},{H + 200}",
      f"--screenshot={raw_out}",
      f"file://{hp}",
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    im = Image.open(raw_out).convert("RGB")
    target_2x = (W * 2, H * 2)
    if im.size != target_2x:
      im = im.crop((0, 0, W * 2, H * 2))
    im = im.resize((W, H), Image.Resampling.LANCZOS)
    im.save(out_png, "PNG", optimize=True)
    print(f"wrote {out_png.relative_to(ROOT)} ({im.size[0]}x{im.size[1]}) [2x supersampled]")


def main() -> None:
  OUT_JA.mkdir(parents=True, exist_ok=True)
  OUT_EN.mkdir(parents=True, exist_ok=True)
  for lang, out_dir in (("ja", OUT_JA), ("en", OUT_EN)):
    render_html(hero_html(lang), out_dir / "01-hero.png")
    render_html(explore_shot_html(lang), out_dir / "03-explore.png")
    render_html(genres_shot_html(lang), out_dir / "04-genres.png")
    render_html(tools_shot_html(lang), out_dir / "05-tools.png")
    render_html(sources_shot_html(lang), out_dir / "06-sources.png")


if __name__ == "__main__":
  main()
