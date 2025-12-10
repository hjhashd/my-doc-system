export interface DocumentElementCounts {
  text: number;
  tables: number;
  images: number;
}

// 文档统计信息
export interface DocumentStatistics {
  text_blocks_count: number;
  tables_count: number;
  images_count: number;
  total_pages: number;
  file_size_kb: number;
  processing_time_seconds?: number; // 处理时间（秒）
  // 可以根据实际后端返回扩展更多字段
  [key: string]: any;
}

export interface Document {
  id: string;
  name: string;
  customName?: string; // 用户自定义名称
  physicalName?: string; // 物理文件名
  type: string;
  uploadDate: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  size: string;
  pages: number;
  elements: DocumentElementCounts;
  statistics?: DocumentStatistics; // 添加可选的统计信息字段
}

// 详情内容的类型定义 (用于替换原来的 mockContentDetails)
export interface ContentDetailItem {
  id: string;
  type: string; // heading, paragraph, table, chart, etc.
  content?: string; // 文本内容
  page: number;
  confidence: number;
  imageUrl?: string; // 图片URL，用于图片预览
  // 可以根据实际后端返回扩展更多字段
  [key: string]: any; 
}

export interface DocumentDetails {
  text: ContentDetailItem[];
  tables: ContentDetailItem[];
  images: ContentDetailItem[];
}