#!/usr/bin/env python3
"""Chrome ヘッドレスで App Preview 用のオーバーレイ PNG を描画し、LP動画と合成する。"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
REPO = ROOT.parent.parent
LP_ASSETS = REPO / "landing" / "ainews" / "assets"
OUT_JA = ROOT / "submit" / "ja"
OUT_EN = ROOT / "submit" / "en"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

W, H = 1320, 2868
FPS = 30
# App Store Connect: App Preview は 15〜30 秒＋音声必須
MIN_PREVIEW_SECONDS = 15.5

# render-store-html.py の .phone / .screen と一致する座標
# card left=28 top=32, phone center X=660, top=32+640=672, width=890 height=1980
# inner pad=18+14=32 → screen left = 660 - 445 + 32 = 247, top = 672 + 32 = 704
# screen width = 890 - 64 = 826, status height = 86 → video top = 704 + 86 = 790
# screen height = 1980 - 64 = 1916 → video height = 1916 - 86 = 1830
# card bottom = 2868 - 32 = 2836 → visible video height = 2836 - 790 = 2046 (screen ends at 2620)
SCREEN_X = 247
SCREEN_Y = 704
SCREEN_W = 826
SCREEN_H = 1916
SCREEN_R = 90
STATUS_H = 86
VID_X = SCREEN_X
VID_Y = SCREEN_Y + STATUS_H
VID_W = SCREEN_W
VID_H = SCREEN_H - STATUS_H  # 1830


STATUS_BAR_SVG = """
<div class="ios-status">
  <span class="ios-time">9:41</span>
  <div class="ios-island"></div>
  <div class="ios-right">
    <svg width="20" height="13" viewBox="0 0 20 13" fill="white">
      <rect x="0" y="9" width="3.2" height="4" rx="1"/>
      <rect x="4.8" y="6.5" width="3.2" height="6.5" rx="1"/>
      <rect x="9.6" y="3.5" width="3.2" height="9.5" rx="1"/>
      <rect x="14.4" y="0" width="3.2" height="13" rx="1"/>
    </svg>
    <svg width="18" height="13" viewBox="0 0 18 13" fill="white">
      <path d="M9 10.2a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm-4.1-2.1a6 6 0 0 1 8.2 0l1.3-1.4a8 8 0 0 0-10.8 0l1.3 1.4zm-3-3a10.2 10.2 0 0 1 14.2 0l1.4-1.4a12.2 12.2 0 0 0-17 0l1.4 1.4z"/>
    </svg>
    <svg width="28" height="13" viewBox="0 0 28 13" fill="none">
      <rect x="0.7" y="0.7" width="23.6" height="11.6" rx="3.2" stroke="white" stroke-opacity="0.45" stroke-width="1.2"/>
      <rect x="2.4" y="2.4" width="20.2" height="8.2" rx="1.8" fill="white"/>
      <path d="M25.6 4.2v4.6a2.2 2.2 0 0 0 0-4.6z" fill="white" fill-opacity="0.45"/>
    </svg>
  </div>
</div>
"""


def frame_html(line1: str, line2: str, lang: str) -> str:
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
    top: 230px; left: 0; right: 0;
    text-align: center;
    color: #fff;
    font-size: {"116px" if lang == "ja" else "108px"};
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
    background: #0c1411;
    display: flex;
    flex-direction: column;
  }}
  .ios-status {{
    height: 86px;
    padding: 0 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #0c1411;
    color: #fff;
    position: relative;
    flex-shrink: 0;
  }}
  .ios-time {{
    font-size: 30px; font-weight: 700; letter-spacing: -0.02em;
  }}
  .ios-island {{
    position: absolute;
    left: 50%; top: 18px;
    transform: translateX(-50%);
    width: 214px; height: 52px;
    background: #000;
    border-radius: 30px;
  }}
  .ios-right {{
    display: flex; align-items: center; gap: 12px;
    transform: scale(1.15);
    transform-origin: right center;
  }}
  .hole {{
    flex: 1;
    background: #00ff00;
  }}
</style></head>
<body>
  <div class="card">
    <div class="headline">{line1}<br>{line2}</div>
    <div class="phone">
      <div class="phone-inner">
        <div class="screen">
          {STATUS_BAR_SVG}
          <div class="hole"></div>
        </div>
      </div>
    </div>
  </div>
</body></html>
"""


