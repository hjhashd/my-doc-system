
import { useState, useCallback, useRef, useEffect } from 'react';

export interface ExtractionTask {
  taskId: string;
  status: 'idle' | 'extracting' | 'generating' | 'completed' | 'error';
  progress: number;
  message?: string;
  result?: any;
}

interface UseEntityExtractionReturn {
  task: ExtractionTask;
  startExtraction: (params: any) => Promise<void>;
  startGeneration: (params: any) => Promise<void>;
  resetTask: () => void;
}

export function useEntityExtraction(): UseEntityExtractionReturn {
  const [task, setTask] = useState<ExtractionTask>({
    taskId: '',
    status: 'idle',
    progress: 0,
  });
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const pollStatus = useCallback(async (taskId: string, type: 'extract' | 'generate') => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/status?taskId=${taskId}&type=${type}`);
        
        if (!response.ok) {
           // If 404, keep polling for a bit or handle error
           if(response.status !== 404) {
             throw new Error(`Failed to check status: ${response.statusText}`);
           }
           return;
        }

        const result = await response.json();
        if (result.ok) {
          const data = result.data;
          
          // Check if completed
          if (data.status === 'completed' || (data.report_generation_status === 0 && data.file_path)) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setTask(prev => ({
              ...prev,
              status: 'completed',
              progress: 100,
              message: 'Process completed successfully',
              result: data
            }));
          } 
          // Check if failed
          else if (data.status === 'failed' || data.report_generation_status === 1) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setTask(prev => ({
              ...prev,
              status: 'error',
              message: data.error || data.report_generation_condition || 'Process failed'
            }));
          } 
          // Still processing
          else {
            setTask(prev => ({
              ...prev,
              progress: data.progress || prev.progress,
              message: data.report_generation_condition || 'Processing...'
            }));
          }
        }
      } catch (error: any) {
        console.error('Status polling error:', error);
        // Don't necessarily stop polling on transient errors
      }
    }, 2000); // Poll every 2 seconds
  }, []);

  const startExtraction = useCallback(async (params: any) => {
    try {
      setTask(prev => ({ ...prev, status: 'extracting', progress: 0, message: 'Starting extraction...' }));
      
      const response = await fetch('/api/extract', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start extraction: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.ok && result.data) {
          // The backend returns default_response which contains report_generation_status=0 for "accepted"
          // We assume the taskId is what we sent or returned
          const taskId = params.taskId || params.task_id; // We might need to ensure taskId is passed or returned
          
          // If the backend returns the task ID in the response (it seems it just returns the input params mostly?)
          // Looking at the Python code, it returns default_response which doesn't explicitly have task_id, 
          // but we passed it in.
          
          pollStatus(taskId, 'extract');
      } else {
        throw new Error(result.message || 'Failed to start extraction');
      }
      
    } catch (error: any) {
      setTask(prev => ({ 
        ...prev, 
        status: 'error', 
        message: error.message || 'Extraction failed' 
      }));
    }
  }, [pollStatus]);

  const startGeneration = useCallback(async (params: any) => {
    try {
      setTask(prev => ({ ...prev, status: 'generating', progress: 0, message: 'Starting generation...' }));
      
      const response = await fetch('/api/generate', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`Failed to start generation: ${response.statusText}`);
      }
      
      const result = await response.json();
       if (result.ok && result.data) {
          const taskId = params.taskId || params.task_id;
          pollStatus(taskId, 'generate');
      } else {
        throw new Error(result.message || 'Failed to start generation');
      }
      
    } catch (error: any) {
      setTask(prev => ({ 
        ...prev, 
        status: 'error', 
        message: error.message || 'Generation failed' 
      }));
    }
  }, [pollStatus]);

  const resetTask = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setTask({
      taskId: '',
      status: 'idle',
      progress: 0,
    });
  }, []);

  return {
    task,
    startExtraction,
    startGeneration,
    resetTask,
  };
}
