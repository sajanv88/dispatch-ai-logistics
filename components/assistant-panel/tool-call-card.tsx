"use client";

import {
  ToolCall,
  ToolCallApproval,
  ToolCallContent,
  ToolCallError,
  ToolCallInput,
  ToolCallOutput,
  type ToolCallStatus,
  ToolCallTrigger,
} from "@nuvui/chat";
import { getStaticToolName, type ToolUIPart } from "ai";
import { useAgent } from "@/lib/agent/agent-provider";
import { approvalQuestion, toolTitles } from "@/lib/agent/describe";
import { type DispatchTools, deniedText, isClientTool, type ToolName } from "@/lib/agent/tools";
import { useDispatch } from "@/lib/store";

export type DispatchToolPart = ToolUIPart<DispatchTools>;

/**
 * One tool call in the thread, as the assistant-workspace block draws it.
 * A change waits for the dispatcher here: the card asks, and runs it only
 * when they approve.
 */
export function ToolCallCard({ part }: { part: DispatchToolPart }) {
  const agent = useAgent();
  const route = useDispatch((state) => state.route);
  // The part's type is tool-<name>, and every name is one of ours.
  const name = getStaticToolName(part) as ToolName;
  const waiting = isClientTool(name) && part.state === "input-available";
  // A change is only offered once the reply has finished arriving.
  const canAnswer = waiting && agent.status === "ready";

  const status: ToolCallStatus = (() => {
    switch (part.state) {
      case "input-streaming":
        return "running";
      case "input-available":
        return canAnswer ? "approval" : "running";
      case "approval-requested":
        return "approval";
      case "approval-responded":
        return "running";
      case "output-available":
        return "done";
      case "output-denied":
        return "denied";
      case "output-error":
        return part.errorText === deniedText ? "denied" : "error";
    }
  })();

  return (
    <ToolCall status={status}>
      <ToolCallTrigger>{toolTitles[name]}</ToolCallTrigger>
      <ToolCallContent>
        {part.input !== undefined ? <ToolCallInput value={part.input} /> : null}
        {part.state === "output-available" ? <ToolCallOutput value={part.output} /> : null}
        {part.state === "output-error" && part.errorText !== deniedText ? (
          <ToolCallError>{part.errorText}</ToolCallError>
        ) : null}
      </ToolCallContent>
      {canAnswer && isClientTool(name) ? (
        <ToolCallApproval
          onApprove={() => agent.approve(name, part.toolCallId, part.input)}
          onDeny={() => agent.deny(name, part.toolCallId)}
        >
          {approvalQuestion(name, part.input, route)}
        </ToolCallApproval>
      ) : null}
    </ToolCall>
  );
}
