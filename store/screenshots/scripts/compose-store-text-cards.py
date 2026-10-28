#!/usr/bin/env python3
"""提出用ヒーロー 1枚（白カード型）。

リファ: reference/hero-white-ref.jpg の構図
  吹き出し → 見出し → 特徴2点 → ブランド名 → 斜め端末
※ LP動画や他スクショの流用はしない。端末は raw のホームのみ使用。
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
RAW = ROOT / "raw"
OUT_JA = ROOT / "submit" / "ja"
OUT_EN = ROOT / "submit" / "en"

W, H = 1320, 2868
MX, MY = 36, 40
CR = 64

# リファの茶系アクセント（コピーせず色だけ近い）
ACCENT = (140, 110, 78)
ACCENT_DK = (110, 85, 58)
INK = (40, 40, 42)
INK_SOFT = (90, 90, 94)
CARD_BG = (255, 255, 255)
OUTER = (0, 0, 0)

FONT_JA = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_JA_M = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
FONT_EN = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_FALLBACK = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"


def load_font(size: int, prefer: str) -> ImageFont.FreeTypeFont:
  for path, index in ((prefer, 0), (FONT_JA, 0), (FONT_FALLBACK, 0)):
    try:
      return ImageFont.truetype(path, size=size, index=index)
    except OSError:
      continue
  return ImageFont.load_default()


def round_phone(im: Image.Image, radius: int = 40) -> Image.Image:
  im = im.convert("RGBA")
  mask = Image.new("L", im.size, 0)
  ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=radius, fill=255)
  out = Image.new("RGBA", im.size, (0, 0, 0, 0))
  out.paste(im, (0, 0))
  out.putalpha(mask)
  return out


def wrap_bezel(im: Image.Image) -> Image.Image:
  """薄いゴールド寄りベゼル（リファの端末感・独自描画）。"""
  bezel = 14
  ow, oh = im.width + bezel * 2, im.height + bezel * 2
  r = max(36, im.width // 14) + bezel
  device = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
  d = ImageDraw.Draw(device)
  d.rounded_rectangle((0, 0, ow - 1, oh - 1), radius=r, fill=(210, 195, 170, 255))
  d.rounded_rectangle((3, 3, ow - 4, oh - 4), radius=r - 3, fill=(235, 225, 210, 255))
  screen = round_phone(im, radius=max(28, im.width // 14))
  device.paste(screen, (bezel, bezel), screen)
  return device


def perspective_phone(im: Image.Image, out_w: int, out_h: int) -> Image.Image:
  """右下に傾ける簡易パース（PIL transform）。"""
  im = im.convert("RGBA")
  # 少し縮小して余裕を確保
  scale = min(out_w / im.width, out_h / im.height) * 0.92
  nw, nh = int(im.width * scale), int(im.height * scale)
  im = im.resize((nw, nh), Image.Resampling.LANCZOS)
  canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
  # 擬似パース: 右辺を少し伸ばす
  coeffs = _find_coeffs(
    [(0, 0), (nw, int(nh * 0.04)), (nw, int(nh * 0.96)), (0, nh)],
    [(0, 0), (nw, 0), (nw, nh), (0, nh)],
  )
  warped = im.transform((nw, nh), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
  # 右寄せ・下寄せ
  canvas.paste(warped, (out_w - nw - 8, out_h - nh + 20), warped)
  return canvas


def _find_coeffs(pa, pb):
  """Map pb → pa for PIL perspective."""
  matrix = []
  for p1, p2 in zip(pa, pb):
    matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
    matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
  A = matrix
  B = [x for p in pb for x in p]
  # Gaussian elimination 8x8
  n = 8
  M = [A[i] + [B[i]] for i in range(n)]
  for col in range(n):
    piv = max(range(col, n), key=lambda r: abs(M[r][col]))
    M[col], M[piv] = M[piv], M[col]
    div = M[col][col] or 1e-9
    M[col] = [v / div for v in M[col]]
    for row in range(n):
      if row == col:
        continue
      fac = M[row][col]
      M[row] = [a - fac * b for a, b in zip(M[row], M[col])]
  return [M[i][n] for i in range(n)]


def draw_bubble(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, x: int, y: int) -> int:
  pad_x, pad_y = 28, 16
  bbox = draw.textbbox((0, 0), text, font=font)
  tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
  w, h = tw + pad_x * 2, th + pad_y * 2
  draw.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=ACCENT)
  # しっぽ
  draw.polygon([(x + 36, y + h - 2), (x + 56, y + h - 2), (x + 44, y + h + 14)], fill=ACCENT)
  draw.text((x + pad_x - bbox[0], y + pad_y - bbox[1]), text, font=font, fill=(255, 255, 255))
  return y + h + 28


def draw_icon_clock(draw: ImageDraw.ImageDraw, cx: int, cy: int, r: int = 28) -> None:
  draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=ACCENT, width=4)
  draw.line((cx, cy, cx, cy - r + 10), fill=ACCENT, width=4)
  draw.line((cx, cy, cx + r - 12, cy + 6), fill=ACCENT, width=4)


def draw_icon_bookmark(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int = 26) -> None:
  draw.rounded_rectangle((cx - s // 2, cy - s // 2, cx + s // 2, cy + s // 2 + 4), radius=4, outline=ACCENT, width=4)
  draw.line((cx - s // 2 + 4, cy + 2, cx, cy + s // 2 - 2), fill=ACCENT, width=3)
  draw.line((cx, cy + s // 2 - 2, cx + s // 2 - 4, cy + 2), fill=ACCENT, width=3)


def compose(lang: str, out_path: Path) -> None:
  canvas = Image.new("RGB", (W, H), OUTER)
  draw = ImageDraw.Draw(canvas)

  # 白カード
  card = (MX, MY, W - MX - 1, H - MY - 1)
  draw.rounded_rectangle(card, radius=CR, fill=CARD_BG)

  if lang == "ja":
    bubble = "隙間時間で、AIの今をチェック"
    headline = ["AI業界専用の", "ニュースアプリ"]
    sub = "業界の“今”が、1枚のスワイプでわかる。"
    feats = [
      ("いち早く要点だけ届く", "生成AI・個人開発の動きを短い要約で。"),
      ("あとで読める保存", "気になるカードは端末にだけ保存。"),
    ]
    badge = "情報源 × ツールで絞れる"
    brand = "Fast News AI"
    raw_name = "ja-home.png"
    font_pref = FONT_JA
  else:
    bubble = "AI news in spare moments"
    headline = ["The news app", "built for AI"]
    sub = "Catch what’s happening—one swipe at a time."
    feats = [
      ("Short native digests", "JA + EN summaries, no fluff."),
      ("Save on device", "Bookmarks stay on your phone only."),
    ]
    badge = "Filter by source × tool"
    brand = "Fast News AI"
    raw_name = "en-home.png"
    font_pref = FONT_EN

  bubble_font = load_font(34, FONT_JA_M if lang == "ja" else font_pref)
  head_font = load_font(72, font_pref)
  sub_font = load_font(32, FONT_JA_M if lang == "ja" else font_pref)
  feat_title = load_font(34, font_pref)
  feat_body = load_font(28, FONT_JA_M if lang == "ja" else font_pref)
  brand_font = load_font(64, FONT_EN)
  badge_font = load_font(26, FONT_JA_M if lang == "ja" else font_pref)

  x0 = MX + 56
  y = MY + 56
  y = draw_bubble(draw, bubble, bubble_font, x0, y)

  for line in headline:
    bbox = draw.textbbox((0, 0), line, font=head_font)
    draw.text((x0 - bbox[0], y - bbox[1]), line, font=head_font, fill=INK)
    y += bbox[3] - bbox[1] + 6
  y += 10
  bbox = draw.textbbox((0, 0), sub, font=sub_font)
  draw.text((x0 - bbox[0], y - bbox[1]), sub, font=sub_font, fill=INK_SOFT)
  y += bbox[3] - bbox[1] + 48

  for i, (t, b) in enumerate(feats):
    cy = y + 28
    if i == 0:
      draw_icon_clock(draw, x0 + 28, cy)
    else:
      draw_icon_bookmark(draw, x0 + 28, cy)
    tx = x0 + 78
    bbox = draw.textbbox((0, 0), t, font=feat_title)
    draw.text((tx - bbox[0], y - bbox[1]), t, font=feat_title, fill=INK)
    y2 = y + bbox[3] - bbox[1] + 8
    bbox2 = draw.textbbox((0, 0), b, font=feat_body)
    draw.text((tx - bbox2[0], y2 - bbox2[1]), b, font=feat_body, fill=INK_SOFT)
    y = y2 + bbox2[3] - bbox2[1] + 36

  y += 8
  bbox = draw.textbbox((0, 0), brand, font=brand_font)
  draw.text((x0 - bbox[0], y - bbox[1]), brand, font=brand_font, fill=INK)

  # 端末（raw ホームのみ・他素材流用なし）
  phone_src = RAW / raw_name
  if not phone_src.exists():
    raise SystemExit(f"missing {phone_src}")
  phone = Image.open(phone_src).convert("RGB")
  # ステータスはそのまま（ヒーローは別デザイン、簡易ダミーはしない）
  phone = wrap_bezel(phone)
  phone_area_h = int(H * 0.48)
  phone_area_w = int(W * 0.62)
  phone_layer = perspective_phone(phone, phone_area_w, phone_area_h)
  px = W - MX - phone_area_w + 20
  py = H - MY - phone_area_h + 10
  # 白カード内にクリップ
  card_mask = Image.new("L", (W, H), 0)
  ImageDraw.Draw(card_mask).rounded_rectangle(card, radius=CR, fill=255)
  layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
  layer.paste(phone_layer, (px, py), phone_layer)
  r, g, b, a = layer.split()
  a = Image.composite(a, Image.new("L", (W, H), 0), card_mask)
  canvas = Image.alpha_composite(canvas.convert("RGBA"), Image.merge("RGBA", (r, g, b, a))).convert("RGB")
  draw = ImageDraw.Draw(canvas)

  # バッジ
  bw = draw.textbbox((0, 0), badge, font=badge_font)
  badge_w = bw[2] - bw[0] + 40
  badge_h = bw[3] - bw[1] + 28
  bx = W - MX - badge_w - 36
  by = H - MY - 120
  draw.rounded_rectangle((bx, by, bx + badge_w, by + badge_h), radius=badge_h // 2, fill=ACCENT)
  draw.text((bx + 20 - bw[0], by + 14 - bw[1]), badge, font=badge_font, fill=(255, 255, 255))

  canvas.save(out_path, "PNG", optimize=True)
  print(f"wrote {out_path}")


def main() -> None:
  OUT_JA.mkdir(parents=True, exist_ok=True)
  OUT_EN.mkdir(parents=True, exist_ok=True)
  compose("ja", OUT_JA / "01-hero.png")
  compose("en", OUT_EN / "01-hero.png")


if __name__ == "__main__":
  main()
