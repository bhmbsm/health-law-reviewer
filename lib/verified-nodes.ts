import type { Case } from './cases';

export type VerifiedVariant = {
  value: string;
  passes: boolean;
  explanation: string;
};

export type VerifiedNode = {
  id: string;
  law: string;
  article: string;
  point: string;
  criterion_type: '주체' | '기간' | '수량' | '조건' | '예외' | '절차';
  passing_rule: string;
  case_template: string;
  fixed_details: string[];
  variants: VerifiedVariant[];
  source: string;
  importance: '핵심' | '일반' | '심화';
  chapter: number; // 1-based chapter number
  sender: string;
  review_status: 'verified' | 'needs_review';
  reviewer: string;
};

function isVerifiedNode(value: unknown): value is VerifiedNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Partial<VerifiedNode>;
  return node.review_status === 'verified' &&
    typeof node.id === 'string' && node.id.length > 0 &&
    typeof node.law === 'string' && typeof node.article === 'string' &&
    typeof node.point === 'string' && typeof node.passing_rule === 'string' &&
    typeof node.case_template === 'string' &&
    node.case_template.split('{{value}}').length === 2 &&
    Array.isArray(node.fixed_details) && node.fixed_details.every(x => typeof x === 'string') &&
    Array.isArray(node.variants) && node.variants.length >= 2 &&
    node.variants.every(x => x && typeof x.value === 'string' && typeof x.passes === 'boolean' && typeof x.explanation === 'string') &&
    node.variants.some(x => x.passes) && node.variants.some(x => !x.passes) &&
    typeof node.source === 'string' && node.source.startsWith('https://') &&
    typeof node.chapter === 'number' && Number.isInteger(node.chapter) && node.chapter >= 1 && node.chapter <= 12 &&
    typeof node.sender === 'string' && typeof node.reviewer === 'string' && node.reviewer.length > 0;
}

/** Only reviewer-approved variants can determine a legal answer. Exactly one template value changes. */
export function generateVerifiedCase(node: unknown, random: () => number = Math.random): Case {
  if (!isVerifiedNode(node)) throw new Error('검증된 기준과 승인·반려 값이 모두 필요한 노드입니다.');
  const index = Math.min(node.variants.length - 1, Math.max(0, Math.floor(random() * node.variants.length)));
  const variant = node.variants[index];
  return {
    id: node.id + ':' + index,
    law: node.law, article: node.article, title: node.point, sender: node.sender,
    body: node.case_template.replace('{{value}}', variant.value),
    details: [...node.fixed_details],
    answer: variant.passes, explanation: variant.explanation, rule: node.passing_rule,
    chapter: node.chapter - 1, difficulty: node.importance, source: node.source,
    origin: '검증 노드 · ' + node.reviewer,
  };
}

export function generateVerifiedCases(nodes: unknown[], random: () => number = Math.random): Case[] {
  const seen = new Set<string>();
  return nodes.map(node => {
    const result = generateVerifiedCase(node, random);
    if (seen.has(result.id)) throw new Error('검증 노드 ID가 중복되었습니다: ' + result.id);
    seen.add(result.id);
    return result;
  });
}
