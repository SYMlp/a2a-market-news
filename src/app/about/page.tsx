import Link from 'next/link'
import Header from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getTranslations } from 'next-intl/server'

export default async function AboutPage() {
  const t = await getTranslations('about')
  const tc = await getTranslations('common')

  const cards = [
    { num: '01', icon: '🏆', titleKey: 'card01Title' as const, descKey: 'card01Desc' as const, tagKey: 'card01Tag' as const },
    { num: '02', icon: '💬', titleKey: 'card02Title' as const, descKey: 'card02Desc' as const, tagKey: 'card02Tag' as const },
    { num: '03', icon: '🔄', titleKey: 'card03Title' as const, descKey: 'card03Desc' as const, tagKey: 'card03Tag' as const },
    { num: '04', icon: '🛠️', titleKey: 'card04Title' as const, descKey: 'card04Desc' as const, tagKey: 'card04Tag' as const },
  ]

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="home" />

      <main className="relative">
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <div className="text-6xl pulse-glow">🐰</div>
            <h2 className="text-5xl font-extrabold text-gray-800 font-heading">
              {t('heroTitle')}
            </h2>
            <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto font-body">
              {t('heroSubtitle')}
            </p>
          </div>
          <div className="absolute top-1/4 left-10 w-64 h-64 bg-orange-200/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-amber-200/20 rounded-full blur-3xl" />
        </section>

        <section className="relative py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-800 font-heading mb-3">
                {t('whatWeDo')}
              </h2>
              <p className="text-gray-500">{t('fourThings')}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {cards.map(item => (
                <Card key={item.num} className="p-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{item.icon}</span>
                    <div>
                      <span className="text-xs text-orange-500 font-semibold tracking-wider uppercase">{t(item.tagKey)}</span>
                      <h3 className="text-xl font-bold text-gray-800 font-heading">{t(item.titleKey)}</h3>
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{t(item.descKey)}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="relative py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
              <div className="text-7xl flex-shrink-0">🐰</div>
              <div className="space-y-4">
                <h3 className="text-2xl font-bold text-gray-800 font-heading">{t('rabbitTitle')}</h3>
                <p className="text-gray-500 leading-relaxed">
                  {t('rabbitBody')}
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="relative py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <p className="text-sm text-orange-500 tracking-widest font-body">{t('poweredBy')}</p>
            <h2 className="text-3xl font-extrabold text-gray-800 font-heading">SecondMe</h2>
            <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
              {t('secondmeBody')}
            </p>
            <div className="pt-4">
              <Button asChild>
                <Link href="/">{t('backHome')}</Link>
              </Button>
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
                <div className="text-gray-800 font-bold font-heading">{tc('brandName')}</div>
                <div className="text-xs text-gray-400">{tc('brandTagline')}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {tc('copyright')}
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-orange-600 font-semibold hover:text-orange-500 transition-colors">
                {tc('about')}
              </Link>
              <Link href="/docs" className="text-gray-500 hover:text-orange-500 transition-colors">
                {tc('docs')}
              </Link>
              <Link href="/contact" className="text-gray-500 hover:text-orange-500 transition-colors">
                {tc('contact')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
