export type NudgeFriend = {
  id: string;
  nickname: string;
  groupCode: string;
  studiedToday: boolean;
};

export type NudgeRecord = {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  message: string;
  createdAt: string;
  kind: 'received' | 'sent';
};

export type NudgeDashboard = {
  friends: NudgeFriend[];
  received: NudgeRecord[];
  sentToday: string[];
  isExampleData: true;
};

export const DAILY_STUDY_TARGET = 5;
const SENT_KEY = 'health-law-reviewer-mock-nudges-v1';
const mockFriends: Omit<NudgeFriend, 'groupCode'>[] = [
  { id: 'mock-friend-01', nickname: '민서', studiedToday: false },
  { id: 'mock-friend-02', nickname: '지훈', studiedToday: true },
  { id: 'mock-friend-03', nickname: '서연', studiedToday: false },
  { id: 'mock-friend-04', nickname: '도윤', studiedToday: false },
];

// TODO: 개발자 A가 이 함수들을 그룹 친구·오늘 학습 현황·Nudge API 호출로 교체합니다.
export function loadMockNudgeDashboard(groupCode: string, today: string): NudgeDashboard {
  let sentToday: string[] = [];
  try {
    const stored = JSON.parse(localStorage.getItem(SENT_KEY) || '{}') as Record<string, string[]>;
    sentToday = Array.isArray(stored[today]) ? stored[today] : [];
  } catch { /* Use an empty temporary send list when local data is invalid. */ }

  const received: NudgeRecord[] = [
    { id: 'mock-received-01', senderId: 'mock-friend-02', senderName: '지훈', recipientId: 'current-user', message: '오늘 심사도 같이 해요!', createdAt: `${today}T09:00:00+09:00`, kind: 'received' },
  ];
  return {
    friends: groupCode ? mockFriends.map((friend) => ({ ...friend, groupCode })) : [],
    received,
    sentToday,
    isExampleData: true,
  };
}

export function sendMockNudge(friendId: string, today: string): string[] {
  let stored: Record<string, string[]> = {};
  try { stored = JSON.parse(localStorage.getItem(SENT_KEY) || '{}') as Record<string, string[]>; } catch { /* Start with empty temporary data. */ }
  const sentToday = Array.isArray(stored[today]) ? stored[today] : [];
  if (!sentToday.includes(friendId)) stored[today] = [...sentToday, friendId];
  localStorage.setItem(SENT_KEY, JSON.stringify(stored));
  return stored[today];
}
