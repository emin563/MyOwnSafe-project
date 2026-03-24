export function beginShareTrace(location: string, hypothesisId: string): () => void {
  void location;
  void hypothesisId;
  return () => {
    // no-op in production flow
  };
}
