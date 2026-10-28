# App Store 提出素材

## Connect に上げるのはここ（6.1" / 6.3" 枠）

ASC の「iPhone 6.1インチまたは6.3インチ」枠向け。**いまはこちらを使う。**

```
submit-6.3/ja/   ← 日本語（スクショ 1206×2622 / Preview 886×1920）
submit-6.3/en/   ← 英語
```

代替（同じ枠でも可）:

```
submit-6.1/ja/   ← スクショ 1179×2556 / Preview 886×1920
submit-6.1/en/
```

| 順 | ファイル | 内容 |
|----|----------|------|
| 1 | `01-hero.png` | Fast News AI 白カード（1枚） |
| 2 | `02-swipe-preview.mp4` | App Preview（886×1920・**15.5秒**・ステレオ無音付き。ASCは15〜30秒必須） |
| — | `02-swipe-poster.png` | Preview ポスター（任意） |
| 3 | `03-explore.png` | 一覧からすぐ見つかる |
| 4 | `04-genres.png` | ジャンルで絞りこむ |
| 5 | `05-tools.png` | AIツールで絞りこむ |
| 6 | `06-sources.png` | 欲しい情報だけを狙い撃ち |

元サイズ（6.9" / 1320×2868）のマスターは `submit/`。6.9" 枠があるときだけそちら。

## 再生成

```bash
./store/screenshots/scripts/build-all.sh
# または
python3 store/screenshots/scripts/compose-store-text-cards.py
python3 store/screenshots/scripts/compose-store-preview.py
python3 store/screenshots/scripts/compose-store-shots.py
```

- ヒーロー リファ: `reference/hero-white-ref.jpg`
- 端末枠 リファ: `reference/`
- raw の genres / tools は中身とファイル名を一致済み
