import { pool } from "../config/db.js";

function getIpAddress(request) {
  if (process.env.TRACK_IP_ENABLED !== "true") {
    return null;
  }
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return request.ip ?? null;
}

function validatePayload(body) {
  if (!body?.visitorId || !body?.sessionId) {
    const error = new Error("visitorId and sessionId are required");
    error.statusCode = 400;
    throw error;
  }
}

async function upsertVisitorProfile({ visitorId, isReturning, userAgent, ipAddress }) {
  await pool.query(
    `INSERT INTO visitor_profiles(visitor_id, first_seen_at, last_seen_at, visit_count, is_returning, user_agent, ip_address)
     VALUES($1, NOW(), NOW(), 1, $2, $3, $4)
     ON CONFLICT (visitor_id)
     DO UPDATE SET
       last_seen_at = NOW(),
       visit_count = visitor_profiles.visit_count + 1,
       is_returning = EXCLUDED.is_returning,
       user_agent = EXCLUDED.user_agent,
       ip_address = COALESCE(EXCLUDED.ip_address, visitor_profiles.ip_address)`,
    [visitorId, Boolean(isReturning), userAgent ?? null, ipAddress]
  );
}

export async function trackConsent(request, response, next) {
  try {
    validatePayload(request.body);
    const { visitorId, sessionId, isReturning, deviceInfo } = request.body;
    const ipAddress = getIpAddress(request);
    const userAgent = request.headers["user-agent"] ?? null;

    await upsertVisitorProfile({ visitorId, isReturning, userAgent, ipAddress });

    await pool.query(
      `INSERT INTO visitor_events(visitor_id, session_id, event_type, page_key, page_path, device_info, user_agent, ip_address, is_returning)
       VALUES($1, $2, 'consent_accepted', NULL, NULL, $3::jsonb, $4, $5, $6)`,
      [visitorId, sessionId, JSON.stringify(deviceInfo ?? {}), userAgent, ipAddress, Boolean(isReturning)]
    );

    response.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
}

export async function trackPageView(request, response, next) {
  try {
    validatePayload(request.body);
    const { visitorId, sessionId, pageKey, pagePath, isReturning, deviceInfo } = request.body;
    if (!pageKey) {
      const error = new Error("pageKey is required");
      error.statusCode = 400;
      throw error;
    }
    const ipAddress = getIpAddress(request);
    const userAgent = request.headers["user-agent"] ?? null;

    await upsertVisitorProfile({ visitorId, isReturning, userAgent, ipAddress });

    await pool.query(
      `INSERT INTO visitor_events(visitor_id, session_id, event_type, page_key, page_path, device_info, user_agent, ip_address, is_returning)
       VALUES($1, $2, 'page_view', $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        visitorId,
        sessionId,
        String(pageKey).slice(0, 60),
        String(pagePath ?? "").slice(0, 255),
        JSON.stringify(deviceInfo ?? {}),
        userAgent,
        ipAddress,
        Boolean(isReturning),
      ]
    );

    response.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
}
