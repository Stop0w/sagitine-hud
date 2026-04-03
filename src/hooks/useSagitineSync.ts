import { useState, useEffect, useRef, useCallback } from 'react';

interface HubData {
  total_queue: number;
  urgent_count: number;
  sent_today: number;
  pending_review: number;
  approved: number;
  rejected: number;
  queue: Array<{
    id: string;
    from_email: string;
    from_name: string;
    subject: string;
    body_plain: string;
    received_at: string;
    category: string;
    urgency: number;
    risk_level: string;
    status: string;
  }>;
}

interface UseSagitineSyncOptions {
  pollingIntervalMs?: number;
  enabled?: boolean;
}

interface UseSagitineSyncResult {
  data: HubData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateLocalState: (updates: Partial<HubData>) => void;
}

/**
 * Auto-polling hook for Sagitine HUD metrics.
 *
 * Fetches initial data on mount, then polls silently in the background.
 * Silent polls prevent loading flash on background updates.
 *
 * @param endpoint - API endpoint to fetch (default: /api/metrics)
 * @param options - Polling configuration
 * @returns { data, loading, error, refetch, updateLocalState }
 *
 * @example
 * const { data, loading, error, refetch, updateLocalState } = useSagitineSync(
 *   '/api/metrics',
 *   { pollingIntervalMs: 10000 }
 * );
 */
export function useSagitineSync(
  endpoint: string = '/api/metrics',
  options: UseSagitineSyncOptions = {}
): UseSagitineSyncResult {
  const { pollingIntervalMs = 10000, enabled = true } = options;

  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialFetch, setIsInitialFetch] = useState<boolean>(true);

  // Track polling with ref to avoid stale closures
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch data from API endpoint.
   * Uses AbortController to cancel pending requests on unmount.
   */
  const fetchData = useCallback(async (silent: boolean = false) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Only show loading state on initial fetch
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(endpoint, {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Validate response structure
      if (!result.success || !result.data) {
        throw new Error('Invalid API response structure');
      }

      // Only update state if valid data is returned
      if (result.data && (Array.isArray(result.data) ? result.data.length > 0 : Object.keys(result.data).length > 0)) {
        setData(result.data);
      }
      // If data is empty or null: do nothing, keep current display
      setError(null);

    } catch (err: any) {
      // Ignore abort errors (silent cancellation)
      if (err.name === 'AbortError') {
        return;
      }

      // Do NOT call setData here — keep existing UI intact
      const errorMessage = err.message || 'Unknown error';
      setError(errorMessage);
      console.error('useSagitineSync fetch error:', errorMessage);

    } finally {
      setLoading(false);
      setIsInitialFetch(false);
    }
  }, [endpoint]);

  /**
   * Optimistic UI update.
   * Updates local state immediately before server confirms.
   *
   * @example
   * updateLocalState({ total_queue: 5 }); // Decrement immediately
   */
  const updateLocalState = useCallback((updates: Partial<HubData>) => {
    setData(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  /**
   * Manual refetch (e.g., after user action).
   * Shows loading state during fetch.
   */
  const refetch = useCallback(async () => {
    await fetchData(false); // Explicit fetch with loading state
  }, [fetchData]);

  /**
   * Setup polling interval.
   * Fetches immediately on mount, then polls silently.
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial fetch (with loading state)
    fetchData(false);

    // Polling interval (silent, no loading flash)
    pollingRef.current = setInterval(async () => {
      try {
        await fetchData(true); // Silent fetch
      } catch (err) {
        // Silently swallow — already logged inside fetchData
      }
    }, pollingIntervalMs);

    // Cleanup: cancel pending requests and clear interval
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [enabled, pollingIntervalMs, fetchData]);

  return {
    data,
    loading: isInitialFetch && loading, // Only show loading on initial fetch
    error,
    refetch,
    updateLocalState,
  };
}
