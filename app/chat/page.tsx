// app/chat/page.tsx
'use client';
import React, { useRef, useState, useEffect } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };
type Persona = {
  id?: string;
  name?: string;
  avatar_url?: string | null;
  style_short?: string | null;
  canon?: string | null;
};

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('你好');
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<Persona | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const p = localStorage.getItem('persona');
      if (p) setPersona(JSON.parse(p));
    } catch {}
  }, []);

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
          persona,
        }),
      });

      if (!res.ok || !res.body) throw new Error('Network error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = ''; // 缓存未解析完整的行

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 关键：开启流式解码，避免把多字节中文拆断
        buffer += decoder.decode(value, { stream: true });

        // 只处理“完整行”，最后一行可能是不完整，留到下次
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;

          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;

          try {
            const j = JSON.parse(data);
            const token: string = j?.choices?.[0]?.delta?.content ?? '';
            if (token) {
              setMsgs((arr) => {
                const copy = arr.slice();
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') last.content += token;
                return copy;
              });
            }
          } catch {
            // 忽略偶发的半行/异常
          }
        }

        // 滚动到底
        listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
      }

      // 结束后兜底处理一次剩余缓冲（一般为空）
      if (buffer.startsWith('data:')) {
        try {
          const j = JSON.parse(buffer.slice(5).trim());
          const token: string = j?.choices?.[0]?.delta?.content ?? '';
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
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '抱歉，网络有点忙，请再试一次。' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {persona?.avatar_url ? (
          <img
            src={persona.avatar_url}
            alt={persona?.name || '头像'}
            width={40}
            height={40}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : null}
        <h1 style={{ fontSize: 20 }}>
          角色陪伴 · 流式对话（MVP）{persona?.name ? ` — ${persona.name}` : ''}
        </h1>
      </div>

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
            <b>{m.role === 'user' ? '你' : persona?.name || '小栖'}</b>
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
        <button
          onClick={send}
          disabled={loading}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd' }}
        >
          发送
        </button>
      </div>
    </div>
  );
}
