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

// 计算“字符”长度（按 Unicode 码点），并截断到 n 个“字符”
function clampChars(input: string, n: number) {
  const arr = [...input];          // code points
  return arr.length <= n ? input : arr.slice(0, n).join('') + '…';
}

export async function POST(req: Request) {
  const { history = [], userText = '', persona }: { history: Msg[]; userText: string; persona: Persona } =
    await req.json();

  const sys = buildSystem(persona);
  const messages: Msg[] = [
    { role: 'system', content: sys },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ];

  // 调 OpenAI（或你当前模型）做流式
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',        // 可按需替换
      stream: true,
      temperature: 0.7,
      messages,
      // max_tokens: 200,           // 可选
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('data: {"error":"upstream failed"}\n\n', { headers: sseHeaders, status: 500 });
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let acc = ''; // 累计已发送的字符（用于 120 字限制）

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          for (const line of chunk.split('\n')) {
            const l = line.trim();
            if (!l.startsWith('data:')) continue;

            const payload = l.replace(/^data:\s*/, '');
            if (payload === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }

            try {
              const j = JSON.parse(payload);
              const token: string = j?.choices?.[0]?.delta?.content ?? '';
              if (!token) continue;

              // 计算还可发送的“字符”数
              const room = 120 - [...acc].length;
              if (room <= 0) continue;

              // 只发送剩余可用的部分
              const toEmit = [...token].slice(0, room).join('');
              if (toEmit) {
                acc += toEmit;
                const passthrough = { choices: [{ delta: { content: toEmit } }] };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(passthrough)}\n\n`));
              }
            } catch {
              // 忽略异常行
            }
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}
