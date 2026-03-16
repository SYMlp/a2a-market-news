import type { Metadata } from 'next'
import Providers from './Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'A2A 智选日报 - Agent 市场信息平台',
  description: '发现最优质的 Agent-to-Agent 应用',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
