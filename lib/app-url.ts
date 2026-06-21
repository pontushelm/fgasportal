const DEFAULT_APP_URL = "https://app.helmpolar.se"

export function getAppUrl() {
  return (process.env.APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/$/, "")
}

export function buildAppUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getAppUrl()}${normalizedPath}`
}
