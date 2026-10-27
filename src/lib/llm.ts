// model config for openrouter: embeddings and chat model
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const embeddings = new OpenAIEmbeddings({
    model: "openai/text-embedding-3-small",
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
});

// chat model for the agent (no temperature: gpt-5 models don't support it)
export const chatModel = new ChatOpenAI({
    model: "openai/gpt-5-mini",
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
});