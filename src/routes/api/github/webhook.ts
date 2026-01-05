import { createFileRoute } from "@tanstack/react-router"
import { Pool } from "pg"
import { createHmac, timingSafeEqual } from "crypto"
import { drizzle } from "drizzle-orm/node-postgres"
import * as dbSchema from "../../../../schema"
import {
  handlePullRequestWebhook,
  handlePullRequestReviewWebhook,
  handleCommentWebhook,
  handlePushWebhook,
  handleIssueWebhook,
  handleIssueCommentWebhook,
} from "@/lib/webhooks"
import type { WebhookEventName } from "@/lib/webhooks"

const pool = new Pool({
  connectionString: process.env.ZERO_UPSTREAM_DB,
})

const jsonResponse = <T>(data: T, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const verifyWebhookSignature = (payload: string, signature: string, secret: string): boolean => {
  if (!signature) return false

  const sig = signature.replace("sha256=", "")
  const hmac = createHmac("sha256", secret)
  const digest = hmac.update(payload).digest("hex")

  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(digest))
  } catch {
    return false
  }
}

// Helper to safely extract action from payload
const getAction = (payload: Record<string, unknown>): string =>
  (payload.action as string) || "unknown"

// Helper to safely extract ref info from payload
const getRefType = (payload: Record<string, unknown>): string =>
  (payload.ref_type as string) || "unknown"

const getRef = (payload: Record<string, unknown>): string => (payload.ref as string) || "unknown"

// Helper to safely extract state from payload
const getState = (payload: Record<string, unknown>): string =>
  (payload.state as string) || "unknown"

// Helper to safely extract nested deployment_status
const getDeploymentStatus = (payload: Record<string, unknown>): string => {
  const ds = payload.deployment_status as Record<string, unknown> | undefined
  return (ds?.state as string) || "unknown"
}

