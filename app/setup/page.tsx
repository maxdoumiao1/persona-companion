// app/setup/page.tsx
'use client';
import React, { useEffect, useState, ChangeEvent } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';

function uid() {
  return 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function SetupPage() {
  const [name, setName] = useState('小栖');
  const [styleShort, setStyleShort] = useState('温柔、简短、共情');
  const [canon, setCanon] = useState('你的知心陪伴者，语气克制，避免灌水。');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 准备 visitorId（存在本地，服务端按它建用户）
  useEffect(() => {
    if (!localStorage.getItem('visitorId')) {
      localStorage.setItem('visitorId', uid());
    }
  }, []);

  // 通过服务端签名，上传到 Supabase Storage（avatars 桶）
  async function uploadAvatar(): Promise<string | null> {
    if (!avatarFile) return null;

    // 1) 请求一次性上传 token
    const r = await fetch('/api/storage/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: avatarFile.name }),
    });
    const j = await r.json();
    if (!j.ok) {
      alert('获取上传地址失败：' + (j.error || ''));
      return null;
    }
    const { path, token } = j;

    // 2) 使用签名 token 上传
    const { error: upErr } = await supabaseClient
      .storage.from('avatars')
      .uploadToSignedUrl(path, token, avatarFile);
    if (upErr) {
      alert('头像上传失败：' + upErr.message);
      return null;
    }

    // 3) 获取公开访问 URL
    const { data: pub } = supabaseClient.storage.from('avatars').getPublicUrl(path);
    return pub.publicUrl ?? null;
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const visitorId = localStorage.getItem('visitorId')!;
      const avatar_url = await uploadAvatar(); // 可能为 null

      const res = await fetch('/api/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          name,
          style_short: styleShort,
          canon,
          avatar_url,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || '创建失败');

      // 存入本地，聊天页会读取显示头像与名称
      localStorage.setItem('persona', JSON.stringify(j.persona));

      // 跳转聊天
      window.location.href = '/chat';
    } catch (e: any) {
      alert('提交失败：' + (e?.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) =>
    setAvatarFile(e.target.files?.[0] ?? null);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>创建你的角色（≤30秒）</h1>

      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          头像（可选）：
          <input type="file" accept="image/*" onChange={onPick} />
        </label>

        <label>
          名称：
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </label>

        <label>
          说话风格（可改）：
          <div style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            {['温柔、简短、共情', '清爽、理性、专业', '俏皮、轻松、暖心'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyleShort(s)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: styleShort === s ? '2px solid #333' : '1px solid #ddd',
                  background: styleShort === s ? '#f5f5f5' : '#fff',
                }}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={styleShort}
            onChange={(e) => setStyleShort(e.target.value)}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </label>

        <label>
          人设简述（≤200字）：
          <textarea
            value={canon}
            onChange={(e) => setCanon(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
          />
        </label>

        <button
          onClick={submit}
          disabled={submitting}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', width: 160 }}
        >
          {submitting ? '创建中…' : '开始聊天'}
        </button>
      </div>
    </div>
  );
}

