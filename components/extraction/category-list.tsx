"use client"

import React, { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface Category {
  name: string
  fields: any[]
}

interface CategoryListProps {
  categories: Category[]
  selectedCategory: string | null
  onSelectCategory: (name: string) => void
}

export function CategoryList({ categories, selectedCategory, onSelectCategory }: CategoryListProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8 // Adjust as needed

  const totalPages = Math.ceil(categories.length / itemsPerPage)
  
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return categories.slice(start, start + itemsPerPage)
  }, [categories, currentPage])

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1)
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1)
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between shrink-0 px-1">
        <h2 className="text-lg font-semibold text-slate-800">分类列表</h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100" onClick={() => toast.info("添加分类功能待实现")}>
          <Plus className="h-5 w-5 text-slate-600" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-2 pb-4">
            {paginatedCategories.map((category) => (
              <div
                key={category.name}
                onClick={() => onSelectCategory(category.name)}
                className={cn(
                  "p-4 rounded-xl border transition-all duration-200 group relative cursor-pointer",
                  selectedCategory === category.name
                    ? "bg-indigo-50/80 border-indigo-200 shadow-sm ring-1 ring-indigo-200/50"
                    : "bg-white border-slate-100 hover:border-indigo-200/60 hover:shadow-md hover:bg-white hover:-translate-y-0.5"
                )}
              >
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h3 className={cn(
                    "font-semibold text-sm break-words leading-snug",
                    selectedCategory === category.name ? "text-indigo-900" : "text-slate-700"
                  )}>
                    {category.name}
                  </h3>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-xs px-2 py-0.5 h-5 shrink-0 font-medium",
                      selectedCategory === category.name ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {category.fields.length}
                  </Badge>
                </div>
                <div className={cn(
                  "text-xs break-words line-clamp-2 leading-relaxed",
                  selectedCategory === category.name ? "text-indigo-600/80" : "text-slate-400"
                )}>
                  {category.fields.slice(0, 3).map(f => f.key).join(', ')}
                  {category.fields.length > 3 && '...'}
                </div>
                
                {selectedCategory === category.name && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full"></div>
                )}
              </div>
            ))}
            {paginatedCategories.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                    <p>暂无分类</p>
                </div>
            )}
          </div>
        </ScrollArea>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-2 shrink-0">
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={handlePreviousPage} 
               disabled={currentPage === 1}
               className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 disabled:opacity-30"
             >
               <ChevronLeft className="h-4 w-4" />
             </Button>
             <span className="text-xs font-medium text-slate-500">
               {currentPage} / {totalPages}
             </span>
             <Button 
               variant="ghost" 
               size="sm" 
               onClick={handleNextPage} 
               disabled={currentPage === totalPages}
               className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 disabled:opacity-30"
             >
               <ChevronRight className="h-4 w-4" />
             </Button>
          </div>
        )}
      </div>
    </div>
  )
}
