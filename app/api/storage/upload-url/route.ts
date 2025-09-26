// app/api/storage/upload-url/route.ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { filename } = await req.json();
    if (!filename) {
      return Response.json({ ok: false, error: 'filename required' }, { status: 400 });
    }

    // 确保 avatars 桶存在（没有就创建；Public 读）
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const has = buckets?.some(b => b.name === 'avatars');
    if (!has) {
      await supabaseAdmin.storage.createBucket('avatars', { public: true });
    }

    // 为这次上传生成一个唯一路径
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `u/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // 生成签名上传 token
    const { data, error } = await supabaseAdmin
      .storage.from('avatars')
      .createSignedUploadUrl(path); // { token, signedUrl }

    if (error || !data) throw error || new Error('createSignedUploadUrl failed');

    return Response.json({ ok: true, path, token: data.token });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

