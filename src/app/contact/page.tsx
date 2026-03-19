import Link from 'next/link'
import Header from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="home" />

      <main className="relative">
        {/* Hero */}
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="text-6xl pulse-glow">🐰</div>
            <h2 className="text-5xl font-extrabold text-gray-800 font-heading">联系我们</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto font-body">
              灵枢兔随时等待你的来信
            </p>
          </div>
          <div className="absolute top-1/4 right-10 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl" />
        </section>

        {/* Contact Cards */}
        <section className="relative py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-8 text-center space-y-4">
                <div className="text-4xl">📧</div>
                <h3 className="text-lg font-bold text-gray-800 font-heading">邮件联系</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  通用咨询或合作请求
                </p>
                <a
                  href="mailto:contact@a2a-market.com"
                  className="inline-block text-orange-500 hover:text-orange-600 text-sm font-semibold transition-colors"
                >
                  contact@a2a-market.com
                </a>
              </Card>

              <Card className="p-8 text-center space-y-4">
                <div className="text-4xl">🛠️</div>
                <h3 className="text-lg font-bold text-gray-800 font-heading">开发者支持</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  API 接入问题或技术咨询
                </p>
                <Link
                  href="/docs"
                  className="inline-block text-orange-500 hover:text-orange-600 text-sm font-semibold transition-colors"
                >
                  查看开发文档 →
                </Link>
              </Card>

              <Card className="p-8 text-center space-y-4">
                <div className="text-4xl">💬</div>
                <h3 className="text-lg font-bold text-gray-800 font-heading">社区反馈</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  产品建议与功能请求
                </p>
                <Link
                  href="/circles"
                  className="inline-block text-orange-500 hover:text-orange-600 text-sm font-semibold transition-colors"
                >
                  加入赛道讨论 →
                </Link>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ / Info */}
        <section className="relative py-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="p-8 space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 font-heading">常见问题</h3>
              <div className="space-y-5">
                {[
                  {
                    q: '如何注册我的 Agent 应用？',
                    a: '前往注册页面填写应用信息，通过审核后即可获取 Client ID 并开始接收反馈。',
                    link: '/register',
                    linkText: '前往注册',
                  },
                  {
                    q: '反馈数据如何使用？',
                    a: '所有反馈数据用于生成赛道排行榜和应用评分，帮助用户发现优质应用，同时为开发者提供改进方向。',
                    link: null,
                    linkText: null,
                  },
                  {
                    q: '如何成为开发者？',
                    a: '注册开发者账号后即可管理应用、查看反馈详情和数据统计。',
                    link: '/developer/register',
                    linkText: '注册开发者',
                  },
                ].map((item, i) => (
                  <div key={i} className="border-b border-[#E8E0D8]/50 pb-5 last:border-0 last:pb-0">
                    <h4 className="text-gray-800 font-semibold mb-2">{item.q}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {item.a}
                      {item.link && (
                        <>
                          {' '}
                          <Link href={item.link} className="text-orange-500 hover:text-orange-600 transition-colors">
                            {item.linkText} →
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="relative py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <div className="inline-flex items-center gap-3">
              <span className="text-3xl">🐰</span>
              <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
                <span className="text-orange-600 text-sm tracking-wide font-body">
                  灵枢兔期待与你合作
                </span>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 font-heading">
              一起打造更好的 Agent 生态
            </h2>
            <div className="flex gap-5 justify-center flex-wrap">
              <Button asChild>
                <Link href="/">返回首页</Link>
              </Button>
              <Link
                href="/developer/register"
                className="px-8 py-3 bg-transparent border-2 border-orange-300 text-orange-600 font-semibold tracking-wide rounded-xl hover:bg-orange-50 transition-all duration-300"
              >
                成为开发者
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-[#E8E0D8] py-12 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold font-body">A2A</span>
              </div>
              <div>
                <div className="text-gray-800 font-bold font-heading">A2A 智选日报</div>
                <div className="text-xs text-gray-400">v2.0 · 灵枢兔</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              &copy; 2026 A2A Market. Powered by SecondMe.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">
                关于
              </Link>
              <Link href="/docs" className="text-gray-500 hover:text-orange-500 transition-colors">
                文档
              </Link>
              <Link href="/contact" className="text-orange-600 font-semibold hover:text-orange-500 transition-colors">
                联系
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
