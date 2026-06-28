import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppHeader } from "@/components/app-header";
import { Toaster } from 'sonner';
import "./globals.css";

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
  metadataBase: new URL("https://www.yesdrop.online"),
  title: "YesDrop — email approvals on autopilot",
  description:
    "Send approval requests by email, set deadlines, and let automatic reminders chase the reply. Track every response in one place.",
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
        <Providers>
          <AppHeader />
          {children}
          <Toaster position="top-right" expand={false} richColors />
        </Providers>
      </body>
    </html>
  );
}