def build_chrome_png(line1: str, line2: str, lang: str, out_png: Path) -> None:
  with tempfile.TemporaryDirectory() as tmp:
    hp = Path(tmp) / "p.html"
    shot = Path(tmp) / "s.png"
    hp.write_text(frame_html(line1, line2, lang), encoding="utf-8")
    subprocess.run(
      [
        CHROME,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        f"--window-size={W},{H + 200}",
        f"--screenshot={shot}",
        f"file://{hp}",
      ],
      check=True,
      capture_output=True,
    )
    im = Image.open(shot).convert("RGBA").crop((0, 0, W, H))
    # 画面の動画領域（角丸の内側・ステータスバー下）を透明に抜く
    screen_mask = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(screen_mask)
    sd.rounded_rectangle(
      (SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W - 1, SCREEN_Y + SCREEN_H - 1),
      radius=SCREEN_R,
      fill=255,
    )
    # ステータスバー部分は抜かない（残す）
    sd.rectangle((SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W, VID_Y - 1), fill=0)
    # invert → 255 = keep chrome, 0 = hole for video
    keep = ImageChops.invert(screen_mask)
    r, g, b, _ = im.split()
    im = Image.merge("RGBA", (r, g, b, keep))
    im.save(out_png)


def encode_preview(src_mp4: Path, chrome_png: Path, out_mp4: Path, out_poster: Path) -> None:
  # LP動画の上部ステータスバー（約50px / 844px）を切り落としてから画面穴へフィット
  filter_complex = (
    f"color=c=black:s={W}x{H}:r={FPS}[bg];"
    f"[0:v]crop=iw:ih-50:0:50,"
    f"scale={VID_W}:{VID_H}:force_original_aspect_ratio=increase,"
    f"crop={VID_W}:{VID_H},fps={FPS},setsar=1[vid];"
    f"[bg][vid]overlay={VID_X}:{VID_Y}:shortest=1[base];"
    f"[1:v]format=rgba[chr];"
    f"[base][chr]overlay=0:0:format=auto,format=yuv420p[out]"
  )
  raw_mp4 = out_mp4.with_suffix(".raw.mp4")
  subprocess.run(
    [
      "ffmpeg",
      "-y",
      "-i",
      str(src_mp4),
      "-i",
      str(chrome_png),
      "-filter_complex",
      filter_complex,
      "-map",
      "[out]",
      "-an",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-r",
      str(FPS),
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      str(raw_mp4),
    ],
    check=True,
    capture_output=True,
  )
  # 末尾フリーズで 15.5s 以上にし、無音ステレオを付与（ASC「再生時間が無効」対策）
  dur = float(
    subprocess.check_output(
      [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nw=1:nk=1",
        str(raw_mp4),
      ],
      text=True,
    ).strip()
  )
  pad = max(0.0, MIN_PREVIEW_SECONDS - dur)
  pad_fc = (
    f"[0:v]tpad=stop_mode=clone:stop_duration={pad:.3f},"
    f"fps={FPS},setsar=1,format=yuv420p[v]"
  )
  subprocess.run(
    [
      "ffmpeg",
      "-y",
      "-i",
      str(raw_mp4),
      "-f",
      "lavfi",
      "-i",
      "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-filter_complex",
      pad_fc,
      "-map",
      "[v]",
      "-map",
      "1:a",
      "-t",
      f"{MIN_PREVIEW_SECONDS:.3f}",
      "-c:v",
      "libx264",
      "-profile:v",
      "high",
      "-level",
      "4.2",
      "-pix_fmt",
      "yuv420p",
      "-r",
      str(FPS),
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-movflags",
      "+faststart",
      str(out_mp4),
    ],
    check=True,
    capture_output=True,
  )
  raw_mp4.unlink(missing_ok=True)
  subprocess.run(
    [
      "ffmpeg",
      "-y",
      "-ss",
      "0.8",
      "-i",
      str(out_mp4),
      "-frames:v",
      "1",
      "-q:v",
      "2",
      str(out_poster),
    ],
    check=True,
    capture_output=True,
  )
  print(f"wrote {out_mp4.relative_to(ROOT)} + {out_poster.name}")


def main() -> None:
  OUT_JA.mkdir(parents=True, exist_ok=True)
  OUT_EN.mkdir(parents=True, exist_ok=True)
  with tempfile.TemporaryDirectory() as tmp:
    for src_name, l1, l2, lang, out_dir in (
      ("swipe-demo-ja.mp4", "スワイプで、", "要点だけ", "ja", OUT_JA),
      ("swipe-demo-en.mp4", "Swipe for", "the gist", "en", OUT_EN),
    ):
      cp = Path(tmp) / f"chrome-{lang}.png"
      build_chrome_png(l1, l2, lang, cp)
      encode_preview(
        LP_ASSETS / src_name,
        cp,
        out_dir / "02-swipe-preview.mp4",
        out_dir / "02-swipe-poster.png",
      )


if __name__ == "__main__":
  main()
