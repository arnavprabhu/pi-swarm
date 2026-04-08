/**
 * Message routing rules.
 *
 * Defines standard routes for common scenarios. Each rule specifies
 * a logical path through the agent hierarchy.
 */

import type { RoutingRule } from "../types.js";

/** Built-in routing rules for common operational scenarios. */
export const ROUTING_RULES: RoutingRule[] = [
  {
    name: "new_feature",
    trigger: "New feature request",
    path: ["orchestrator", "product", "dev"],
    description: "Product scopes the feature, then dev implements it.",
  },
  {
    name: "launch_campaign",
    trigger: "Launch campaign",
    path: ["orchestrator", "product", "gtm", "marketing"],
    description: "Product defines positioning, GTM plans rollout, marketing creates assets.",
  },
  {
    name: "production_bug",
    trigger: "Bug in production",
    path: ["dev", "orchestrator", "dev", "ops"],
    description: "Dev escalates to orchestrator, who coordinates dev fix and ops mitigation.",
  },
  {
    name: "budget_approval",
    trigger: "Budget approval needed",
    path: ["*", "ops", "orchestrator"],
    description: "Any team routes budget requests through ops to orchestrator for approval.",
  },
  {
    name: "customer_escalation",
    trigger: "Customer escalation",
    path: ["gtm", "orchestrator", "product", "dev"],
    description: "GTM escalates, orchestrator coordinates product and dev for resolution.",
  },
  {
    name: "quarterly_planning",
    trigger: "Quarterly planning",
    path: ["orchestrator", "product", "dev", "marketing", "ops", "gtm"],
    description: "Orchestrator kicks off planning; every team contributes their OKRs.",
  },
  {
    name: "incident_response",
    trigger: "System incident",
    path: ["ops", "orchestrator", "dev", "gtm"],
    description: "Ops detects, orchestrator coordinates dev fix and GTM customer comms.",
  },
  {
    name: "content_review",
    trigger: "Content for review",
    path: ["marketing", "product", "orchestrator"],
    description: "Marketing drafts, product reviews for accuracy, orchestrator approves.",
  },
];

/**
 * Find routing rules whose trigger matches a keyword.
 * Returns all matching rules (case-insensitive partial match).
 */
export function findRoutes(keyword: string): RoutingRule[] {
  const lower = keyword.toLowerCase();
  return ROUTING_RULES.filter(
    (r) =>
      r.trigger.toLowerCase().includes(lower) ||
      r.name.toLowerCase().includes(lower) ||
      r.description.toLowerCase().includes(lower),
  );
}

/**
 * Given a trigger, determine the ordered list of team IDs the message should traverse.
 * Returns the path from the first matching rule, or an empty array if no match.
 */
export function resolvePath(trigger: string): string[] {
  const routes = findRoutes(trigger);
  return routes.length > 0 ? routes[0].path : [];
}
