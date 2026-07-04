import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppHeader } from "@/components/app-header";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { ConsentBanner } from "@/components/consent-banner";
import { JsonLd } from "@/components/json-ld";
import { Toaster } from 'sonner';
import "./globals.css";

const SITE_URL = "https://www.yesdrop.online";

// Site-wide structured data for search + AI answer engines. Page-specific
// schema (FAQPage, BreadcrumbList) lives with the pages that render it.
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "YesDrop",
  url: SITE_URL,
  logo: `${SITE_URL}/yesdrop-logo.png`,
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "YesDrop",
  url: SITE_URL,
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "YesDrop",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "Send approval requests by email, set deadlines, and let automatic reminders chase the reply. Track every response in one place.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlex = IBM_Plex_Sans({
  variable: "--font-ibm-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "YesDrop — email approvals on autopilot",
  description:
    "Send approval requests by email, set deadlines, and let automatic reminders chase the reply. Track every response in one place.",
  alternates: { canonical: "/" },
  verification: {
    google: "6RSi-HY3Dp1Ntaa1wDuRs1N2g1vT7RNTsCdu7dfry08",
  },
  openGraph: {
    title: "YesDrop — email approvals on autopilot",
    description:
      "Send approval requests by email, set deadlines, and let automatic reminders chase the reply.",
    url: "https://www.yesdrop.online",
    siteName: "YesDrop",
    images: [{ url: "/yesdrop-logo.png", width: 1600, height: 800, alt: "YesDrop" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YesDrop — email approvals on autopilot",
    description:
      "Send approval requests by email, set deadlines, and let automatic reminders chase the reply.",
    images: ["/yesdrop-logo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} ${ibmPlex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <GoogleAnalytics />
        <JsonLd data={orgSchema} />
        <JsonLd data={websiteSchema} />
        <JsonLd data={softwareSchema} />
        <Providers>
          <AppHeader />
          {children}
          <Toaster position="top-right" expand={false} richColors />
        </Providers>
        <ConsentBanner />
      </body>
    </html>
  );
}
