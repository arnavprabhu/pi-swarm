/**
 * Inter-agent message creation and validation.
 */

import type { AgentMessage, MessageType, Priority } from "../types.js";
import { randomUUID } from "node:crypto";

/** Options for creating a new message. */
export interface CreateMessageOptions {
  from: string;
  to: string;
  type: MessageType;
  priority?: Priority;
  summary: string;
  body: string;
  dependencies?: string[];
  deadline?: string;
  responseRequired?: boolean;
  threadId?: string;
}

/** Create a new inter-agent message with sensible defaults. */
export function createMessage(opts: CreateMessageOptions): AgentMessage {
  return {
    id: randomUUID(),
    from: opts.from,
    to: opts.to,
    type: opts.type,
    priority: opts.priority ?? "p2",
    payload: {
      summary: opts.summary,
      body: opts.body,
      dependencies: opts.dependencies ?? [],
      deadline: opts.deadline,
      response_required: opts.responseRequired ?? false,
    },
    threadId: opts.threadId ?? randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

/** Create a directive from orchestrator to a team lead. */
export function createDirective(
  from: string,
  to: string,
  summary: string,
  body: string,
  opts?: Partial<CreateMessageOptions>,
): AgentMessage {
  return createMessage({
    from,
    to,
    type: "directive",
    priority: "p1",
    summary,
    body,
    responseRequired: true,
    ...opts,
  });
}

/** Create a report from a subordinate back to its superior. */
export function createReport(
  from: string,
  to: string,
  summary: string,
  body: string,
  threadId: string,
): AgentMessage {
  return createMessage({
    from,
    to,
    type: "report",
    priority: "p2",
    summary,
    body,
    threadId,
    responseRequired: false,
  });
}

/** Create an escalation message. */
export function createEscalation(
  from: string,
  to: string,
  summary: string,
  body: string,
  threadId?: string,
): AgentMessage {
  return createMessage({
    from,
    to,
    type: "escalation",
    priority: "p0",
    summary,
    body,
    threadId,
    responseRequired: true,
  });
}

/** Create a cross-team request. */
export function createRequest(
  from: string,
  to: string,
  summary: string,
  body: string,
  dependencies?: string[],
  threadId?: string,
): AgentMessage {
  return createMessage({
    from,
    to,
    type: "request",
    priority: "p2",
    summary,
    body,
    dependencies,
    threadId,
    responseRequired: true,
  });
}
