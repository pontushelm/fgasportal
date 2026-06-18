import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://app.helmpolar.se"),
  title: "Helm Polar",
  description: "F-gasregister för aggregat, kontroller, CO₂e och påminnelser.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="sv"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  )
}
