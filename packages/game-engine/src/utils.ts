import {
  FASCIST_EXECUTIVE_TRACK,
  GAME_OVER_REASONS,
  POLICY_DECK_COUNTS,
  PUBLIC_LOG_KINDS,
  ROLE_DISTRIBUTION
} from "@secret/shared";
import type {
  ExecutivePower,
  PartyMembership,
  PlayerCount,
  Policy,
  PublicLogEntry,
  PublicLogKind,
  Role,
  RoleDistribution,
  Vote,
  VotePublicRecord,
  WinnerState
} from "@secret/shared";

import { GameEngineError } from "./errors.js";
import { getPartyMembership } from "./knowledge.js";
import type {
  EngineOptions,
  EnginePlayer,
  PendingLegislativeSession,
  RevealedVoteSummary,
  RoomState
} from "./types.js";

export function now(options?: EngineOptions): string {
  return options?.now ?? new Date().toISOString();
}

export function randomFn(options?: EngineOptions): () => number {
  return options?.random ?? Math.random;
}

export function shuffleArray<T>(items: T[], options?: EngineOptions): T[] {
  const random = randomFn(options);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = copy[index] as T;
    const target = copy[swapIndex] as T;
    copy[index] = target;
    copy[swapIndex] = current;
  }
  return copy;
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new GameEngineError(message);
  }
}

export function getPlayerCount(state: RoomState): PlayerCount {
  const count = state.seatOrder.length;
  assert(
    count in ROLE_DISTRIBUTION,
    "지원하지 않는 플레이어 수입니다."
  );
  return count as PlayerCount;
}

export function getRoleDistribution(playerCount: PlayerCount): RoleDistribution {
  return ROLE_DISTRIBUTION[playerCount];
}

export function buildPolicyDeck(): Policy[] {
  return [
    ...Array.from({ length: POLICY_DECK_COUNTS.liberal }, () => "liberal" as const),
    ...Array.from({ length: POLICY_DECK_COUNTS.fascist }, () => "fascist" as const)
  ];
}

export function buildRoleDeck(playerCount: PlayerCount): Role[] {
  const distribution = getRoleDistribution(playerCount);
  return [
    ...Array.from({ length: distribution.liberal }, () => "liberal" as const),
    ...Array.from({ length: distribution.fascist }, () => "fascist" as const),
    ...Array.from({ length: distribution.hitler }, () => "hitler" as const)
  ];
}

export function addLog(
  state: RoomState,
  kind: PublicLogKind,
  message: string,
  options?: EngineOptions
): RoomState {
  const entry: PublicLogEntry = {
    id: `${kind}-${state.turn}-${state.publicLog.length + 1}`,
    turn: state.turn,
    kind,
    message,
    createdAt: now(options)
  };

  return {
    ...state,
    publicLog: [...state.publicLog, entry],
    updatedAt: now(options)
  };
}

export function getPlayerOrThrow(
  state: RoomState,
  playerId: string
): EnginePlayer {
  const player = state.players[playerId];
  assert(player, "플레이어를 찾을 수 없습니다.");
  return player;
}

export function assertAlivePlayer(state: RoomState, playerId: string): void {
  const player = getPlayerOrThrow(state, playerId);
  assert(player.isAlive, "탈락한 플레이어는 이 행동을 할 수 없습니다.");
}

export function aliveSeatOrder(state: RoomState): string[] {
  return state.seatOrder.filter((playerId) => state.players[playerId]?.isAlive);
}

export function getSeatIndex(state: RoomState, playerId: string): number {
  return state.seatOrder.indexOf(playerId);
}

export function getNextAliveAfter(
  state: RoomState,
  playerId: string | null
): string | null {
  const alive = aliveSeatOrder(state);
  if (alive.length === 0) {
    return null;
  }

  if (!playerId || !alive.includes(playerId)) {
    return alive[0] ?? null;
  }

  const currentIndex = alive.indexOf(playerId);
  return alive[(currentIndex + 1) % alive.length] ?? null;
}

export function getNormalizedRegularNextPresident(
  state: RoomState
): string | null {
  if (!state.regularNextPresidentId) {
    return aliveSeatOrder(state)[0] ?? null;
  }

  if (state.players[state.regularNextPresidentId]?.isAlive) {
    return state.regularNextPresidentId;
  }

  return getNextAliveAfter(state, state.regularNextPresidentId);
}

