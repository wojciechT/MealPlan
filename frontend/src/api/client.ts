/**
 * The backend answers failures with RFC 9457 problem details, and validation
 * failures carry an `errors` array of messages the domain itself wrote. Those
 * are the right words to show the user, so they survive as far as the form.
 */
export class ApiError extends Error {
  readonly status: number
  readonly errors: string[]

  constructor(status: number, message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }

  /** Every message worth showing, validation details included. */
  get messages(): string[] {
    return this.errors.length > 0 ? this.errors : [this.message]
  }
}

interface ProblemDetails {
  title?: string
  detail?: string
  errors?: unknown
}

const problemMessages = (problem: ProblemDetails): string[] =>
  Array.isArray(problem.errors) ? problem.errors.filter((e): e is string => typeof e === 'string') : []

async function toError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails = {}

  try {
    problem = (await response.json()) as ProblemDetails
  } catch {
    // A non-JSON body (a proxy error page, say) leaves the status to speak.
  }

  const message = problem.detail ?? problem.title ?? `Request failed with status ${response.status}.`

  return new ApiError(response.status, message, problemMessages(problem))
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    throw await toError(response)
  }

  // 204 on every delete and on writing a meal slot.
  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const api = {
  get: <T>(path: string) => send<T>('GET', path),
  post: <T>(path: string, body: unknown) => send<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => send<T>('PUT', path, body),
  delete: <T = void>(path: string) => send<T>('DELETE', path),
}

export const query = (params: Record<string, string | undefined>): string => {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, value)
    }
  }

  const text = search.toString()
  return text === '' ? '' : `?${text}`
}
