#!/usr/bin/env python3
"""実機スクショ → Cal AI と同じ構図（1320×2868）。

リファ「毎日のカロリー / を追跡」カード内の実測（ホストのステータスバー除外）:
  見出し1: カード上から ≈ 14%
  見出し2: カード上から ≈ 20%
  端末上端: ≈ 26%
  端末下端: ≈ 95%（下で切れ）
  端末幅:   カード幅の ≈ 70%（全体幅の ≈ 64%）
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SCRIPTS = Path(__file__).resolve().parent
ROOT = SCRIPTS.parent
RAW = ROOT / "raw"
OUT_JA = ROOT / "submit" / "ja"
OUT_EN = ROOT / "submit" / "en"

W, H = 1320, 2868

# カードはほぼ全面（リファの中央パネル）
MX = int(W * 0.038)
MY = int(H * 0.028)
CARD = (MX, MY, W - MX - 1, H - MY - 1)
CARD_W = CARD[2] - CARD[0]
CARD_H = CARD[3] - CARD[1]
CR = int(min(W, H) * 0.052)

# カード内相対 → 絶対 Y
def cy(pct: float) -> int:
  return MY + int(CARD_H * pct)


HEAD_L1 = 0.138
HEAD_L2 = 0.202
PHONE_TOP_PCT = 0.255
PHONE_BOTTOM_PCT = 0.955
PHONE_W_PCT = 0.70  # of card width

OUTER = (0, 0, 0)
CARD_BG = (18, 18, 20)
CARD_EDGE = (44, 44, 48)
FG = (255, 255, 255)
BEZEL_HI = (228, 228, 230)
BEZEL_LO = (168, 170, 176)

FONT_JA = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_EN = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
FONT_FALLBACK = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
FONT_SF = "/System/Library/Fonts/SFNS.ttf"
FONT_SF_ALT = "/System/Library/Fonts/Supplemental/Helvetica Neue Bold.ttf"


def load_font(size: int, prefer: str) -> ImageFont.FreeTypeFont:
  for path, index in ((prefer, 0), (FONT_FALLBACK, 0)):
    try:
      return ImageFont.truetype(path, size=size, index=index)
    except OSError:
      continue
  return ImageFont.load_default()


def load_sf(size: int) -> ImageFont.ImageFont:
  for path in (FONT_SF, FONT_SF_ALT, FONT_FALLBACK):
    try:
      return ImageFont.truetype(path, size=size)
    except OSError:
      continue
  return ImageFont.load_default()


def sanitize_status_bar(im: Image.Image) -> Image.Image:
  im = im.convert("RGBA")
  w, _ = im.size
  px = im.load()
  draw = ImageDraw.Draw(im)

  # 緑ホットスポット → 黒
  for y in range(0, int(w * 0.12)):
    for x in range(int(w * 0.18), int(w * 0.48)):
      r, g, b, a = px[x, y]
      if g > 110 and g > r + 25 and g > b + 25:
        px[x, y] = (0, 0, 0, a)

  island_w = int(w * 0.265)
  island_h = int(w * 0.078)
  ix = (w - island_w) // 2
  iy = int(w * 0.024)
  draw.rounded_rectangle((ix, iy, ix + island_w, iy + island_h), radius=island_h // 2, fill=(0, 0, 0, 255))

  # 時刻差し替え（帯色で塗り → 9:41）
  tx0, ty0 = int(w * 0.048), int(w * 0.026)
  tx1, ty1 = int(w * 0.195), int(w * 0.092)
  sample = im.crop((int(w * 0.015), ty0, int(w * 0.04), ty1)).resize((1, 1), Image.Resampling.BOX)
  draw.rectangle((tx0, ty0, tx1, ty1), fill=sample.getpixel((0, 0)))
  font = load_sf(max(15, int(w * 0.046)))
  draw.text((int(w * 0.062), int(w * 0.038)), "9:41", font=font, fill=(255, 255, 255, 255))

  return im


def wrap_device_frame(im: Image.Image) -> Image.Image:
  im = im.convert("RGBA")
  screen_r = max(40, im.width // 12)
  screen = Image.new("RGBA", im.size, (0, 0, 0, 0))
  mask = Image.new("L", im.size, 0)
  ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=screen_r, fill=255)
  screen.paste(im, (0, 0))
  screen.putalpha(mask)

  bezel = max(11, im.width // 34)
  ow, oh = im.width + bezel * 2, im.height + bezel * 2
  outer_r = screen_r + bezel
  device = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
  d = ImageDraw.Draw(device)
  d.rounded_rectangle((0, 0, ow - 1, oh - 1), radius=outer_r, fill=BEZEL_HI)
  g = max(2, bezel // 3)
  d.rounded_rectangle((g, g, ow - 1 - g, oh - 1 - g), radius=max(1, outer_r - g), fill=BEZEL_LO)
  device.paste(screen, (bezel, bezel), screen)
  return device


def drop_shadow(im: Image.Image, blur: int = 48, dy: int = 32, opacity: int = 190) -> Image.Image:
  alpha = im.split()[-1]
  shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
  shadow.putalpha(alpha.point(lambda a: opacity if a > 0 else 0))
  shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
  pad = blur * 2
  canvas = Image.new("RGBA", (im.width + pad * 2, im.height + pad * 2 + dy), (0, 0, 0, 0))
  canvas.paste(shadow, (pad, pad + dy), shadow)
  canvas.paste(im, (pad, pad), im)
  return canvas


def fit_width(im: Image.Image, target_w: int) -> Image.Image:
  r = target_w / im.width
  return im.resize((target_w, int(im.height * r)), Image.Resampling.LANCZOS)


def compose(src: Path, line1: str, line2: str, out_path: Path, lang: str) -> None:
  canvas = Image.new("RGBA", (W, H), OUTER + (255,))
  draw = ImageDraw.Draw(canvas)

  draw.rounded_rectangle(CARD, radius=CR, fill=CARD_BG)
  draw.rounded_rectangle(CARD, radius=CR, outline=CARD_EDGE, width=2)

  # リファと同じ文字サイズ感（行の高さ ≈ カード高の 4%）
  font_size = int(CARD_H * 0.045) if lang == "ja" else int(CARD_H * 0.040)
  font = load_font(font_size, FONT_JA if lang == "ja" else FONT_EN)

  def draw_line(text: str, top_pct: float) -> None:
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = MX + (CARD_W - tw) / 2 - bbox[0]
    y = cy(top_pct) - bbox[1]
    draw.text((x, y), text, font=font, fill=FG)

  draw_line(line1, HEAD_L1)
  draw_line(line2, HEAD_L2)

  phone = Image.open(src).convert("RGBA")
  phone = sanitize_status_bar(phone)
  phone = wrap_device_frame(phone)
  phone = fit_width(phone, int(CARD_W * PHONE_W_PCT))
  phone = drop_shadow(phone)

  phone_x = MX + (CARD_W - phone.width) // 2
  phone_y = cy(PHONE_TOP_PCT)

  card_mask = Image.new("L", (W, H), 0)
  ImageDraw.Draw(card_mask).rounded_rectangle(CARD, radius=CR, fill=255)

  layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
  layer.paste(phone, (phone_x, phone_y), phone)
  # 下端カット
  cut = cy(PHONE_BOTTOM_PCT)
  ImageDraw.Draw(layer).rectangle((0, cut, W, H), fill=(0, 0, 0, 0))

  r, g, b, a = layer.split()
  a = Image.composite(a, Image.new("L", (W, H), 0), card_mask)
  canvas.alpha_composite(Image.merge("RGBA", (r, g, b, a)))

  canvas.convert("RGB").save(out_path, "PNG", optimize=True)
  print(f"wrote {out_path.name}")


# スワイプ Preview は compose-store-preview.py
# raw は中身とファイル名を一致済み（genres=ジャンルUI / tools=ツールUI）
SHOTS = [
  ("ja-explore.jpg", "一覧から", "すぐ見つかる", "ja", "03-explore.png"),
  ("ja-genres.png", "ジャンルで", "絞りこむ", "ja", "04-genres.png"),
  ("ja-tools.png", "AIツールで", "絞りこむ", "ja", "05-tools.png"),
  ("ja-sources.png", "情報源を", "自分で選ぶ", "ja", "06-sources.png"),
  ("en-explore.jpg", "Browse", "the grid", "en", "03-explore.png"),
  ("en-genres.png", "Filter", "by genre", "en", "04-genres.png"),
  ("en-tools.png", "Filter", "by tool", "en", "05-tools.png"),
  ("en-sources.png", "Choose your", "sources", "en", "06-sources.png"),
]


def main() -> None:
  OUT_JA.mkdir(parents=True, exist_ok=True)
  OUT_EN.mkdir(parents=True, exist_ok=True)
  for src_name, l1, l2, lang, out_name in SHOTS:
    src = RAW / src_name
    if not src.exists():
      raise SystemExit(f"missing {src}")
    out = OUT_JA if lang == "ja" else OUT_EN
    compose(src, l1, l2, out / out_name, lang)

if __name__ == "__main__":
  main()
