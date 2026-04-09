import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { defaultLocale, locales, LOCALE_COOKIE, type Locale } from './config'

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  let locale: Locale = defaultLocale

  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    locale = cookieLocale as Locale
  } else {
    const acceptLang = headerStore.get('accept-language') || ''
    if (/^en\b/i.test(acceptLang)) {
      locale = 'en'
    }
  }

  const messages = (await import(`../../messages/${locale}.json`)).default

  return { locale, messages }
})
