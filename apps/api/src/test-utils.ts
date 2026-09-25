/** Node's fetch types (unlike the DOM lib's) type `Response.json()` as `Promise<unknown>` — this
 * narrows it for test assertions, which is the one place in this codebase where reading an
 * unvalidated shape is fine (the assertions right below each call are the validation). */
export async function json<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
