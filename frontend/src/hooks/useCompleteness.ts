import { useState, useEffect } from 'react';
import { apiClient } from '@/services/api';
import type { CompletenessInfo } from '@/types/visualization';

export function useCompleteness(runId: number | null) {
  const [completeness, setCompleteness] = useState<CompletenessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setCompleteness(null);
      return;
    }

    const fetchCompleteness = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiClient.getRunCompleteness(runId);
        setCompleteness(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch completeness data');
        setCompleteness(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCompleteness();
  }, [runId]);

  return { completeness, loading, error };
}
