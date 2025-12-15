import "server-only";

function getExternalOrigin(req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");

  if (host) {
    const proto = (forwardedProto ?? "http").split(",")[0]!.trim();
    const resolvedHost = host.split(",")[0]!.trim();
    return `${proto}://${resolvedHost}`;
  }

  return new URL(req.url).origin;
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function resolveLinkedinRedirectUri(req: Request) {
  const origin = getExternalOrigin(req);
  const configured = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const defaultPath = "/api/auth/linkedin/callback";

  if (!configured || configured === "auto") return new URL(defaultPath, origin).toString();
  if (configured.startsWith("/")) return new URL(configured, origin).toString();

  let configuredUrl: URL;
  try {
    configuredUrl = new URL(configured);
  } catch {
    throw new Error("Invalid LINKEDIN_REDIRECT_URI: must be an absolute URL, a '/path', or 'auto'");
  }

  const originUrl = new URL(origin);
  if (
    isLocalHostname(configuredUrl.hostname) &&
    !isLocalHostname(originUrl.hostname) &&
    configuredUrl.pathname === defaultPath
  ) {
    return new URL(defaultPath, origin).toString();
  }

  return configuredUrl.toString();
}

