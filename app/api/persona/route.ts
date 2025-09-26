import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { visitorId, name, style_short, canon, avatar_url } = await req.json();

    // 1) upsert 用户（按 visitor_id）
    let userId: string | null = null;
    {
      const { data: foundUser, error: findErr } = await supabaseAdmin
        .from('users').select('id').eq('visitor_id', visitorId).maybeSingle();
      if (findErr) throw findErr;

      if (foundUser?.id) {
        userId = foundUser.id;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin
          .from('users').insert([{ visitor_id: visitorId }]).select('id').single();
        if (createErr) throw createErr;
        userId = created.id;
      }
    }

    // 2) 创建 persona
    const { data: persona, error: perErr } = await supabaseAdmin
      .from('personas')
      .insert([{
        user_id: userId,
        name,
        avatar_url,
        style_short,
        canon,
        system_prompt: null
      }])
      .select('id, name, avatar_url, style_short, canon')
      .single();
    if (perErr) throw perErr;

    return Response.json({ ok: true, persona });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

