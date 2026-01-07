export type ApiOk<T> = {ok: true; data: T};
export type ApiFail = {ok: false; error: string};

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json(
    {ok: true, data} satisfies ApiOk<T>,
    {
      status: init?.status ?? 200,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    }
  );
}

export function fail(status: number, error: string, init?: ResponseInit) {
  return Response.json(
    {ok: false, error} satisfies ApiFail,
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    }
  );
}
