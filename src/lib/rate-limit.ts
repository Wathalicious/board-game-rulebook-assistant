// rate limit for the chat route
export const RATE_LIMIT = 20;
export const RATE_WINDOW_MS = 60_000;

export type RateLimitResult = { allowed: true; remaining: number } | { allowed: false; retryAfterSeconds: number };

export function createRateLimiter(limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS) {
    const log = new Map<string, number[]>();

    function sweep(since: number) {
        for (const [client, times] of log) {
            if (!times.some((t) => t > since)) log.delete(client);
        }
    }

    return {
        check(client: string, now = Date.now()): RateLimitResult {
            const since = now - windowMs;
            const recent = (log.get(client) ?? []).filter((t) => t > since);
            if (recent.length >= limit) {
                log.set(client, recent);
                return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
            }
            recent.push(now);
            log.set(client, recent);
            if (log.size > 1000) sweep(since);
            return { allowed: true, remaining: limit - recent.length };
        },
    };
}

export function clientKey(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
    return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}
