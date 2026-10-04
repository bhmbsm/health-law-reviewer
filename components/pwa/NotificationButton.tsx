'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

type Props = { onShowInstallGuide: () => void };
type Device = { ios: boolean; standalone: boolean; secureContext: boolean; notificationSupported: boolean; ready: boolean };

async function savePushSubscription(): Promise<void> {
  // TODO: 개발자 A가 PushSubscription 생성 및 서버 저장을 이 함수에 연결합니다.
}

export default function NotificationButton({ onShowInstallGuide }: Props) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [device, setDevice] = useState<Device>({ ios: false, standalone: false, secureContext: false, notificationSupported: false, ready: false });
  const [message, setMessage] = useState('');
  const [messageOpen, setMessageOpen] = useState(false);

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
    if (permission === 'denied') {
      setMessage('설정에서 알림을 허용해주세요.');
      return;
    }
    if (permission === 'granted') {
      await savePushSubscription();
      setMessage('알림 권한은 허용되어 있습니다. 실제 알림 발송 기능은 준비 중입니다.');
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    setMessage(next === 'granted' ? '알림 권한을 허용했습니다. 실제 알림 발송 기능은 준비 중입니다.' : next === 'denied' ? '알림이 차단되었습니다. 브라우저 설정에서 변경할 수 있습니다.' : '알림 권한 요청을 완료하지 않았습니다.');
    if (next === 'granted') await savePushSubscription();
  }

  const guidance = insecure || (!device.notificationSupported && !needsHomeScreen)
    ? '이 환경에서는 알림을 지원하지 않습니다. HTTPS 연결과 알림을 지원하는 브라우저가 필요합니다.'
    : needsHomeScreen
      ? 'iPhone에서는 먼저 홈 화면에 추가해야 알림을 받을 수 있습니다.'
      : denied
        ? '설정에서 알림을 허용해주세요.'
        : message;

  return <div className="notification-control"><button className="notification-button" aria-label={label} aria-expanded={messageOpen} title={label} onClick={() => void requestPermission()} disabled={!device.ready}><Bell size={16} /><span>{label}</span></button>{messageOpen && guidance && <small role="status">{guidance}</small>}</div>;
}
