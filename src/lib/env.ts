// reads a required environment variable; fails at startup with a clear message instead of a 401 at the first request
export function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not set. Add it to .env.local (see README, Setup).`);
    return value;
}
