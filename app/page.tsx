import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100dvh', gap: 16 }}>
      <div style={{ fontSize: 20 }}>✅ 部署成功</div>
      <Link href="/chat" style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8 }}>开始聊天</Link>
    </main>
  );
}
