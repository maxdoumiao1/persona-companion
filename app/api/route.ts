import type { NextRequest } from 'next/server';

export const runtime = 'edge';

function systemPrompt() {
  return (
    '你是名为「小栖」的温柔陪伴角色。' +
    '始终以共情、克制的语气回答。单条回复不超过120个汉字，必要时用省略号收束。' +
    '避免灌水和堆砌，不要使用表情符号。'
  );
}

export async function POST(req: NextRequest) {
  const { history = [], userText = '' } = await req.json();

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      temperature: 0.7,
      max_tokens: 200,
      messages: [
        { role: 'system', content: systemPrompt() },
        ...history,
        { role: 'user', content: userText },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response('data: {"error":"upstream failed"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 500,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const encoder = new TextEncoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        controller.enqueue(value);
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

