import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('production Next.js homepage renders Korean metadata and study navigation', async () => {
  const html = await readFile(new URL('../.next/server/app/index.html', import.meta.url), 'utf8');
  assert.match(html, /<html[^>]*lang="ko"/);
  assert.match(html, /<title>보건법규 심사관 \| 오늘의 심사실<\/title>/);
  assert.match(html, /<meta[^>]*name="description"[^>]*content="사례를 읽고/);
  assert.match(html, /<link[^>]*rel="manifest"[^>]*href="\/manifest.webmanifest"/);
  for (const label of ['오늘의 심사실', '스토리 모드', '자유 심사', '오답 재심사', '학습 기록']) assert.ok(html.includes(label));
});
