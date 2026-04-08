import { FASCIST_EXECUTIVE_TRACK } from "@secret/shared";
import type {
  ExecutivePower,
  GovernmentPublicState,
  PartyMembership,
  PlayerPublicSeat,
  Policy,
  VotePublicRecord
} from "@secret/shared";

import { getPartyMembership, getKnownTeam } from "./knowledge.js";
import { aliveSeatOrder, getEligibleChancellorIds, getPlayerCount } from "./utils.js";
import type { PendingExecutiveAction, RoomState } from "./types.js";

export interface HostView {
  roomId: string;
  roomCode: string;
  phase: RoomState["phase"];
  turn: number;
  seatLocked: boolean;
  electionTracker: number;
  liberalPolicyCount: number;
  fascistPolicyCount: number;
  fascistTrack: readonly ExecutivePower[];
  players: PlayerPublicSeat[];
  currentGovernment: GovernmentPublicState;
  revealedVotes: VotePublicRecord[] | null;
  publicLog: RoomState["publicLog"];
  statusText: string;
  winner: RoomState["winner"];
  canAdvance: boolean;
}

type PlayerAction =
  | {
      kind: "lobby";
      canToggleReady: boolean;
    }
  | {
      kind: "role_reveal";
      canConfirm: boolean;
    }
  | {
      kind: "nominate_chancellor";
      eligibleCandidateIds: string[];
    }
  | {
      kind: "vote";
      hasSubmitted: boolean;
    }
  | {
      kind: "president_draw";
      cards: [Policy, Policy, Policy];
      canReveal: boolean;
    }
  | {
      kind: "president_discard";
      cards: [Policy, Policy, Policy];
    }
  | {
      kind: "chancellor_legislate";
      cards: [Policy, Policy];
      canRequestVeto: boolean;
      vetoRequested: boolean;
      waitingOnPresident: boolean;
    }
  | {
      kind: "investigate";
      eligibleTargetIds: string[];
      result: PartyMembership | null;
    }
  | {
      kind: "special_election";
      eligibleTargetIds: string[];
    }
  | {
      kind: "execution";
      eligibleTargetIds: string[];
    }
  | {
      kind: "policy_peek";
      cards: [Policy, Policy, Policy];
    }
  | {
      kind: "dead";
    }
  | {
      kind: "waiting";
      message: string;
    };

export interface PlayerView {
  roomId: string;
  roomCode: string;
  phase: RoomState["phase"];
  turn: number;
  playerId: string;
  nickname: string;
  isAlive: boolean;
  role: RoomState["players"][string]["role"];
  partyMembership: PartyMembership | null;
  teamKnowledge: ReturnType<typeof getKnownTeam>;
  publicState: HostView;
  action: PlayerAction;
}

function getStatusText(state: RoomState): string {
  switch (state.phase) {
    case "lobby":
      return "플레이어 대기 중";
    case "game_setup":
      return "게임 준비 중";
    case "role_reveal":
      return "플레이어들이 역할을 확인하는 중";
    case "president_rotation":
      return `${state.players[state.currentPresidentId ?? ""]?.nickname ?? "대통령"} 님 차례`;
    case "chancellor_nomination":
      return "대통령이 수상 후보를 지명하는 중";
    case "voting_open":
      return "모든 생존 플레이어의 투표를 기다리는 중";
    case "voting_reveal":
      return "투표 결과 공개";
    case "government_formed":
      return "정부가 성립되었습니다.";
    case "hitler_chancellor_check":
      return "수상이 히틀러인지 확인 중";
    case "president_draw_3":
    case "president_discards_1":
      return "대통령이 정책을 고르는 중";
    case "chancellor_chooses_1_or_veto":
      return state.pendingLegislativeSession?.vetoRequested
        ? "대통령이 베토 요청에 응답하는 중"
        : "수상이 정책을 고르는 중";
    case "enact_policy":
      return "정책이 시행되었습니다.";
    case "resolve_executive_power":
      switch (state.pendingExecutiveAction?.power) {
        case "investigate_loyalty":
          return "대통령이 충성심 조사를 진행 중";
        case "policy_peek":
          return "대통령이 정책 더미를 확인 중";
        case "special_election":
          return "대통령이 특수 선거 대상을 선택 중";
        case "execution":
          return "대통령이 처형 대상을 선택 중";
        default:
          return "대통령 권한 해결 중";
      }
    case "next_round":
      return "다음 라운드를 준비하는 중";
    case "game_over":
      return state.winner?.winner === "liberals" ? "자유당 승리" : "파시스트 승리";
    default:
      return "게임 진행 중";
  }
}

function canHostAdvance(state: RoomState): boolean {
  switch (state.phase) {
    case "game_setup":
    case "president_rotation":
    case "government_formed":
    case "hitler_chancellor_check":
    case "enact_policy":
    case "next_round":
      return true;
    case "role_reveal":
      return aliveSeatOrder(state).every(
        (playerId) => state.players[playerId]?.hasConfirmedRoleReveal
      );
    case "voting_reveal":
      return true;
    default:
      return false;
  }
}

function getEligibleExecutiveTargets(
  state: RoomState,
  playerId: string,
  action: PendingExecutiveAction
): string[] {
  const alive = aliveSeatOrder(state).filter((id) => id !== playerId);
  if (action.power === "investigate_loyalty") {
    return alive.filter((id) => !state.investigatedPlayerIds.includes(id));
  }
  return alive;
}

