export interface DocumentElementCounts {
  text: number;
  tables: number;
  images: number;
}

export interface Document {
  id: string;
  name: string;
  physicalName?: string; // 物理文件名
  type: string;
  uploadDate: string;
  status: 'completed' | 'processing' | 'pending' | 'failed';
  size: string;
  pages: number;
  elements: DocumentElementCounts;
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