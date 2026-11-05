import type { CSSProperties } from 'react';

const paths = {
  feed: <><path d="M4 4h6v7H4zM14 4h6v4h-6zM4 15h6v5H4zM14 12h6v8h-6z" /></>,
  bookmark: <path d="M6 4h12v17l-6-4-6 4z" />,
  evaluation: <><path d="m5 12 4 4L19 6M4 21h16" /></>,
  history: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2" /></>,
  settings: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="8" cy="18" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  book: <><path d="M12 6C8 3 4 4 3 5v14c3-2 6-1 9 1 3-2 6-3 9-1V5c-3-2-6-1-9 1Zm0 0v14" /></>,
  good: <path d="M8 10 12 3c2 0 2 2 1 6h6c2 0 2 2 1 4l-2 7H8V10ZM3 10h5v10H3z" />,
  bad: <path d="m8 14 4 7c2 0 2-2 1-6h6c2 0 2-2 1-4l-2-7H8v10ZM3 14h5V4H3z" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  logout: <><path d="M10 4H4v16h6M8 12h13m-5-5 5 5-5 5" /></>,
};
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}
