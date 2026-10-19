"use client";

import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { createContext, type ReactNode, use, useState } from "react";
import { runClientTool } from "@/lib/agent/run-client-tool";
import { type ClientToolName, type DispatchUIMessage, deniedText } from "@/lib/agent/tools";
import { useDispatchStore } from "@/lib/store";

interface Agent extends UseChatHelpers<DispatchUIMessage> {
  /** Runs a change the model asked for, and sends the result back. */
  approve(name: ClientToolName, toolCallId: string, input: unknown): void;
  /** Tells the model the dispatcher said no. Nothing changes. */
  deny(name: ClientToolName, toolCallId: string): void;
  /** Starts the conversation again. */
  clear(): void;
}

const AgentContext = createContext<Agent | null>(null);

/**
 * The conversation, held above the shell so it survives the assistant moving
 * between the panel and the sheet. Each request carries the round as it is
 * now, so the server keeps nothing.
 */
export function AgentProvider({ children }: { children: ReactNode }) {
  const store = useDispatchStore();
  const [transport] = useState(
    () =>
      new DefaultChatTransport<DispatchUIMessage>({
        api: "/api/chat",
        body: () => ({ state: store.getState().route }),
      }),
  );
  const chat = useChat<DispatchUIMessage>({
    // One conversation per page. A fixed id also keeps useChat from making a
    // random one while the page is prerendered.
    id: "dispatch",
    transport,
    // When every change in a reply has been approved or denied, the results
    // go back to the model for its next step.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const agent: Agent = {
    ...chat,
    approve(name, toolCallId, input) {
      const run = runClientTool(store, name, input);
      if (run.ok) {
        void chat.addToolOutput({ tool: name, toolCallId, output: run.output });
      } else {
        void chat.addToolOutput({
          tool: name,
          toolCallId,
          state: "output-error",
          errorText: run.error,
        });
      }
    },
    deny(name, toolCallId) {
      void chat.addToolOutput({
        tool: name,
        toolCallId,
        state: "output-error",
        errorText: deniedText,
      });
    },
    clear() {
      chat.stop();
      chat.clearError();
      chat.setMessages([]);
    },
  };

  return <AgentContext value={agent}>{children}</AgentContext>;
}

export function useAgent(): Agent {
  const agent = use(AgentContext);
  if (!agent) throw new Error("useAgent needs an AgentProvider above it.");
  return agent;
}