export function getEligibleChancellorIds(state: RoomState): string[] {
  const presidentId = state.currentPresidentId;
  assert(presidentId, "대통령 후보가 없습니다.");

  const playerCount = getPlayerCount(state);
  const alive = aliveSeatOrder(state);

  return alive.filter((candidateId) => {
    if (candidateId === presidentId) {
      return false;
    }

    const lastGovernment = state.lastElectedGovernment;
    if (candidateId === lastGovernment.chancellorId) {
      return false;
    }

    if (playerCount !== 5 && candidateId === lastGovernment.presidentId) {
      return false;
    }

    return true;
  });
}

export function getExecutivePowerForTrack(
  playerCount: PlayerCount,
  fascistPolicyCount: number
): ExecutivePower {
  if (fascistPolicyCount < 1 || fascistPolicyCount > 5) {
    return "none";
  }
  return FASCIST_EXECUTIVE_TRACK[playerCount][fascistPolicyCount - 1] ?? "none";
}

export function tallyVotes(
  state: RoomState,
  votes: Record<string, Vote>
): RevealedVoteSummary {
  const revealedVotes: VotePublicRecord[] = aliveSeatOrder(state).map((playerId) => ({
    playerId,
    nickname: state.players[playerId]?.nickname ?? playerId,
    vote: votes[playerId] ?? "nein"
  }));

  const jaCount = revealedVotes.filter((record) => record.vote === "ja").length;
  const neinCount = revealedVotes.length - jaCount;

  return {
    revealedVotes,
    jaCount,
    neinCount,
    passed: jaCount > revealedVotes.length / 2
  };
}

export function assignRoles(
  state: RoomState,
  options?: EngineOptions
): RoomState {
  const playerCount = getPlayerCount(state);
  const roleDeck = shuffleArray(buildRoleDeck(playerCount), options);
  const shuffledPlayers = shuffleArray([...state.seatOrder], options);

  const nextPlayers = { ...state.players };
  shuffledPlayers.forEach((playerId, index) => {
    const role = roleDeck[index];
    const existing = nextPlayers[playerId];
    assert(role, "역할 카드 분배에 실패했습니다.");
    assert(existing, "역할을 배정할 플레이어를 찾을 수 없습니다.");
    nextPlayers[playerId] = {
      ...existing,
      role,
      isAlive: true,
      hasConfirmedRoleReveal: false
    };
  });

  return {
    ...state,
    players: nextPlayers,
    updatedAt: now(options)
  };
}

export function assignDeck(state: RoomState, options?: EngineOptions): RoomState {
  return {
    ...state,
    drawPile: shuffleArray(buildPolicyDeck(), options),
    discardPile: [],
    updatedAt: now(options)
  };
}

export function refillDeckIfNeeded(
  state: RoomState,
  minimumCards: number,
  options?: EngineOptions
): RoomState {
  if (state.drawPile.length >= minimumCards) {
    return state;
  }

  const mergedDeck = shuffleArray([...state.drawPile, ...state.discardPile], options);
  assert(
    mergedDeck.length >= minimumCards,
    "정책 카드가 부족합니다."
  );

  return {
    ...state,
    drawPile: mergedDeck,
    discardPile: [],
    updatedAt: now(options)
  };
}

export function startLegislativeSession(
  state: RoomState,
  options?: EngineOptions
): RoomState {
  const preparedState = refillDeckIfNeeded(state, 3, options);
  const drawnCards = preparedState.drawPile.slice(0, 3) as [Policy, Policy, Policy];
  assert(drawnCards.length === 3, "대통령이 뽑을 정책 카드가 부족합니다.");

  const nextSession: PendingLegislativeSession = {
    presidentId: preparedState.currentPresidentId as string,
    chancellorId: preparedState.currentChancellorId as string,
    drawnCards,
    cardsForChancellor: null,
    vetoRequested: false
  };

  return {
    ...preparedState,
    drawPile: preparedState.drawPile.slice(3),
    pendingLegislativeSession: nextSession,
    updatedAt: now(options)
  };
}