export function getHostView(state: RoomState): HostView {
  const players = state.seatOrder.map((playerId, seatIndex) => ({
    id: playerId,
    nickname: state.players[playerId]?.nickname ?? playerId,
    seatIndex,
    isAlive: state.players[playerId]?.isAlive ?? false,
    isConnected: false,
    isReady: state.players[playerId]?.isReady ?? false
  }));

  return {
    roomId: state.roomId,
    roomCode: state.roomCode,
    phase: state.phase,
    turn: state.turn,
    seatLocked: state.seatLocked,
    electionTracker: state.electionTracker,
    liberalPolicyCount: state.liberalPolicyCount,
    fascistPolicyCount: state.fascistPolicyCount,
    fascistTrack: FASCIST_EXECUTIVE_TRACK[getPlayerCount(state)],
    players,
    currentGovernment: {
      presidentId: state.currentPresidentId,
      presidentName: state.currentPresidentId
        ? state.players[state.currentPresidentId]?.nickname ?? null
        : null,
      chancellorId: state.currentChancellorId,
      chancellorName: state.currentChancellorId
        ? state.players[state.currentChancellorId]?.nickname ?? null
        : null
    },
    revealedVotes: state.revealedVoteSummary?.revealedVotes ?? null,
    publicLog: state.publicLog,
    statusText: getStatusText(state),
    winner: state.winner,
    canAdvance: canHostAdvance(state)
  };
}

export function getPlayerView(state: RoomState, playerId: string): PlayerView {
  const player = state.players[playerId];
  if (!player) {
    throw new Error("플레이어를 찾을 수 없습니다.");
  }

  const publicState = getHostView(state);
  const teamKnowledge = player.role ? getKnownTeam(state, playerId) : [];
  const partyMembership = player.role ? getPartyMembership(player.role) : null;

  let action: PlayerAction = {
    kind: "waiting",
    message: publicState.statusText
  };

  if (!player.isAlive) {
    action = { kind: "dead" };
  } else {
    switch (state.phase) {
      case "lobby":
        action = {
          kind: "lobby",
          canToggleReady: true
        };
        break;
      case "role_reveal":
        action = {
          kind: "role_reveal",
          canConfirm: !player.hasConfirmedRoleReveal
        };
        break;
      case "chancellor_nomination":
        if (state.currentPresidentId === playerId) {
          action = {
            kind: "nominate_chancellor",
            eligibleCandidateIds: getEligibleChancellorIds(state)
          };
        }
        break;
      case "voting_open":
        action = {
          kind: "vote",
          hasSubmitted: Boolean(state.pendingVotes[playerId])
        };
        break;
      case "president_draw_3":
        if (
          state.currentPresidentId === playerId &&
          state.pendingLegislativeSession?.drawnCards
        ) {
          action = {
            kind: "president_draw",
            cards: state.pendingLegislativeSession.drawnCards,
            canReveal: true
          };
        }
        break;
      case "president_discards_1":
        if (
          state.currentPresidentId === playerId &&
          state.pendingLegislativeSession?.drawnCards
        ) {
          action = {
            kind: "president_discard",
            cards: state.pendingLegislativeSession.drawnCards
          };
        }
        break;
      case "chancellor_chooses_1_or_veto":
        if (
          state.currentChancellorId === playerId &&
          state.pendingLegislativeSession?.cardsForChancellor
        ) {
          action = {
            kind: "chancellor_legislate",
            cards: state.pendingLegislativeSession.cardsForChancellor,
            canRequestVeto: state.fascistPolicyCount >= 5,
            vetoRequested: state.pendingLegislativeSession.vetoRequested,
            waitingOnPresident: state.pendingLegislativeSession.vetoRequested
          };
        }
        break;
      case "resolve_executive_power":
        if (state.currentPresidentId === playerId && state.pendingExecutiveAction) {
          if (state.pendingExecutiveAction.power === "investigate_loyalty") {
            action = {
              kind: "investigate",
              eligibleTargetIds: getEligibleExecutiveTargets(
                state,
                playerId,
                state.pendingExecutiveAction
              ),
              result: state.pendingExecutiveAction.investigationResult
            };
          } else if (state.pendingExecutiveAction.power === "special_election") {
            action = {
              kind: "special_election",
              eligibleTargetIds: getEligibleExecutiveTargets(
                state,
                playerId,
                state.pendingExecutiveAction
              )
            };
          } else if (state.pendingExecutiveAction.power === "execution") {
            action = {
              kind: "execution",
              eligibleTargetIds: getEligibleExecutiveTargets(
                state,
                playerId,
                state.pendingExecutiveAction
              )
            };
          } else if (
            state.pendingExecutiveAction.power === "policy_peek" &&
            state.pendingExecutiveAction.peekedPolicies
          ) {
            action = {
              kind: "policy_peek",
              cards: state.pendingExecutiveAction.peekedPolicies
            };
          }
        }
        break;
      default:
        break;
    }
  }

  return {
    roomId: state.roomId,
    roomCode: state.roomCode,
    phase: state.phase,
    turn: state.turn,
    playerId,
    nickname: player.nickname,
    isAlive: player.isAlive,
    role: player.role,
    partyMembership,
    teamKnowledge,
    publicState,
    action
  };
}
