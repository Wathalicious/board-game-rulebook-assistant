// turns the agent's stream into the events the UI shows while the answer is being written
import { AIMessageChunk, ToolMessage, type BaseMessage } from "langchain";
import { extractResponse } from "./chat-response";
import type { StreamEvent } from "./chat-types";

const MODEL_NODE = "model_request";

type MessagesPayload = [BaseMessage, { langgraph_node?: string }];
type UpdatesPayload = Record<string, { messages?: BaseMessage[] } | undefined>;
export type AgentStream = AsyncIterable<["messages", MessagesPayload] | ["updates", UpdatesPayload]>;

export async function relayAgentStream(stream: AgentStream, send: (event: StreamEvent) => void): Promise<BaseMessage[]> {
    const messages: BaseMessage[] = [];
    let stepText = "";

    for await (const [mode, payload] of stream) {
        if (mode === "messages") {
            const [message, metadata] = payload;
            if (metadata.langgraph_node === MODEL_NODE && AIMessageChunk.isInstance(message) && message.text) {
                stepText += message.text;
                send({ type: "text", text: message.text });
            }
            continue;
        }
        let toolsFinished = false;
        for (const update of Object.values(payload)) {
            for (const message of update?.messages ?? []) {
                messages.push(message);
                if (ToolMessage.isInstance(message)) toolsFinished = true;
            }
        }
        if (toolsFinished) {
            if (stepText) send({ type: "clear" });
            stepText = "";
            const { sources, toolResults } = extractResponse(messages);
            send({ type: "tools", sources, toolResults });
        }
    }
    return messages;
}

export async function primed<T>(iterable: AsyncIterable<T>): Promise<AsyncIterable<T>> {
    const iterator = iterable[Symbol.asyncIterator]();
    const first = await iterator.next();
    return {
        async *[Symbol.asyncIterator]() {
            if (first.done) return;
            yield first.value;
            for (let next = await iterator.next(); !next.done; next = await iterator.next()) yield next.value;
        },
    };
}
