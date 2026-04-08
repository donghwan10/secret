import type {
  EXECUTIVE_POWERS,
  GAME_OVER_REASONS,
  GAME_PHASES,
  PLAYER_COUNTS,
  POLICIES,
  PUBLIC_LOG_KINDS,
  ROLES,
  VOTES,
  WINNERS
} from "./constants.js";

export type PlayerCount = (typeof PLAYER_COUNTS)[number];
export type GamePhase = (typeof GAME_PHASES)[number];
export type Role = (typeof ROLES)[number];
export type PartyMembership = "liberal" | "fascist";
export type Policy = (typeof POLICIES)[number];
export type Vote = (typeof VOTES)[number];
export type ExecutivePower = (typeof EXECUTIVE_POWERS)[number];
export type Winner = (typeof WINNERS)[number];
export type GameOverReason = (typeof GAME_OVER_REASONS)[number];
export type PublicLogKind = (typeof PUBLIC_LOG_KINDS)[number];

export type RoleDistribution = Readonly<Record<Role, number>>;

export interface PublicLogEntry {
  id: string;
  turn: number;
  kind: PublicLogKind;
  message: string;
  createdAt: string;
}

export interface PlayerPublicSeat {
  id: string;
  nickname: string;
  seatIndex: number;
  isAlive: boolean;
  isConnected: boolean;
  isReady: boolean;
}

export interface VotePublicRecord {
  playerId: string;
  nickname: string;
  vote: Vote;
}

export interface GovernmentPublicState {
  presidentId: string | null;
  presidentName: string | null;
  chancellorId: string | null;
  chancellorName: string | null;
}

export interface WinnerState {
  winner: Winner;
  reason: GameOverReason;
}
