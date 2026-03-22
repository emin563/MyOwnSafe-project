// #region agent log
/** Debug-only: counts overlapping ExpoSharing.shareAsync calls (session 37f297). */
let activeShareOps = 0;

export function beginShareTrace(location: string, hypothesisId: string): () => void {
  activeShareOps += 1;
  const concurrent = activeShareOps > 1;
  fetch('http://127.0.0.1:7480/ingest/66512b4c-ea2c-44b0-a600-fed3b773abbf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '37f297' },
    body: JSON.stringify({
      sessionId: '37f297',
      location,
      message: 'share_trace_pre',
      data: { activeShareOps, concurrent, hypothesisId },
      timestamp: Date.now(),
      hypothesisId,
    }),
  }).catch(() => {});
  return () => {
    activeShareOps -= 1;
    fetch('http://127.0.0.1:7480/ingest/66512b4c-ea2c-44b0-a600-fed3b773abbf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '37f297' },
      body: JSON.stringify({
        sessionId: '37f297',
        location,
        message: 'share_trace_post',
        data: { activeShareOps, hypothesisId },
        timestamp: Date.now(),
        hypothesisId,
      }),
    }).catch(() => {});
  };
}
// #endregion
