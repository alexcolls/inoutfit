type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, event: string, fields?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(fields ?? {})
  };

  // Avoid logging bodies/secrets; keep logs structured.
  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function withRequestLogging<TArgs extends unknown[]>(
  name: string,
  handler: (...args: TArgs) => Promise<Response>
) {
  return async (...args: TArgs) => {
    const start = Date.now();

    try {
      const res = await handler(...args);
      log('info', 'api.request', {
        name,
        status: res.status,
        duration_ms: Date.now() - start
      });
      return res;
    } catch (err) {
      if (err instanceof Response) {
        log('warn', 'api.response_thrown', {
          name,
          status: err.status,
          duration_ms: Date.now() - start
        });
        return err;
      }

      log('error', 'api.error', {
        name,
        duration_ms: Date.now() - start,
        message: err instanceof Error ? err.message : String(err)
      });

      return Response.json({ok: false, error: 'Internal Server Error'}, {status: 500});
    }
  };
}
