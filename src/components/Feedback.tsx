import { Icon } from './Icon';

export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="notice notice-error" role="alert"><p>{message}</p>{retry && <button className="text-button" onClick={retry}>Coba kembali <Icon name="arrow" size={16} /></button>}</div>;
}
export function Loading({ label = 'Membuka lembar pengetahuan…' }: { label?: string }) {
  return <div className="loading-state" role="status"><span className="loading-seal" />{label}</div>;
}
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty-state"><Icon name="book" size={36} /><h2>{title}</h2><p>{children}</p></div>;
}
