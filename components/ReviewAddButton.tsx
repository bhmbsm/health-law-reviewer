'use client';

export default function ReviewAddButton({added, busy, onAdd}: {added: boolean; busy: boolean; onAdd: () => void}) {
  return <button type="button" className="secondary review-add-button" disabled={busy || added} onClick={onAdd}>
    {added ? '오답 재심사함에 추가됨' : '오답 재심사함에 넣기'}
  </button>;
}
