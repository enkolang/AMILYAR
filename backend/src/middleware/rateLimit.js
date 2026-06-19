const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const requestBuckets = new Map();

function resolveIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return request.ip ?? "unknown";
}

export function rateLimit(request, response, next) {
  const ip = resolveIp(request);
  const now = Date.now();
  const current = requestBuckets.get(ip);

  if (!current || now - current.windowStart > WINDOW_MS) {
    requestBuckets.set(ip, { windowStart: now, count: 1 });
    return next();
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return response.status(429).json({ error: { message: "Too many requests" } });
  }

  current.count += 1;
  return next();
}
