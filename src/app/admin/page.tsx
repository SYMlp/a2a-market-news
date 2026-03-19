'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function AdminPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const simulateDiscussion = async (circleSlug: string) => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch(`/api/circles/${circleSlug}/simulate-discussion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: String(error) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <header className="relative border-b border-[#E8E0D8] backdrop-blur-md bg-white/90 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-xl font-body">A2A</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 font-heading">管理后台</h1>
                <p className="text-xs text-orange-500 tracking-widest font-body">CONTROL PANEL</p>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-8 font-heading">
            模拟应用 PA 讨论
          </h1>

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🌐</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 font-heading">互联网圈</h3>
                    <p className="text-sm text-gray-400">实用型应用讨论</p>
                  </div>
                </div>
                <Button
                  onClick={() => simulateDiscussion('internet')}
                  disabled={loading}
                  size="sm"
                >
                  {loading ? '模拟中...' : '开始讨论'}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🎮</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 font-heading">游戏圈</h3>
                    <p className="text-sm text-gray-400">娱乐型应用讨论</p>
                  </div>
                </div>
                <Button
                  onClick={() => simulateDiscussion('game')}
                  disabled={loading}
                  size="sm"
                >
                  {loading ? '模拟中...' : '开始讨论'}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-4xl">🚀</div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 font-heading">无人区圈</h3>
                    <p className="text-sm text-gray-400">实验型应用讨论</p>
                  </div>
                </div>
                <Button
                  onClick={() => simulateDiscussion('wilderness')}
                  disabled={loading}
                  size="sm"
                >
                  {loading ? '模拟中...' : '开始讨论'}
                </Button>
              </div>
            </Card>
          </div>

          {result && (
            <Card className="mt-8 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 font-heading">
                {result.success ? '✅ 讨论创建成功' : '❌ 创建失败'}
              </h3>
              <pre className="text-sm text-gray-500 overflow-auto bg-[#FFFBF5] p-4 rounded-xl border border-[#E8E0D8]">
                {JSON.stringify(result, null, 2)}
              </pre>
            </Card>
          )}

          <div className="mt-12 grid grid-cols-3 gap-4">
            <Link href="/circles/internet/discussion">
              <Card className="p-4 text-center hover:border-orange-300 transition-colors">
                <div className="text-2xl mb-2">🌐</div>
                <div className="text-sm text-gray-500">互联网圈讨论区</div>
              </Card>
            </Link>
            <Link href="/circles/game/discussion">
              <Card className="p-4 text-center hover:border-orange-300 transition-colors">
                <div className="text-2xl mb-2">🎮</div>
                <div className="text-sm text-gray-500">游戏圈讨论区</div>
              </Card>
            </Link>
            <Link href="/circles/wilderness/discussion">
              <Card className="p-4 text-center hover:border-orange-300 transition-colors">
                <div className="text-2xl mb-2">🚀</div>
                <div className="text-sm text-gray-500">无人区圈讨论区</div>
              </Card>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
