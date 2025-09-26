// app/api/chat/route.ts
import { buildSystem } from '@/lib/ai/buildSystem';

export const runtime = 'edge';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };
type Persona = { name?: string; style_short?: string | null; canon?: string | null };

const sseHeaders = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
} as const;

export async function POST(req: Request) {
  const { history = [], userText = '', persona }: { history: Msg[]; userText: string; persona: Persona } =
    await req.json();

  const system = buildSystem(persona);
  const messages: Msg[] = [
    { role: 'system', content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ];

  // 请求上游（OpenAI）
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      temperature: 0.7,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('data: {"error":"upstream failed"}\n\n', { headers: sseHeaders, status: 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');

  // 已发送的“字符”（按 Unicode 码点计数），用于 120 字限制
  let acc = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = ''; // 缓存未拼成完整行的内容

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // 关键：流式解码，避免把多字节中文拆坏
          buffer += decoder.decode(value, { stream: true });

          // 只处理完整行，尾行可能是不完整，留到下轮
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const raw of lines) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;

            const payload = line.slice(5).trim();
            if (payload === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              continue;
            }

            try {
              const j = JSON.parse(payload);
              const token: string = j?.choices?.[0]?.delta?.content ?? '';
              if (!token) continue;

              // 计算还能发多少“字符”
              const used = [...acc].length;
              const room = 120 - used;
              if (room <= 0) continue;

              const toEmit = [...token].slice(0, room).join('');
              if (toEmit) {
                acc += toEmit;
                const passthrough = { choices: [{ delta: { content: toEmit } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(passthrough)}\n\n`));
              }
            } catch {
              // 半行 / 异常忽略
            }
          }
        }

        // 兜底：如果还有残留缓冲，尝试再处理一次
        if (buffer.startsWith('data:')) {
          try {
            const j = JSON.parse(buffer.slice(5).trim());
            const token: string = j?.choices?.[0]?.delta?.content ?? '';
            if (token) {
              const used = [...acc].length;
              const room = 120 - used;
              const toEmit = room > 0 ? [...token].slice(0, room).join('') : '';
              if (toEmit) {
                const passthrough = { choices: [{ delta: { content: toEmit } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(passthrough)}\n\n`));
              }
            }
          } catch {}
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
