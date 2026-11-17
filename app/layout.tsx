import type {Metadata, Viewport} from 'next';
import {preload} from 'react-dom';
import './globals.css';
export const metadata:Metadata={
  title:'보건법규 심사관 | 오늘의 심사실',
  description:'사례를 읽고, 법령을 확인하고, 판단하며 배우는 보건법규 학습 심사실.',
  manifest:'/manifest.webmanifest',
  icons:{icon:'/favicon.svg',apple:'/icons/icon-192.png'},
  appleWebApp:{capable:true,statusBarStyle:'black-translucent',title:'보건법규 심사관'},
};
export const viewport:Viewport={themeColor:'#17232b',viewportFit:'cover',width:'device-width',initialScale:1};
export default function Layout({children}:{children:React.ReactNode}){preload('/fonts/Galmuri11-subset.woff2',{as:'font',type:'font/woff2',crossOrigin:'anonymous'});return <html lang="ko"><body>{children}</body></html>}
