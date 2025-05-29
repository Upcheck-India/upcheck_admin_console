import { useState, useCallback } from 'react';

export default function useRetry(asyncFn, maxRetries = 3) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const execute = useCallback(async (...args) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await asyncFn(...args);
      setRetryCount(0);
      return result;
    } catch (error) {
      setError(error);
      
      // If we haven't exceeded max retries, throw to trigger retry
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        throw error;
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [asyncFn, maxRetries, retryCount]);

  const reset = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsLoading(false);
  }, []);

  const retry = useCallback(() => {
    reset();
    return execute();
  }, [execute, reset]);

  return {
    execute,
    retry,
    reset,
    isLoading,
    error,
    retryCount
  };
}