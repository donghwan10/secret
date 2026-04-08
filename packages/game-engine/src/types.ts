import type {
  ExecutivePower,
  GamePhase,
  PartyMembership,
  Policy,
  PublicLogEntry,
  Role,
  Vote,
  VotePublicRecord,
  WinnerState
} from "@secret/shared";

export interface EnginePlayer {
  id: string;
  nickname: string;
  role: Role | null;
  isAlive: boolean;
  isReady: boolean;
  hasConfirmedRoleReveal: boolean;
}

export interface RevealedVoteSummary {
  revealedVotes: VotePublicRecord[];
  jaCount: number;
  neinCount: number;
  passed: boolean;
}

export interface PendingLegislativeSession {
  presidentId: string;
  chancellorId: string;
  drawnCards: [Policy, Policy, Policy];
  cardsForChancellor: [Policy, Policy] | null;
  vetoRequested: boolean;
}

export interface PendingPolicyResolution {
  source: "government" | "chaos";
  enactedPolicy: Policy;
  triggeredPower: ExecutivePower;
}

export interface PendingExecutiveAction {
  power: Exclude<ExecutivePower, "none">;
  presidentId: string;
  targetId: string | null;
  investigationResult: PartyMembership | null;
  peekedPolicies: [Policy, Policy, Policy] | null;
}

export interface SpecialElectionState {
  triggeredById: string;
  forcedPresidentId: string;
}

export interface LastElectedGovernment {
  presidentId: string | null;
  chancellorId: string | null;
}

export interface RoomState {
  roomId: string;
  roomCode: string;
  createdAt: string;
  updatedAt: string;
  phase: GamePhase;
  turn: number;
  seatOrder: string[];
  seatLocked: boolean;
  players: Record<string, EnginePlayer>;
  currentPresidentId: string | null;
  currentChancellorId: string | null;
  nominatedChancellorId: string | null;
  currentRoundType: "regular" | "special" | null;
  regularNextPresidentId: string | null;
  specialElection: SpecialElectionState | null;
  electionTracker: number;
  liberalPolicyCount: number;
  fascistPolicyCount: number;
  drawPile: Policy[];
  discardPile: Policy[];
  pendingVotes: Record<string, Vote>;
  revealedVoteSummary: RevealedVoteSummary | null;
  lastElectedGovernment: LastElectedGovernment;
  investigatedPlayerIds: string[];
  pendingLegislativeSession: PendingLegislativeSession | null;
  pendingPolicyResolution: PendingPolicyResolution | null;
  pendingExecutiveAction: PendingExecutiveAction | null;
  winner: WinnerState | null;
  publicLog: PublicLogEntry[];
}

export interface EngineOptions {
  now?: string;
  random?: () => number;
}

export type EngineCommand =
  | {
      type: "add_player";
      playerId: string;
      nickname: string;
    }
  | {
      type: "set_player_ready";
      playerId: string;
      ready: boolean;
    }
  | {
      type: "reorder_seats";
      seatOrder: string[];
    }
  | {
      type: "randomize_seats";
    }
  | {
      type: "set_seat_lock";
      locked: boolean;
    }
  | {
      type: "start_game";
    }
  | {
      type: "advance_phase";
    }
  | {
      type: "confirm_role_reveal";
      playerId: string;
    }
  | {
      type: "nominate_chancellor";
      presidentId: string;
      candidateId: string;
    }
  | {
      type: "cast_vote";
      playerId: string;
      vote: Vote;
    }
  | {
      type: "president_reveal_draw";
      presidentId: string;
    }
  | {
      type: "president_discard_policy";
      presidentId: string;
      policyIndex: number;
    }
  | {
      type: "chancellor_enact_policy";
      chancellorId: string;
      policyIndex: number;
    }
  | {
      type: "chancellor_request_veto";
      chancellorId: string;
    }
  | {
      type: "president_respond_veto";
      presidentId: string;
      accept: boolean;
    }
  | {
      type: "investigate_loyalty";
      presidentId: string;
      targetId: string;
    }
  | {
      type: "special_election";
      presidentId: string;
      targetId: string;
    }
  | {
      type: "execute_player";
      presidentId: string;
      targetId: string;
    }
  | {
      type: "acknowledge_executive_action";
      presidentId: string;
    };
