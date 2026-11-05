import { CardReader } from '@/components/CardReader';
export default async function CardPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CardReader id={id} />; }
