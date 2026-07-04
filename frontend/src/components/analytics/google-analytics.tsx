import Script from 'next/script'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID

// Google Analytics 4 wired behind Google Consent Mode v2. Consent defaults to
// "denied" before gtag loads, so GA sets no cookies and does no tracking until
// the visitor accepts (see consent-banner.tsx). Renders nothing when
// NEXT_PUBLIC_GA_ID is unset, so preview/dev without the env var stays clean.
export function GoogleAnalytics() {
  if (!GA_ID) return null

  return (
    <>
      <Script id="ga-consent-default" strategy="beforeInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
          gtag('js', new Date());
        `}
      </Script>
      <Script
        id="ga-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`gtag('config', '${GA_ID}');`}
      </Script>
    </>
  )
}
