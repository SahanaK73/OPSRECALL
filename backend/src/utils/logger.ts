// Tiny logger. Never log secrets or full request bodies.
type Level = 'info' | 'warn' | 'error' | 'debug';
const log = (level: Level, msg: string, extra?: unknown) => {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra instanceof Error) out(line, extra.message);
  else if (extra !== undefined) out(line, extra);
  else out(line);
};
export const logger = {
  info: (m: string, e?: unknown) => log('info', m, e),
  warn: (m: string, e?: unknown) => log('warn', m, e),
  error: (m: string, e?: unknown) => log('error', m, e),
  debug: (m: string, e?: unknown) => { if (process.env.NODE_ENV !== 'production') log('debug', m, e); },
};
