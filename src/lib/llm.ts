import { OpenAIEmbeddings } from "@langchain/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const embeddings = new OpenAIEmbeddings({
    model: "openai/text-embedding-3-small",
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: { baseURL: OPENROUTER_BASE_URL },
});