'use client';
import React, { useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('你好');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: msgs.map((x) => ({ role: x.role, content: x.content })),
          userText: text,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Network error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          const l = line.trim();
          if (!l.startsWith('data:')) continue;
          const data = l.replace(/^data:\s*/, '');
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            const token = j?.choices?.[0]?.delta?.content ?? '';
            if (token) {
              setMsgs((arr) => {
                const copy = arr.slice();
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') last.content += token;
                return copy;
              });
            }
          } catch {}
        }
        listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '抱歉，网络有点忙，请再试一次。' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>角色陪伴 · 流式对话（MVP）</h1>
      <div
        ref={listRef}
        style={{
          border: '1px solid #eee',
          borderRadius: 12,
          padding: 12,
          height: '60vh',
          overflowY: 'auto',
          background: '#fafafa',
        }}
      >
        {msgs.map((m, i) => (
          <div key={i} style={{ margin: '8px 0', whiteSpace: 'pre-wrap' }}>
            <b>{m.role === 'user' ? '你' : '小栖'}</b>
            <div>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ opacity: 0.6 }}>小栖正在输入…</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="说点什么…"
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <button onClick={send} disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd' }}>
          发送
        </button>
      </div>
    </div>
  );
}

