"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageLoader,
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptSuggestion,
  PromptSuggestions,
} from "@nuvui/chat";
import { Markdown } from "@nuvui/chat/markdown";
import { Alert, AlertDescription, AlertTitle } from "@nuvui/react";
import { isStaticToolUIPart } from "ai";
import { useAgent } from "@/lib/agent/agent-provider";
import { ToolCallCard } from "./tool-call-card";
import "./assistant-panel.scss";

/**
 * The assistant-workspace block, as one conversation in the console's side
 * panel: the replies, the tools each one used, the changes waiting for
 * approval, and the box to write in.
 */
export function AssistantPanel({ demo, starters }: { demo: boolean; starters: readonly string[] }) {
  const agent = useAgent();
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const sent = agent.messages.filter((message) => message.role === "user").length;
  const waiting = agent.messages
    .at(-1)
    ?.parts.some((part) => isStaticToolUIPart(part) && part.state === "input-available");
  // In demo mode the script is offered a line at a time, once the turn
  // before it is over.
  const nextLine =
    demo && sent > 0 && agent.status === "ready" && !waiting ? starters[sent] : undefined;
  const send = (text: string) => {
    agent.clearError();
    void agent.sendMessage({ text });
  };

  return (
    <div className="assistant-panel">
      <Conversation className="assistant-panel__conversation">
        <ConversationContent aria-label="Conversation with the dispatch assistant">
          {agent.messages.length === 0 ? (
            <ConversationEmpty>
              <p className="assistant-panel__hello">
                {demo
                  ? "Demo mode: the answers are scripted, and every change still waits for you."
                  : "Ask about the round, or tell me what to change."}
              </p>
              <PromptSuggestions>
                {(demo ? starters.slice(0, 1) : starters).map((starter) => (
                  <PromptSuggestion key={starter} onClick={() => send(starter)}>
                    {starter}
                  </PromptSuggestion>
                ))}
              </PromptSuggestions>
            </ConversationEmpty>
          ) : null}

          {agent.messages.map((message) => (
            <Message key={message.id} from={message.role === "user" ? "user" : "assistant"}>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  if (!part.text) return null;
                  return (
                    // Parts have no ids of their own; their order never changes.
                    // biome-ignore lint/suspicious/noArrayIndexKey: see above
                    <MessageContent key={index}>
                      {message.role === "assistant" ? (
                        <Markdown headingOffset={2}>{part.text}</Markdown>
                      ) : (
                        part.text
                      )}
                    </MessageContent>
                  );
                }
                if (isStaticToolUIPart(part)) {
                  return <ToolCallCard key={part.toolCallId} part={part} />;
                }
                return null;
              })}
            </Message>
          ))}

          {agent.status === "submitted" ? (
            <Message from="assistant" streaming>
              <MessageLoader />
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />

        <div className="assistant-panel__foot">
          {agent.error ? (
            <Alert intent="warning">
              <AlertTitle>The assistant couldn't answer</AlertTitle>
              <AlertDescription>{agent.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {nextLine ? (
            <PromptSuggestions>
              <PromptSuggestion onClick={() => send(nextLine)}>{nextLine}</PromptSuggestion>
            </PromptSuggestions>
          ) : null}
          <PromptInput busy={busy} onStop={() => agent.stop()} onSubmit={send}>
            <PromptInputTextarea
              aria-label="Message to the dispatch assistant"
              placeholder="Move the Utrecht stops earlier…"
            />
            <PromptInputToolbar>
              <PromptInputSubmit />
            </PromptInputToolbar>
          </PromptInput>
          <p className="assistant-panel__note">
            Answers are written by a model and can be wrong. Every change waits for your approval.
          </p>
        </div>
      </Conversation>
    </div>
  );
}
