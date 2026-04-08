/**
 * Thread tracking for multi-turn cross-agent conversations.
 */

import type { AgentMessage, Thread } from "../types.js";

export class ThreadTracker {
  private threads: Map<string, Thread> = new Map();

  /** Register a message into its thread. Creates the thread if new. */
  track(message: AgentMessage): Thread {
    let thread = this.threads.get(message.threadId);

    if (!thread) {
      thread = {
        id: message.threadId,
        originAgent: message.from,
        messages: [],
        status: "open",
        createdAt: message.timestamp,
        updatedAt: message.timestamp,
      };
      this.threads.set(thread.id, thread);
    }

    thread.messages.push(message);
    thread.updatedAt = message.timestamp;

    // Auto-escalate if an escalation message arrives
    if (message.type === "escalation") {
      thread.status = "escalated";
    }

    return thread;
  }

  /** Resolve a thread. */
  resolve(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.status = "resolved";
      thread.updatedAt = new Date().toISOString();
    }
  }

  /** Get a thread by ID. */
  get(threadId: string): Thread | undefined {
    return this.threads.get(threadId);
  }

  /** Get all open threads. */
  getOpen(): Thread[] {
    return Array.from(this.threads.values()).filter((t) => t.status === "open");
  }

  /** Get all escalated threads. */
  getEscalated(): Thread[] {
    return Array.from(this.threads.values()).filter((t) => t.status === "escalated");
  }

  /** Get all threads. */
  getAll(): Thread[] {
    return Array.from(this.threads.values());
  }

  /** Number of threads. */
  get size(): number {
    return this.threads.size;
  }

  /** Clear all threads. */
  clear(): void {
    this.threads.clear();
  }
}
