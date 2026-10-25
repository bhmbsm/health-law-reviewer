export type ReviewTimestamps = Record<string, string>;

export function readReviewTimestamps(raw: string | null): ReviewTimestamps {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && Number.isFinite(Date.parse(entry[1]))
    ));
  } catch { return {}; }
}

// Correct answers preserve review entries; only a later explicit dismissal clears them.
export function reviewCaseIds(
  attempts: readonly {case_id: string; correct: number | boolean; created: string}[],
  additions: ReviewTimestamps,
  dismissals: ReviewTimestamps
): Set<string> {
  const latest = new Map(Object.entries(additions).map(([id, date]) => [id, Date.parse(date)]));
  for (const attempt of attempts) {
    if (!attempt.correct) latest.set(attempt.case_id, Math.max(latest.get(attempt.case_id) ?? -Infinity, Date.parse(attempt.created)));
  }
  return new Set([...latest].filter(([id, time]) => {
    const dismissed = Date.parse(dismissals[id]);
    return time > (Number.isFinite(dismissed) ? dismissed : -Infinity);
  }).map(([id]) => id));
}
