export const EVENT_COLORS: Record<string, string> = {
  task_start: '#8fcfba',
  working: '#98d894',
  done: '#d9d98c',
  error: '#d87782',
  idle: '#8d9f90',
  disconnected: '#6b7f70',
};

export function truncateText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export function formatAgo(ts: number): string {
  const seconds = Math.round((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
