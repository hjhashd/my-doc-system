"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Brain,
  BarChart3,
  FileCheck,
  Eye,
  Search,
  Shuffle,
  PanelLeft,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic";

// 保留原有的动态加载逻辑
const LazyParsingPage = dynamic(() => import("@/components/document-parsing-interface"));

const navigation = [
  { name: "仪表板", href: "/", icon: BarChart3 },

  // 功能区
  { name: "文档识别", href: "/upload", icon: Eye },
  { name: "文档解析", href: "/parsing", icon: FileCheck, component: LazyParsingPage },
  { name: "信息抽取", href: "/extraction", icon: Search },
  { name: "格式转换", href: "/format-conversion", icon: Shuffle },
  // { name: "文档比对", href: "/comparison", icon: GitCompare }, // 保留注释
]

export function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // 监听来自header的收起事件 (保留原有逻辑)
  useEffect(() => {
    const handleToggleSidebar = () => {
      setIsCollapsed(prev => !prev)
    }
    
    window.addEventListener('toggleSidebar', handleToggleSidebar)
    return () => {
      window.removeEventListener('toggleSidebar', handleToggleSidebar)
    }
  }, [])

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  return (
    <div 
      className={cn(
        "relative flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-20",
        isCollapsed ? "w-20" : "w-72" // 稍微加宽一点，让文字不那么局促
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-sidebar
    >
      {/* 1. Logo / 品牌区域 */}
      <div className={cn(
        "flex items-center h-20 border-b border-sidebar-border/50 transition-all duration-300",
        isCollapsed ? "justify-center px-0" : "px-6"
      )}>
        <Link href="/" className="flex items-center gap-3 overflow-hidden whitespace-nowrap group">
          <div className={cn(
            "flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all duration-300",
            isCollapsed ? "w-10 h-10" : "w-10 h-10 group-hover:scale-105"
          )}>
            <Brain className="w-6 h-6" />
          </div>
          
          <div className={cn(
            "flex flex-col transition-all duration-300 opacity-100",
            isCollapsed && "opacity-0 w-0 hidden"
          )}>
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">智能文档系统</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Knowledge Engine</span>
          </div>
        </Link>
      </div>

      {/* 2. 导航区域 */}
      <ScrollArea className="flex-1 py-6">
        <nav className="space-y-2 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 outline-none hover:bg-sidebar-accent/50",
                  // 选中状态样式：使用 Primary 色的浅色背景，文字加粗
                  isActive 
                    ? "bg-primary/10 text-primary shadow-sm hover:bg-primary/15" 
                    : "text-muted-foreground hover:text-sidebar-foreground",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                {/* 装饰条：仅在展开且选中时显示 */}
                {!isCollapsed && isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-primary" />
                )}

                <item.icon className={cn(
                  "shrink-0 transition-all duration-300",
                  isCollapsed ? "w-6 h-6" : "w-5 h-5",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"
                )} />

                <span className={cn(
                  "overflow-hidden transition-all duration-300 whitespace-nowrap",
                  isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100",
                  isActive && "font-semibold"
                )}>
                  {item.name}
                </span>

                {/* 悬浮时的Tooltip效果（仅收起时） */}
                {isCollapsed && (
                   <div className="absolute left-full ml-4 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap border">
                     {item.name}
                   </div>
                )}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* 3. 底部收起/展开控制区 */}
      <div className="p-4 border-t border-sidebar-border/50">
        <Button
          variant="ghost"
          onClick={toggleSidebar}
          className={cn(
            "w-full h-10 flex items-center gap-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-300",
            isCollapsed ? "justify-center px-0" : "justify-start px-3"
          )}
        >
          {isCollapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <ChevronsLeft className="h-5 w-5" />
          )}
          
          <span className={cn(
            "text-sm font-medium whitespace-nowrap transition-all duration-300",
            isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100"
          )}>
            收起侧边栏
          </span>
        </Button>
      </div>
    </div>
  )
}