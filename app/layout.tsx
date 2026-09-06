import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'보건법규 심사관 | 오늘의 심사실',description:'사례를 읽고, 법령을 확인하고, 판단하며 배우는 보건법규 학습 심사실.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
