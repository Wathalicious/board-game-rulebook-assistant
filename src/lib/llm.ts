// model config for openrouter: embeddings and chat model
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// fail at startup with a clear message instead of a 401 at the first request
function requireEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is not set. Add it to .env.local (see README, Setup).`);
    return value;
}

const OPENROUTER_API_KEY = requireEnv("OPENROUTER_API_KEY");

export const embeddings = new OpenAIEmbeddings({
    model: "openai/text-embedding-3-small",
    apiKey: OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
});

// chat model for the agent (no temperature: gpt-5 models don't support it)
export const chatModel = new ChatOpenAI({
    model: "openai/gpt-5-mini",
    apiKey: OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
});