import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Persona Bot',
  description: 'Minimal starter for companion bot V1.0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, Helvetica, Arial',
        }}
      >
        {children}
      </body>
    </html>
  );
}
