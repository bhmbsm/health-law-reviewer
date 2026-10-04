'use client';

import { useEffect, useState } from 'react';
import { Smartphone, X } from 'lucide-react';

type Platform = 'ios-safari' | 'android-chrome' | 'general';
type Props = { installAvailable: boolean; onInstall: () => Promise<void> };

export default function InstallGuide({ installAvailable, onInstall }: Props) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const iosSafari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
      const androidChrome = /Android/i.test(ua) && /Chrome/i.test(ua) && !/EdgA|OPR|SamsungBrowser|Firefox/i.test(ua);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setPlatform(iosSafari ? 'ios-safari' : androidChrome ? 'android-chrome' : 'general');
      setInstalled(standalone);
    }, 0);
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(media.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    media.addEventListener?.('change', update);
    return () => { window.clearTimeout(timer); media.removeEventListener?.('change', update); };
  }, []);

  useEffect(() => {
    const open = () => setOpen(true);
    window.addEventListener('open-install-guide', open);
    return () => window.removeEventListener('open-install-guide', open);
  }, []);

  if (installed || !platform) return null;
  return <>
    <button className="install-button pwa-guide-trigger" aria-label="설치 안내" onClick={() => setOpen(true)}><Smartphone size={16} /><span>설치 안내</span></button>
    {open && <div className="pwa-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-title">
        <button className="pwa-close" aria-label="안내 닫기" onClick={() => setOpen(false)}><X size={20} /></button>
        <span className="eyebrow">홈 화면 설치</span><h2 id="pwa-title">앱처럼 간편하게 이용하기</h2>
        {platform === 'ios-safari' ? <ol><li>Safari 하단의 <b>공유</b> 버튼을 누릅니다.</li><li>메뉴에서 <b>홈 화면에 추가</b>를 선택합니다.</li><li>표시 이름을 확인하고 <b>추가</b>를 누릅니다.</li></ol> : platform === 'android-chrome' ? <ol><li>화면의 <b>앱 설치</b> 버튼을 누르거나 Chrome 오른쪽 위 <b>⋮ 메뉴</b>를 엽니다.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택합니다.</li><li>확인 화면에서 <b>설치</b> 또는 <b>추가</b>를 누릅니다.</li></ol> : <p>지원되는 브라우저에서는 주소창의 설치 아이콘이나 브라우저 메뉴에서 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택하세요. 설치 메뉴가 보이지 않으면 현재 브라우저가 PWA 설치를 지원하지 않을 수 있습니다.</p>}
        {installAvailable && <button className="primary" onClick={async () => { await onInstall(); setOpen(false); }}>앱 설치 시작</button>}
      </section>
    </div>}
  </>;
}
