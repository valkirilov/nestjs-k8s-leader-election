export interface LeaderElectionOptions {
  leaseName?: string;
  namespace?: string;
  renewalInterval?: number;
  logAtLevel: 'log' | 'debug'
  awaitLeadership?: boolean;
  /**
   * Maximum number of consecutive renewal failures before giving up leadership.
   * Uses exponential backoff between retries (10s → 20s → 40s).
   * Default: 3
   */
  maxConsecutiveFailures?: number;
}

export const LEADER_ELECTION_OPTIONS = 'LEADER_ELECTION_OPTIONS';

export const LeaderElectedEvent = 'leader.elected';
export const LeaderLostEvent = 'leader.lost';
