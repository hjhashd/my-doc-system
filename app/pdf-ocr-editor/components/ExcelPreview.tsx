import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

interface ExcelPreviewProps {
  url: string;
}

export function ExcelPreview({ url }: ExcelPreviewProps) {
  const [data, setData] = useState<any[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExcel = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch Excel file');
        }
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        setData(jsonData);
      } catch (err) {
        console.error('Error loading Excel:', err);
        setError('无法加载表格数据');
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchExcel();
    }
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <div className="w-12 h-12 border-4 border-emerald-100 rounded-full"></div>
                <div className="absolute top-0 w-12 h-12 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-sm font-medium text-emerald-600 animate-pulse">正在加载表格数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
          <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center max-w-sm">
             <p className="text-red-600 font-medium mb-1">加载失败</p>
             <p className="text-sm text-red-500/80">{error}</p>
          </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-slate-50/30">
        <div className="text-center">
            <p>表格无数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full w-full bg-white p-6">
      <div className="inline-block min-w-full align-middle shadow-[0_0_15px_rgba(0,0,0,0.05)] rounded-lg overflow-hidden border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
            <thead>
                {data.length > 0 && (
                    <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 sticky top-0 z-10">
                        {data[0].map((cell, index) => (
                            <th 
                                key={index} 
                                className="border-b border-emerald-100/80 px-6 py-4 text-left font-semibold text-emerald-800/90 whitespace-nowrap text-sm tracking-wide"
                            >
                                {cell !== null && cell !== undefined ? String(cell) : ''}
                            </th>
                        ))}
                    </tr>
                )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.slice(1).map((row, rowIndex) => (
                <tr 
                    key={rowIndex} 
                    className="group hover:bg-emerald-50/30 transition-colors duration-150 ease-in-out"
                >
                  {row.map((cell, cellIndex) => (
                    <td 
                      key={cellIndex} 
                      className="px-6 py-3.5 text-slate-600 whitespace-nowrap group-hover:text-slate-900 transition-colors"
                    >
                      {cell !== null && cell !== undefined ? String(cell) : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}
