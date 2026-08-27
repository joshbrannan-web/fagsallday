import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Returns a back handler that pops in-app history when possible, so the user
 * lands on the page (and tab / scoreboard) they came from. Falls back to the
 * given path when the page was opened directly via a link.
 */
export function useSmartBack(fallbackPath: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as any)?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(fallbackPath, { replace: true });
  }, [navigate, fallbackPath]);
}

export default useSmartBack;
