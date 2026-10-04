import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({ appType: 'custom', configFile: false, server: { middlewareMode: true, hmr: false, ws: false } });
after(() => vite.close());
const story = await vite.ssrLoadModule('/lib/story.ts');
const progress = await vite.ssrLoadModule('/lib/story-progress.ts');
const data = new Map();
globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
after(() => { delete globalThis.localStorage; });

test('story uses uploaded cases, excludes other laws, and does not repeat completed cases', () => {
  const bank = Array.from({ length: 20 }, (_, i) => ({ id: `uploaded-${i}`, law: '의료법', answer: i % 2 === 0 }));
  bank.push({ id: 'other-law', law: '다른 법령' });
  const attempted = new Set(['uploaded-0', 'uploaded-1']);
  const selected = story.randomChapterCases(bank, 0, attempted);
  assert.equal(selected.length, 12);
  assert.equal(new Set(selected.map(item => item.id)).size, 12);
  assert.ok(selected.every(item => item.law === '의료법' && !attempted.has(item.id)));
  assert.ok(selected.every(item => bank.includes(item)));
  assert.deepEqual(story.randomChapterCases([], 0), []);
  assert.deepEqual(story.randomChapterCases(bank, 1), []);
});

test('story progress is isolated between accounts and the guest', () => {
  data.clear();
  progress.saveStoryProgress({ unlockedThrough: 1, completed: [0], stats: { judgment: 74, trust: 62 } }, 'user-a');
  assert.deepEqual(progress.loadStoryProgress('user-a').completed, [0]);
  assert.deepEqual(progress.loadStoryProgress('user-b').completed, []);
  assert.deepEqual(progress.loadStoryProgress().completed, []);
  progress.saveStoryProgress({ unlockedThrough: 2, completed: [0, 1], stats: { judgment: 88, trust: 73 } }, 'user-b');
  assert.equal(progress.loadStoryProgress('user-a').unlockedThrough, 1);
  assert.equal(progress.loadStoryProgress('user-b').unlockedThrough, 2);
});

test('malformed progress recovers safely and stat changes remain bounded', () => {
  data.clear();
  progress.saveStoryProgress({ completed: [0, 0, -1, 99], stats: { judgment: 999, trust: -20 } }, 'invalid');
  assert.deepEqual(progress.loadStoryProgress('invalid'), { unlockedThrough: 1, completed: [0], stats: { judgment: 100, trust: 0 } });
  assert.deepEqual(story.applyStoryResult({ judgment: 99, trust: 100 }, true), { judgment: 100, trust: 100 });
  assert.deepEqual(story.applyStoryResult({ judgment: 0, trust: 0 }, false), { judgment: 0, trust: 0 });
});
