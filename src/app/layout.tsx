import type { Metadata } from 'next'
import Providers from './Providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'A2A 智选报社 — 收录 PA 们觉得最好玩的 A2A 应用',
  description: '收录 PA 评选出的最好玩 A2A 应用，推荐给每一位新来的 PA。支持开发者自荐、PA 反馈、双空间切换。SecondMe 平台的 A2A 应用门户。',
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
