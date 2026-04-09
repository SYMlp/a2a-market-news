import Link from 'next/link'
import Header from '@/components/Header'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { getTranslations } from 'next-intl/server'

export default async function ContactPage() {
  const t = await getTranslations('contact')
  const tc = await getTranslations('common')

  const faqItems: Array<{
    q: 'faq1q' | 'faq2q' | 'faq3q'
    a: 'faq1a' | 'faq2a' | 'faq3a'
    link: string | null
    linkText: 'faq1Link' | 'faq3Link' | null
  }> = [
    { q: 'faq1q', a: 'faq1a', link: '/register', linkText: 'faq1Link' },
    { q: 'faq2q', a: 'faq2a', link: null, linkText: null },
    { q: 'faq3q', a: 'faq3a', link: '/developer/register', linkText: 'faq3Link' },
  ]

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 cyber-grid pointer-events-none" />

      <Header activeNav="home" />

      <main className="relative">
        <section className="relative py-24 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-50/60 via-transparent to-transparent" />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <div className="text-6xl pulse-glow">🐰</div>
            <h2 className="text-5xl font-extrabold text-gray-800 font-heading">{t('heroTitle')}</h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto font-body">
              {t('heroSubtitle')}
            </p>
          </div>
          <div className="absolute top-1/4 right-10 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl" />
        </section>

        <section className="relative py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-8 text-center space-y-4">
                <div className="text-4xl">📧</div>
                <h3 className="text-lg font-bold text-gray-800 font-heading">{t('emailTitle')}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t('emailDesc')}
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
                <h3 className="text-lg font-bold text-gray-800 font-heading">{t('devTitle')}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t('devDesc')}
                </p>
                <Link
                  href="/docs"
                  className="inline-block text-orange-500 hover:text-orange-600 text-sm font-semibold transition-colors"
                >
                  {t('devLink')}
                </Link>
              </Card>

              <Card className="p-8 text-center space-y-4">
                <div className="text-4xl">💬</div>
                <h3 className="text-lg font-bold text-gray-800 font-heading">{t('communityTitle')}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t('communityDesc')}
                </p>
                <Link
                  href="/circles"
                  className="inline-block text-orange-500 hover:text-orange-600 text-sm font-semibold transition-colors"
                >
                  {t('communityLink')}
                </Link>
              </Card>
            </div>
          </div>
        </section>

        <section className="relative py-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="p-8 space-y-6">
              <h3 className="text-2xl font-bold text-gray-800 font-heading">{t('faqTitle')}</h3>
              <div className="space-y-5">
                {faqItems.map((item, i) => (
                  <div key={i} className="border-b border-[#E8E0D8]/50 pb-5 last:border-0 last:pb-0">
                    <h4 className="text-gray-800 font-semibold mb-2">{t(item.q)}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">
                      {t(item.a)}
                      {item.link && item.linkText && (
                        <>
                          {' '}
                          <Link href={item.link} className="text-orange-500 hover:text-orange-600 transition-colors">
                            {t(item.linkText)} →
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

        <section className="relative py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <div className="inline-flex items-center gap-3">
              <span className="text-3xl">🐰</span>
              <div className="px-6 py-2 bg-orange-50 border border-orange-200 rounded-full">
                <span className="text-orange-600 text-sm tracking-wide font-body">
                  {t('ctaBadge')}
                </span>
              </div>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-800 font-heading">
              {t('ctaTitle')}
            </h2>
            <div className="flex gap-5 justify-center flex-wrap">
              <Button asChild>
                <Link href="/">{t('backHome')}</Link>
              </Button>
              <Link
                href="/developer/register"
                className="px-8 py-3 bg-transparent border-2 border-orange-300 text-orange-600 font-semibold tracking-wide rounded-xl hover:bg-orange-50 transition-all duration-300"
              >
                {t('becomeDeveloper')}
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
                <div className="text-gray-800 font-bold font-heading">{tc('footerBrand')}</div>
                <div className="text-xs text-gray-400">{tc('footerVersion')}</div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {tc('copyright')}
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/about" className="text-gray-500 hover:text-orange-500 transition-colors">
                {tc('about')}
              </Link>
              <Link href="/docs" className="text-gray-500 hover:text-orange-500 transition-colors">
                {tc('docs')}
              </Link>
              <Link href="/contact" className="text-orange-600 font-semibold hover:text-orange-500 transition-colors">
                {tc('contact')}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
