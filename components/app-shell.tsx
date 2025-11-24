"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { cn } from "@/lib/utils"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const bare = pathname?.startsWith("/excel-editor") ?? false

  if (bare) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300")}> 
        <Header />
        <main className="flex-1 main-scroll">{children}</main>
      </div>
    </div>
  )
}