export function computeWinnerFromPolicies(state: RoomState): WinnerState | null {
  if (state.liberalPolicyCount >= 5) {
    return {
      winner: "liberals",
      reason: GAME_OVER_REASONS[0]
    };
  }

  if (state.fascistPolicyCount >= 6) {
    return {
      winner: "fascists",
      reason: GAME_OVER_REASONS[1]
    };
  }

  return null;
}

export function enactPolicy(
  state: RoomState,
  policy: Policy,
  source: "government" | "chaos",
  options?: EngineOptions
): RoomState {
  const playerCount = getPlayerCount(state);
  const nextState = {
    ...state,
    liberalPolicyCount:
      policy === "liberal" ? state.liberalPolicyCount + 1 : state.liberalPolicyCount,
    fascistPolicyCount:
      policy === "fascist" ? state.fascistPolicyCount + 1 : state.fascistPolicyCount,
    electionTracker: 0,
    pendingPolicyResolution: {
      source,
      enactedPolicy: policy,
      triggeredPower:
        source === "government" && policy === "fascist"
          ? getExecutivePowerForTrack(playerCount, state.fascistPolicyCount + 1)
          : "none"
    },
    pendingLegislativeSession: null,
    revealedVoteSummary: state.revealedVoteSummary,
    updatedAt: now(options)
  };

  return nextState;
}

export function resetTermLimits(state: RoomState): RoomState {
  return {
    ...state,
    lastElectedGovernment: {
      presidentId: null,
      chancellorId: null
    }
  };
}

export function createChaosResolution(
  state: RoomState,
  options?: EngineOptions
): RoomState {
  const preparedState = refillDeckIfNeeded(state, 1, options);
  const policy = preparedState.drawPile[0];
  assert(policy, "혼란 정책 카드를 찾을 수 없습니다.");

  const chaosState = enactPolicy(
    {
      ...preparedState,
      drawPile: preparedState.drawPile.slice(1),
      electionTracker: 0
    },
    policy,
    "chaos",
    options
  );

  return resetTermLimits(chaosState);
}

export function getWinnerForHitlerElection(state: RoomState): WinnerState | null {
  const chancellorId = state.currentChancellorId;
  if (!chancellorId) {
    return null;
  }

  const chancellor = state.players[chancellorId];
  if (state.fascistPolicyCount >= 3 && chancellor?.role === "hitler") {
    return {
      winner: "fascists",
      reason: GAME_OVER_REASONS[2]
    };
  }

  return null;
}

export function prepareNextRound(state: RoomState, options?: EngineOptions): RoomState {
  const nextRegularPresidentId =
    state.currentRoundType === "regular"
      ? getNextAliveAfter(state, state.currentPresidentId)
      : getNormalizedRegularNextPresident(state);

  return {
    ...state,
    phase: "next_round",
    turn: state.turn + 1,
    currentPresidentId: null,
    currentChancellorId: null,
    nominatedChancellorId: null,
    currentRoundType: null,
    regularNextPresidentId: nextRegularPresidentId,
    specialElection:
      state.currentRoundType === "special" ? null : state.specialElection,
    pendingVotes: {},
    revealedVoteSummary: null,
    pendingExecutiveAction: null,
    pendingLegislativeSession: null,
    pendingPolicyResolution: null,
    updatedAt: now(options)
  };
}

export function beginPresidency(state: RoomState, options?: EngineOptions): RoomState {
  const currentPresidentId = state.specialElection
    ? state.specialElection.forcedPresidentId
    : getNormalizedRegularNextPresident(state);

  assert(currentPresidentId, "대통령 후보를 정할 수 없습니다.");

  return {
    ...state,
    phase: "president_rotation",
    currentPresidentId,
    currentRoundType: state.specialElection ? "special" : "regular",
    updatedAt: now(options)
  };
}

export function describeVoteSummary(summary: RevealedVoteSummary): string {
  return `Ja ${summary.jaCount}표, Nein ${summary.neinCount}표`;
}

export function validatePublicLogKind(kind: string): kind is PublicLogKind {
  return (PUBLIC_LOG_KINDS as readonly string[]).includes(kind);
}

export function getInvestigationResult(
  state: RoomState,
  targetId: string
): PartyMembership {
  const target = getPlayerOrThrow(state, targetId);
  assert(target.role, "조사 대상의 역할이 없습니다.");
  return getPartyMembership(target.role);
}
