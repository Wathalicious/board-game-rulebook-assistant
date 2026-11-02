import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter } from "./rate-limit";

const LIMIT = 3;
const WINDOW = 1000;

describe("createRateLimiter", () => {
    it("allows up to the limit and counts down the remaining requests", () => {
        const limiter = createRateLimiter(LIMIT, WINDOW);
        expect(limiter.check("a", 0)).toEqual({ allowed: true, remaining: 2 });
        expect(limiter.check("a", 1)).toEqual({ allowed: true, remaining: 1 });
        expect(limiter.check("a", 2)).toEqual({ allowed: true, remaining: 0 });
    });

    it("refuses the request after the limit and says when the oldest one leaves the window", () => {
        const limiter = createRateLimiter(LIMIT, WINDOW);
        for (let t = 0; t < LIMIT; t++) limiter.check("a", t * 100);
        expect(limiter.check("a", 300)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    });

    it("slides: a request is allowed again as soon as the oldest one has left the window", () => {
        const limiter = createRateLimiter(LIMIT, WINDOW);
        for (let t = 0; t < LIMIT; t++) limiter.check("a", t * 100);
        expect(limiter.check("a", 999).allowed).toBe(false);
        expect(limiter.check("a", 1000).allowed).toBe(true);
        expect(limiter.check("a", 1001).allowed).toBe(false);
    });

    it("counts clients separately", () => {
        const limiter = createRateLimiter(LIMIT, WINDOW);
        for (let t = 0; t < LIMIT; t++) limiter.check("a", t);
        expect(limiter.check("a", 10).allowed).toBe(false);
        expect(limiter.check("b", 10).allowed).toBe(true);
    });

    it("refused requests don't count", () => {
        const limiter = createRateLimiter(LIMIT, WINDOW);
        for (let t = 0; t < LIMIT; t++) limiter.check("a", t);
        for (let t = 10; t < 20; t++) limiter.check("a", t);
        expect(limiter.check("a", 1001).allowed).toBe(true);
    });
});

describe("clientKey", () => {
    const request = (headers: Record<string, string>) => new Request("http://localhost/api/chat", { headers });

    it("takes the first address from X-Forwarded-For", () => {
        expect(clientKey(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    });

    it("falls back to X-Real-IP, then to one shared bucket", () => {
        expect(clientKey(request({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
        expect(clientKey(request({}))).toBe("local");
    });
});
