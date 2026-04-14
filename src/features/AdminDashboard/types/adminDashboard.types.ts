export type TimeRange = '7d' | '30d' | '90d';

export interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  activeSessions: number;
  totalOrganizations: number;
  totalConversations: number;
  totalMessages: number;
  totalProjects: number;
}

export interface UserStats {
  total: number;
  newInRange: number;
  bannedCount: number;
  emailVerifiedCount: number;
  byRole: { role: string; count: number }[];
  timeSeriesNewUsers: { date: string; count: number }[];
}

export interface SessionStats {
  total: number;
  activeSessions: number;
  impersonatedCount: number;
  timeSeriesCreated: { date: string; count: number }[];
  byUserAgent: { browser: string; count: number }[];
}

export interface ChatStats {
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
  activeConversationsInRange: number;
  byRole: { role: string; count: number }[];
  timeSeriesConversations: { date: string; count: number }[];
}

export interface ProjectStats {
  totalProjects: number;
  byStatus: { status: string; count: number }[];
  byPhase: { phase: string; count: number }[];
  totalDataSources: number;
  dataSourcesByType: { type: string; count: number }[];
  dataSourcesByStatus: { status: string; count: number }[];
  totalEntityCount: number;
}
