// app/api/persona/route.ts
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { visitorId, name, style_short, canon, avatar_url } = body || {};

    if (!visitorId || !name) {
      return Response.json(
        { ok: false, error: 'visitorId 和 name 不能为空' },
        { status: 400 }
      );
    }

    // 1) 按 visitor_id upsert 用户
    let userId: string;
    {
      const { data: found, error: findErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('visitor_id', visitorId)
        .maybeSingle();
      if (findErr) throw findErr;

      if (found?.id) {
        userId = found.id;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin
          .from('users')
          .insert([{ visitor_id: visitorId }])
          .select('id')
          .single();
        if (createErr) throw createErr;
        userId = created.id;
      }
    }

    // 2) 创建 persona（把头像地址一起写入）
    const { data: persona, error: perErr } = await supabaseAdmin
      .from('personas')
      .insert([
        {
          user_id: userId,
          name,
          avatar_url: avatar_url ?? null,
          style_short: style_short ?? null,
          canon: canon ?? null,
          system_prompt: null,
        },
      ])
      .select('id, name, avatar_url, style_short, canon')
      .single();

    if (perErr) throw perErr;

    return Response.json({ ok: true, persona });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
