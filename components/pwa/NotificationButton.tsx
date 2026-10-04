'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {subscribeCurrentDevice,sendTestPush} from '../../lib/push-client';

type Props = { userId: string | null; onShowInstallGuide: () => void };
type Device = { ios: boolean; standalone: boolean; secureContext: boolean; notificationSupported: boolean; ready: boolean };

export default function NotificationButton({ userId, onShowInstallGuide }: Props) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [device, setDevice] = useState<Device>({ ios: false, standalone: false, secureContext: false, notificationSupported: false, ready: false });
  const [message, setMessage] = useState('');
  const [messageOpen, setMessageOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<'happy'|'neutral'|'sad'>('happy');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const ua = navigator.userAgent;
      const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const notificationSupported = 'Notification' in window;
      setDevice({ ios, standalone, secureContext: window.isSecureContext, notificationSupported, ready: true });
      if (notificationSupported) setPermission(Notification.permission);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const insecure = !device.secureContext;
  const needsHomeScreen = !insecure && device.ios && !device.standalone;
  const unsupported = device.ready && (insecure || (!device.notificationSupported && !needsHomeScreen));
  const denied = !needsHomeScreen && !unsupported && permission === 'denied';
  const label = !device.ready ? '알림 상태 확인 중' : denied ? '알림 설정' : permission === 'granted' ? '알림 허용됨' : '알림 받기';

  async function requestPermission() {
    if (busy) return;
    setBusy(true);
    try {
    if (!device.ready) return;
    if (messageOpen) {
      setMessageOpen(false);
      setMessage('');
      return;
    }
    setMessageOpen(true);
    if (insecure) {
      setMessage('이 환경에서는 알림을 지원하지 않습니다. HTTPS 연결과 알림을 지원하는 브라우저가 필요합니다.');
      return;
    }
    if (needsHomeScreen) {
      setMessage('iPhone에서는 먼저 홈 화면에 추가해야 알림을 받을 수 있습니다.');
      onShowInstallGuide();
      return;
    }
    if (!device.notificationSupported) {
      setMessage('이 환경에서는 알림을 지원하지 않습니다.');
      return;
    }
    if (!userId) { setMessage('먼저 로그인해 주세요.'); return; }
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { setMessage('알림 서버 연결을 준비 중입니다.'); return; }
    if (permission === 'denied') {
      setMessage('설정에서 알림을 허용해주세요.');
      return;
    }
    if (permission === 'granted') {
      await subscribeCurrentDevice();
      setConnected(true);
      setMessage('알림을 연결했습니다. 테스트 알림으로 확인해 보세요.');
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    setMessage(next === 'granted' ? '알림을 연결하는 중입니다.' : next === 'denied' ? '알림이 차단되었습니다. 브라우저 설정에서 변경할 수 있습니다.' : '알림 권한 요청을 완료하지 않았습니다.');
    if (next === 'granted') { await subscribeCurrentDevice(); setConnected(true); setMessage('알림을 연결했습니다.'); }
    } catch(error) { setConnected(false); setMessageOpen(true); setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function testPush() {
    if(busy)return;
    setBusy(true);setMessageOpen(true);
    try{const result=await sendTestPush(mood);setMessage(result.sent?'테스트 알림을 발송했습니다. 휴대폰 알림창을 확인하세요.':'앱 안에 알림을 저장했습니다. 휴대폰 알림 연결을 확인하세요.');setMood(mood==='happy'?'neutral':mood==='neutral'?'sad':'happy');}
    catch(error){setMessage((error as Error).message);}
    finally{setBusy(false);}
  }

  const guidance = insecure || (!device.notificationSupported && !needsHomeScreen)
    ? '이 환경에서는 알림을 지원하지 않습니다. HTTPS 연결과 알림을 지원하는 브라우저가 필요합니다.'
    : needsHomeScreen
      ? 'iPhone에서는 먼저 홈 화면에 추가해야 알림을 받을 수 있습니다.'
      : denied
        ? '설정에서 알림을 허용해주세요.'
        : message;

  return <div className="notification-control"><button className="notification-button" aria-label={label} aria-expanded={messageOpen} title={label} onClick={() => void requestPermission()} disabled={!device.ready||busy}><Bell size={16} /><span>{label}</span></button>{connected&&userId&&<button className="notification-button" disabled={busy} onClick={()=>void testPush()}>알림 테스트 {mood==='happy'?'😊':mood==='neutral'?'😐':'😣'}</button>}{messageOpen && guidance && <small role="status">{guidance}</small>}</div>;
}