export const Route = createFileRoute("/api/github/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET

        if (!webhookSecret) {
          console.error("GITHUB_WEBHOOK_SECRET not configured")
          return jsonResponse({ error: "Webhook not configured" }, 500)
        }

        // Get raw body for signature verification
        const rawBody = await request.text()
        const signature = request.headers.get("x-hub-signature-256") || ""

        // Verify signature
        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          console.error("Invalid webhook signature")
          return jsonResponse({ error: "Invalid signature" }, 401)
        }

        const event = request.headers.get("x-github-event") as WebhookEventName | null
        const delivery = request.headers.get("x-github-delivery")

        console.log(`Received GitHub webhook: ${event} (${delivery})`)

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>
        } catch {
          return jsonResponse({ error: "Invalid JSON payload" }, 400)
        }

        const db = drizzle(pool, { schema: dbSchema })

        try {
          switch (event) {
            // =================================================================
            // REPOSITORY EVENTS
            // =================================================================

            case "push": {
              // Implemented: Updates repo's githubPushedAt timestamp
              await handlePushWebhook(db, payload)
              break
            }

            case "create": {
              // Stub: Triggered when a branch or tag is created
              // Future: Could track new branches for PRs
              console.log(
                `Stub: create event - ${getRefType(payload)} "${getRef(payload)}" created`,
              )
              break
            }

            case "delete": {
              // Stub: Triggered when a branch or tag is deleted
              // Future: Could clean up PR branch references
              console.log(
                `Stub: delete event - ${getRefType(payload)} "${getRef(payload)}" deleted`,
              )
              break
            }

            case "fork": {
              // Stub: Triggered when a repository is forked
              // Future: Could track forks for contribution workflows
              console.log(`Stub: fork event - repo forked`)
              break
            }

            case "public": {
              // Stub: Triggered when a private repository is made public
              console.log(`Stub: public event - repo made public`)
              break
            }

            case "repository": {
              // Stub: Triggered on repository actions (created, deleted, archived, etc.)
              console.log(`Stub: repository event - action: ${getAction(payload)}`)
              break
            }

            case "repository_import": {
              // Stub: Triggered when a repository import completes
              console.log(`Stub: repository_import event`)
              break
            }

            case "repository_dispatch": {
              // Stub: Triggered by the repository dispatch API
              console.log(`Stub: repository_dispatch event`)
              break
            }

            // =================================================================
            // PULL REQUEST EVENTS
            // =================================================================

            case "pull_request": {
              // Implemented: Full PR syncing
              await handlePullRequestWebhook(db, payload)
              break
            }

            case "pull_request_review": {
              // Implemented: PR review syncing
              await handlePullRequestReviewWebhook(db, payload)
              break
            }

            case "pull_request_review_comment": {
              // Implemented: Inline review comments on diffs
              await handleCommentWebhook(db, payload, event)
              break
            }

            case "pull_request_review_thread": {
              // Stub: Triggered when a review thread is resolved/unresolved
              // Future: Could track thread resolution state
              console.log(`Stub: pull_request_review_thread event - action: ${getAction(payload)}`)
              break
            }

            // =================================================================
            // ISSUE EVENTS
            // =================================================================

            case "issues": {
              // Implemented: Full issue syncing
              await handleIssueWebhook(db, payload)
              break
            }

            case "issue_comment": {
              // Implemented: Comments on issues and PRs
              // Note: issue_comment is sent for both issues AND PRs
              // handleCommentWebhook handles PR comments
              // handleIssueCommentWebhook handles actual issue comments
              const issue = payload.issue as Record<string, unknown> | undefined
              if (issue?.pull_request) {
                await handleCommentWebhook(db, payload, event)
              } else {
                await handleIssueCommentWebhook(db, payload)
              }
              break
            }

            // =================================================================
            // CI/CD EVENTS
            // =================================================================

            case "check_run": {
              // Stub: Triggered on check run actions
              // Future: Could show CI status on PRs
              console.log(`Stub: check_run event - action: ${getAction(payload)}`)
              break
            }

            case "check_suite": {
              // Stub: Triggered when a check suite is completed
              // Future: Could show overall CI status
              console.log(`Stub: check_suite event - action: ${getAction(payload)}`)
              break
            }

            case "status": {
              // Stub: Triggered when the status of a Git commit changes
              // Future: Could show commit status checks
              console.log(`Stub: status event - state: ${getState(payload)}`)
              break
            }

            case "deployment": {
              // Stub: Triggered when a deployment is created
              console.log(`Stub: deployment event - action: ${getAction(payload)}`)
              break
            }

            case "deployment_status": {
              // Stub: Triggered when a deployment status is created
              console.log(`Stub: deployment_status event - state: ${getDeploymentStatus(payload)}`)
              break
            }

            case "deployment_protection_rule": {
              // Stub: Triggered when a deployment protection rule is requested
              console.log(`Stub: deployment_protection_rule event`)
              break
            }

            case "deployment_review": {
              // Stub: Triggered when a deployment review is submitted
              console.log(`Stub: deployment_review event - action: ${getAction(payload)}`)
              break
            }

            case "workflow_dispatch": {
              // Stub: Triggered when a workflow is manually dispatched
              console.log(`Stub: workflow_dispatch event`)
              break
            }

            case "workflow_job": {
              // Stub: Triggered on workflow job actions
              // Future: Could show job-level CI details
              console.log(`Stub: workflow_job event - action: ${getAction(payload)}`)
              break
            }

            case "workflow_run": {
              // Stub: Triggered when a workflow run is requested or completed
              // Future: Could track workflow runs for PRs
              console.log(`Stub: workflow_run event - action: ${getAction(payload)}`)
              break
            }

            // =================================================================
            // SECURITY EVENTS
            // =================================================================

            case "code_scanning_alert": {
              // Stub: Triggered on code scanning alert actions
              // Future: Could show security alerts on repos/PRs
              console.log(`Stub: code_scanning_alert event - action: ${getAction(payload)}`)
              break
            }

            case "dependabot_alert": {
              // Stub: Triggered on Dependabot alert actions
              // Future: Could show dependency vulnerabilities
              console.log(`Stub: dependabot_alert event - action: ${getAction(payload)}`)
              break
            }

            case "secret_scanning_alert": {
              // Stub: Triggered on secret scanning alert actions
              console.log(`Stub: secret_scanning_alert event - action: ${getAction(payload)}`)
              break
            }

            case "secret_scanning_alert_location": {
              // Stub: Triggered when a secret scanning alert location is created
              console.log(`Stub: secret_scanning_alert_location event`)
              break
            }

            case "security_advisory": {
              // Stub: Triggered on security advisory actions
              console.log(`Stub: security_advisory event - action: ${getAction(payload)}`)
              break
            }

            case "repository_vulnerability_alert": {
              // Stub: Triggered when a repository vulnerability alert is created
              console.log(
                `Stub: repository_vulnerability_alert event - action: ${getAction(payload)}`,
              )
              break
            }

            case "security_and_analysis": {
              // Stub: Triggered when security and analysis features are enabled/disabled
              console.log(`Stub: security_and_analysis event`)
              break
            }

            // =================================================================
            // ORGANIZATION EVENTS
            // =================================================================

            case "member": {
              // Stub: Triggered when a user is added/removed as a collaborator
              console.log(`Stub: member event - action: ${getAction(payload)}`)
              break
            }

            case "membership": {
              // Stub: Triggered when a user is added/removed from a team
              console.log(`Stub: membership event - action: ${getAction(payload)}`)
              break
            }

            case "organization": {
              // Stub: Triggered on organization actions
              console.log(`Stub: organization event - action: ${getAction(payload)}`)
              break
            }

            case "org_block": {
              // Stub: Triggered when a user is blocked/unblocked from an org
              console.log(`Stub: org_block event - action: ${getAction(payload)}`)
              break
            }

            case "team": {
              // Stub: Triggered on team actions
              console.log(`Stub: team event - action: ${getAction(payload)}`)
              break
            }

            case "team_add": {
              // Stub: Triggered when a repository is added to a team
              console.log(`Stub: team_add event`)
              break
            }

            // =================================================================
            // GITHUB APP EVENTS
            // =================================================================

            case "installation": {
              // Stub: Triggered when a GitHub App is installed/uninstalled
              // Future: Could handle app installation for users
              console.log(`Stub: installation event - action: ${getAction(payload)}`)
              break
            }

            case "installation_repositories": {
              // Stub: Triggered when repositories are added/removed from installation
              console.log(`Stub: installation_repositories event - action: ${getAction(payload)}`)
              break
            }

            case "installation_target": {
              // Stub: Triggered when the installation target is renamed
              console.log(`Stub: installation_target event - action: ${getAction(payload)}`)
              break
            }

            case "github_app_authorization": {
              // Stub: Triggered when a user's authorization is revoked
              console.log(`Stub: github_app_authorization event - action: ${getAction(payload)}`)
              break
            }

            // =================================================================
            // DISCUSSION EVENTS
            // =================================================================

            case "discussion": {
              // Stub: Triggered on discussion actions
              // Future: Could sync discussions
              console.log(`Stub: discussion event - action: ${getAction(payload)}`)
              break
            }

            case "discussion_comment": {
              // Stub: Triggered on discussion comment actions
              console.log(`Stub: discussion_comment event - action: ${getAction(payload)}`)
              break
            }

            // =================================================================
            // PROJECT EVENTS
            // =================================================================

            case "project": {
              // Stub: Triggered on classic project actions
              console.log(`Stub: project event - action: ${getAction(payload)}`)
              break
            }

            case "project_card": {
              // Stub: Triggered on project card actions
              console.log(`Stub: project_card event - action: ${getAction(payload)}`)
              break
            }

            case "project_column": {
              // Stub: Triggered on project column actions
              console.log(`Stub: project_column event - action: ${getAction(payload)}`)
              break
            }

            case "projects_v2_item": {
              // Stub: Triggered on Projects (V2) item actions
              console.log(`Stub: projects_v2_item event - action: ${getAction(payload)}`)
              break
            }

            // =================================================================
            // BRANCH/MERGE EVENTS
            // =================================================================

            case "branch_protection_rule": {
              // Stub: Triggered on branch protection rule actions
              console.log(`Stub: branch_protection_rule event - action: ${getAction(payload)}`)
              break
            }

            case "branch_protection_configuration": {
              // Stub: Triggered when branch protection is enabled/disabled
              console.log(
                `Stub: branch_protection_configuration event - action: ${getAction(payload)}`,
              )
              break
            }

            case "merge_group": {
              // Stub: Triggered on merge group (merge queue) actions
              console.log(`Stub: merge_group event - action: ${getAction(payload)}`)
              break
            }

            case "deploy_key": {
              // Stub: Triggered when a deploy key is created/deleted
              console.log(`Stub: deploy_key event - action: ${getAction(payload)}`)
              break
            }

            // =================================================================
            // OTHER EVENTS
            // =================================================================

            case "release": {
              // Stub: Triggered on release actions
              // Future: Could track releases for repos
              console.log(`Stub: release event - action: ${getAction(payload)}`)
              break
            }

            case "star": {
              // Stub: Triggered when a repository is starred/unstarred
              // Future: Could track star counts
              console.log(`Stub: star event - action: ${getAction(payload)}`)
              break
            }

            case "watch": {
              // Stub: Triggered when a user watches a repository
              console.log(`Stub: watch event - action: ${getAction(payload)}`)
              break
            }

            case "label": {
              // Stub: Triggered on label actions
              // Future: Could sync label changes
              console.log(`Stub: label event - action: ${getAction(payload)}`)
              break
            }

            case "milestone": {
              // Stub: Triggered on milestone actions
              // Future: Could track milestones for issues/PRs
              console.log(`Stub: milestone event - action: ${getAction(payload)}`)
              break
            }

            case "ping": {
              // Implemented: Webhook configuration test
              console.log("Received ping webhook - webhook is configured correctly")
              break
            }

            case "meta": {
              // Stub: Triggered when a webhook is deleted
              console.log(`Stub: meta event - action: ${getAction(payload)}`)
              break
            }

            case "page_build": {
              // Stub: Triggered when a GitHub Pages build is requested
              console.log(`Stub: page_build event`)
              break
            }

            case "commit_comment": {
              // Stub: Triggered when a commit comment is created
              // Future: Could track commit discussions
              console.log(`Stub: commit_comment event - action: ${getAction(payload)}`)
              break
            }

            case "gollum": {
              // Stub: Triggered when a wiki page is created/updated
              console.log(`Stub: gollum event`)
              break
            }

            case "package": {
              // Stub: Triggered on package actions
              console.log(`Stub: package event - action: ${getAction(payload)}`)
              break
            }

            case "registry_package": {
              // Stub: Triggered on registry package actions
              console.log(`Stub: registry_package event - action: ${getAction(payload)}`)
              break
            }

            case "sponsorship": {
              // Stub: Triggered on sponsorship actions
              console.log(`Stub: sponsorship event - action: ${getAction(payload)}`)
              break
            }

            case "marketplace_purchase": {
              // Stub: Triggered on marketplace purchase actions
              console.log(`Stub: marketplace_purchase event - action: ${getAction(payload)}`)
              break
            }

            case "custom_property": {
              // Stub: Triggered on custom property actions
              console.log(`Stub: custom_property event - action: ${getAction(payload)}`)
              break
            }

            case "custom_property_values": {
              // Stub: Triggered when custom property values are updated
              console.log(`Stub: custom_property_values event - action: ${getAction(payload)}`)
              break
            }

            default: {
              // Log unhandled events for debugging and future implementation
              console.log(`Unhandled webhook event: ${event}`)
            }
          }

          return jsonResponse({ received: true })
        } catch (error) {
          console.error("Error processing webhook:", error)
          return jsonResponse({ error: "Failed to process webhook" }, 500)
        }
      },
    },
  },
})
