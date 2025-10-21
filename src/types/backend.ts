// Backend API Response Types

export interface LogPracticeResponse {
  ok: boolean;
  xpGained?: number;
  xpToday?: number;
  xpTotal?: number;
  streak?: {
    current: number;
    best: number;
  };
  challenge?: {
    daysDone: number;
    target: number;
    isCompleted: boolean;
  } | null;
  league?: {
    id: string;
    xpWeek: number;
    rank: number | null;
  } | null;
  code?: string;
  message?: string;
}

export interface DashboardResponse {
  ok: boolean;
  today?: {
    minutes: number;
    logs: number;
    xpToday: number;
  };
  xpTotal?: number;
  level?: number;
  streak?: {
    current: number;
    best: number;
  };
  challenge?: {
    daysDone: number;
    target: number;
    isCompleted: boolean;
  } | null;
  league?: {
    id: string;
    xpWeek: number;
    rank: number | null;
  } | null;
  error?: string;
}

export interface AchievementBadge {
  id: string;
  code: string;
  title: string;
  description?: string;
  kind: string;
  earnedAt: string;
}

export interface AchievementsResponse {
  ok: boolean;
  level?: {
    current: number;
    xpTotal: number;
    xpForNextLevel: number;
    progressPercent: number;
  };
  badges?: AchievementBadge[];
  league?: {
    id: string;
    weekStart: string;
    weekEnd: string;
    rank: number | null;
  } | null;
  error?: string;
}

export interface SaveTrainingPlanResponse {
  ok: boolean;
  error?: string;
}

// Challenge System Response Types
export interface ChallengeCurrentWeek {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export interface ActiveChallenge {
  instanceId: string;
  code: string;
  title: string;
  kind: 'periodic' | 'rolling';
  type: 'days_in_period' | 'streak' | 'xp_target';
  targetDays: number;
  daysDone: number;
  current?: number; // for streak type
  status: 'open' | 'locked';
  isCompleted: boolean;
  isClaimable: boolean;
  windowStart?: string; // YYYY-MM-DD
  windowEnd?: string; // YYYY-MM-DD
}

export interface ClaimableChallenge {
  instanceId: string;
  code: string;
  title: string;
  reward: {
    xp: number;
    badge_code?: string;
    claimable: boolean;
  };
  completedAt: string; // ISO8601
}

export interface UpcomingChallenge {
  code: string;
  title: string;
  kind: 'periodic' | 'rolling';
  period?: 'week' | 'month';
  windowStart: string; // YYYY-MM-DD
  windowEnd: string; // YYYY-MM-DD
}

export interface GetChallengesViewResponse {
  ok: boolean;
  currentWeek: ChallengeCurrentWeek;
  active: ActiveChallenge[];
  claimable: ClaimableChallenge[];
  upcoming: UpcomingChallenge[];
  error?: string;
}

export interface ClaimChallengeRewardResponse {
  ok: boolean;
  xpAwarded?: number;
  badgeGranted?: boolean;
  claimedAt?: string; // ISO8601
  alreadyClaimed?: boolean;
  error?: string;
}
