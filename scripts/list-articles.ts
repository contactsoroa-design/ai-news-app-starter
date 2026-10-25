import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Article } from '../src/lib/types';

function main() {
  const articlesPath = path.resolve(__dirname, '..', 'data', 'articles.json');
  if (!fs.existsSync(articlesPath)) {
    console.log('data/articles.json が見つかりません。先に npm run seed を実行してください。');
    process.exit(1);
  }

  const articles: Article[] = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
  console.log(`=== 保存済み記事一覧 (${articles.length}件) ===\n`);

  for (const [idx, art] of articles.entries()) {
    const tags = [...art.tool_tags, ...art.genre_tags].join(', ') || 'タグなし';
    console.log(
      `${idx + 1}. [${art.source_name}] (${art.published_at?.slice(0, 10) ?? '日付不明'}) [${tags}]`
    );
    console.log(`   見出し(${art.title_ja.length}字): ${art.title_ja}`);
    console.log(`   要約  (${art.summary_ja.length}字): ${art.summary_ja}`);
    console.log(`   URL   : ${art.url}\n`);
  }
}

main();
