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

// chat model for the agent. CHAT_MODEL overrides the default, e.g. for comparing models with the test scripts.
// gpt-4.1-mini (non-reasoning) replaced gpt-5-mini on 2026-11-01: about 3x faster, same answers on the test set.
export const CHAT_MODEL = process.env.CHAT_MODEL?.trim() || "openai/gpt-4.1-mini";

// temperature 0 for more consistent tool choice; gpt-5 models reject the parameter, so they get none
const temperature = CHAT_MODEL.includes("gpt-5") ? {} : { temperature: 0 };

export const chatModel = new ChatOpenAI({
    model: CHAT_MODEL,
    apiKey: OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
    ...temperature,
});