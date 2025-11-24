import type React from "react"
import type { Metadata } from "next"
import { DM_Sans } from "next/font/google"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider } from "@/components/theme-provider"
import { Suspense } from "react"
import { AppShell } from "@/components/app-shell"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "智能文档知识工程系统 | Intelligent Document Knowledge Engineering",
  description: "基于LangExtract和Dolphin的智能文档分析与知识管理系统",
  generator: "v0.app",
}

// 在开发环境中完全禁用Analytics
function AnalyticsWrapper() {
  if (process.env.NODE_ENV === 'production') {
    return <Analytics />
  }
  return null
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`font-sans ${dmSans.variable} ${GeistMono.variable} antialiased`}>
        <Suspense fallback={null}>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </Suspense>
        <AnalyticsWrapper />
      </body>
    </html>
  )
}
