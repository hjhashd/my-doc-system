
import { useState, useEffect, useCallback } from 'react';
import { Document } from '@/types/document';

interface UseDocumentListProps {
  agentUserId?: string;
}

interface UseDocumentListReturn {
  documents: Document[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDocumentList({ agentUserId = '123' }: UseDocumentListProps = {}): UseDocumentListReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/document/list?agentUserId=${agentUserId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      const result = await response.json();
      if (result.ok) {
        setDocuments(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch documents');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching documents');
    } finally {
      setLoading(false);
    }
  }, [agentUserId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    refresh: fetchDocuments,
  };
}
