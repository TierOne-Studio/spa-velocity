export type TimeRange = '7d' | '30d' | '90d';

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
}

export interface OverviewStatsDto {
  totalUsers: number;
  bannedUsers: number;
  activeSessions: number;
  totalOrganizations: number;
  totalConversations: number;
  totalMessages: number;
  assistantMessages: number;
  totalTokensAllTime: number | null;
}

export interface UserStatsDto {
  total: number;
  newInRange: number;
  bannedCount: number;
  emailVerifiedCount: number;
  timeSeriesNewUsers: Array<{ date: string; count: number }>;
  topUsers: Array<{
    userId: string;
    name: string;
    email: string;
    role: string;
    conversationCount: number;
    messageCount: number;
    organizationCount: number;
    lastActiveAt: string | null;
  }>;
  activeSessions: number;
  expiredSessions: number;
  impersonatedSessions: number;
  sessionsByBrowser: Array<{ browser: string; count: number }>;
}

export interface ChatStatsDto {
  totalConversations: number;
  totalMessages: number;
  assistantMessages: number;
  userMessages: number;
  avgMessagesPerConversation: number;
  activeConversationsInRange: number;
  timeSeriesConversations: Array<{ date: string; count: number }>;
  timeSeriesMessages: Array<{ date: string; userCount: number; assistantCount: number }>;
  generatorDistribution: Array<{ generator: string; count: number; percentage: number }>;
  sourceIntegrationUsage: Array<{ sourceName: string; count: number }>;
  entityTypeBreakdown: Array<{ entityType: string; count: number }>;
  avgToolCallsPerResponse: number | null;
  avgResultsPerResponse: number | null;
  totalTokens: number | null;
  totalPromptTokens: number | null;
  totalCompletionTokens: number | null;
  avgTokensPerResponse: number | null;
  messagesWithTokenData: number;
}

export interface OrgStatsDto {
  totalOrganizations: number;
  pendingInvitations: number;
  conversationsPerOrg: Array<{ orgId: string; orgName: string; conversationCount: number; messageCount: number }>;
  membersPerOrg: Array<{ orgId: string; orgName: string; memberCount: number }>;
  memberRoleDistribution: Array<{ role: string; count: number }>;
  mostActiveOrgs: Array<{ orgId: string; orgName: string; recentMessageCount: number }>;
}
