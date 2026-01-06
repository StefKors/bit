import type { adminDb } from "@/lib/instantAdmin"
import type { AppSchema } from "@/instant.schema"
import type { InstaQLEntity } from "@instantdb/core"

// Re-export types from @octokit/webhooks-types for type-safe webhook handling
export type {
  // Repository events
  PushEvent,
  CreateEvent,
  DeleteEvent,
  ForkEvent,
  PublicEvent,
  RepositoryEvent,
  RepositoryImportEvent,
  RepositoryDispatchEvent,

  // Pull Request events
  PullRequestEvent,
  PullRequestReviewEvent,
  PullRequestReviewCommentEvent,
  PullRequestReviewThreadEvent,

  // Issue events
  IssuesEvent,
  IssueCommentEvent,

  // CI/CD events
  CheckRunEvent,
  CheckSuiteEvent,
  StatusEvent,
  DeploymentEvent,
  DeploymentStatusEvent,
  WorkflowJobEvent,
  WorkflowRunEvent,
  WorkflowDispatchEvent,

  // Security events
  CodeScanningAlertEvent,
  DependabotAlertEvent,
  SecretScanningAlertEvent,
  SecretScanningAlertLocationEvent,
  SecurityAdvisoryEvent,
  RepositoryVulnerabilityAlertEvent,
  // Note: security_and_analysis event exists but has no specific typed payload

  // Organization events
  MemberEvent,
  MembershipEvent,
  OrganizationEvent,
  OrgBlockEvent,
  TeamEvent,
  TeamAddEvent,

  // GitHub App events
  InstallationEvent,
  InstallationRepositoriesEvent,
  InstallationTargetEvent,
  GithubAppAuthorizationEvent,

  // Discussion events
  DiscussionEvent,
  DiscussionCommentEvent,

  // Project events
  ProjectEvent,
  ProjectCardEvent,
  ProjectColumnEvent,
  ProjectsV2ItemEvent,

  // Other events
  ReleaseEvent,
  StarEvent,
  WatchEvent,
  LabelEvent,
  MilestoneEvent,
  PingEvent,
  MetaEvent,
  PageBuildEvent,
  CommitCommentEvent,
  GollumEvent,
  PackageEvent,
  RegistryPackageEvent,
  SponsorshipEvent,
  MarketplacePurchaseEvent,

  // Branch/merge events
  BranchProtectionRuleEvent,
  BranchProtectionConfigurationEvent,
  MergeGroupEvent,
  DeployKeyEvent,
  DeploymentProtectionRuleEvent,
  DeploymentReviewEvent,

  // Custom property events
  CustomPropertyEvent,
  CustomPropertyValuesEvent,

  // Common types
  Repository,
  User,
  Organization,
  PullRequest,
  Issue,
} from "@octokit/webhooks-types"

export type WebhookDB = typeof adminDb

export type WebhookPayload = Record<string, unknown>

export type RepoRecord = InstaQLEntity<AppSchema, "repos">
export type PRRecord = InstaQLEntity<AppSchema, "pullRequests">
export type IssueRecord = InstaQLEntity<AppSchema, "issues">

/**
 * GitHub webhook event names as sent in the x-github-event header.
 * This is a comprehensive list of all supported webhook events.
 */
export type WebhookEventName =
  // Repository events
  | "push"
  | "create"
  | "delete"
  | "fork"
  | "public"
  | "repository"
  | "repository_import"
  | "repository_dispatch"
  // Pull Request events
  | "pull_request"
  | "pull_request_review"
  | "pull_request_review_comment"
  | "pull_request_review_thread"
  // Issue events
  | "issues"
  | "issue_comment"
  // CI/CD events
  | "check_run"
  | "check_suite"
  | "status"
  | "deployment"
  | "deployment_status"
  | "deployment_protection_rule"
  | "deployment_review"
  | "workflow_dispatch"
  | "workflow_job"
  | "workflow_run"
  // Security events
  | "code_scanning_alert"
  | "dependabot_alert"
  | "secret_scanning_alert"
  | "secret_scanning_alert_location"
  | "security_advisory"
  | "repository_vulnerability_alert"
  | "security_and_analysis"
  // Organization events
  | "member"
  | "membership"
  | "organization"
  | "org_block"
  | "team"
  | "team_add"
  // GitHub App events
  | "installation"
  | "installation_repositories"
  | "installation_target"
  | "github_app_authorization"
  // Discussion events
  | "discussion"
  | "discussion_comment"
  // Project events
  | "project"
  | "project_card"
  | "project_column"
  | "projects_v2_item"
  // Branch/merge events
  | "branch_protection_rule"
  | "branch_protection_configuration"
  | "merge_group"
  | "deploy_key"
  // Other events
  | "release"
  | "star"
  | "watch"
  | "label"
  | "milestone"
  | "ping"
  | "meta"
  | "page_build"
  | "commit_comment"
  | "gollum"
  | "package"
  | "registry_package"
  | "sponsorship"
  | "marketplace_purchase"
  | "custom_property"
  | "custom_property_values"
