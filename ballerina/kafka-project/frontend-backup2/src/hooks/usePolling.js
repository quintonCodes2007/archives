import { useCallback, useEffect, useRef, useState } from "react";

// Schedule the next poll only after the previous request settles. Cleanup
// cancels the timer and ignores late results, including React StrictMode runs.
export function usePolling(load, delay = 4000) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
    updatedAt: null,
  });
  const [revision, setRevision] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    let active = true;
    let timer;
    setState({ data: null, loading: true, error: null, updatedAt: null });
    async function poll() {
      try {
        const data = await loader.current();
        if (active)
          setState({
            data,
            loading: false,
            error: null,
            updatedAt: new Date(),
          });
      } catch (error) {
        if (active)
          setState((previous) => ({
            ...previous,
            loading: false,
            error: error.message,
          }));
      }
      if (active && delay) timer = setTimeout(poll, delay);
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [load, delay, revision]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, refresh };
}
