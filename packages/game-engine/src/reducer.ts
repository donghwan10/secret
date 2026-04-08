import { MAX_PLAYERS, MIN_PLAYERS } from "@secret/shared";
import type { WinnerState } from "@secret/shared";

import { GameEngineError } from "./errors.js";
import {
  addLog,
  aliveSeatOrder,
  assert,
  assertAlivePlayer,
  assignDeck,
  assignRoles,
  beginPresidency,
  createChaosResolution,
  describeVoteSummary,
  enactPolicy,
  getEligibleChancellorIds,
  getExecutivePowerForTrack,
  getInvestigationResult,
  getNormalizedRegularNextPresident,
  getPlayerCount,
  getPlayerOrThrow,
  getWinnerForHitlerElection,
  now,
  prepareNextRound,
  refillDeckIfNeeded,
  shuffleArray,
  startLegislativeSession,
  tallyVotes
} from "./utils.js";
import type { EngineCommand, EngineOptions, RoomState } from "./types.js";

function withWinner(
  state: RoomState,
  winner: WinnerState,
  options?: EngineOptions
): RoomState {
  return addLog(
    {
      ...state,
      winner,
      phase: "game_over",
      updatedAt: now(options)
    },
    "game_over",
    winner.winner === "liberals" ? "자유당 승리" : "파시스트 승리",
    options
  );
}

function assertPhase(state: RoomState, phase: RoomState["phase"]): void {
  if (state.phase !== phase) {
    throw new GameEngineError(
      `현재 단계(${state.phase})에서는 이 행동을 할 수 없습니다.`
    );
  }
}

function startGame(state: RoomState, options?: EngineOptions): RoomState {
  assertPhase(state, "lobby");
  assert(
    state.seatOrder.length >= MIN_PLAYERS && state.seatOrder.length <= MAX_PLAYERS,
    "게임은 5명에서 10명 사이일 때만 시작할 수 있습니다."
  );

  const withRoles = assignRoles(state, options);
  const withDeck = assignDeck(withRoles, options);
  const firstPresidentId = shuffleArray([...withDeck.seatOrder], options)[0] ?? null;

  return addLog(
    {
      ...withDeck,
      phase: "game_setup",
      turn: 1,
      currentPresidentId: null,
      currentChancellorId: null,
      nominatedChancellorId: null,
      currentRoundType: null,
      regularNextPresidentId: firstPresidentId,
      specialElection: null,
      electionTracker: 0,
      liberalPolicyCount: 0,
      fascistPolicyCount: 0,
      pendingVotes: {},
      revealedVoteSummary: null,
      lastElectedGovernment: {
        presidentId: null,
        chancellorId: null
      },
      investigatedPlayerIds: [],
      pendingLegislativeSession: null,
      pendingPolicyResolution: null,
      pendingExecutiveAction: null,
      winner: null,
      updatedAt: now(options)
    },
    "game_started",
    "게임을 시작했습니다.",
    options
  );
}

function advancePhase(state: RoomState, options?: EngineOptions): RoomState {
  switch (state.phase) {
    case "game_setup":
      return {
        ...state,
        phase: "role_reveal",
        updatedAt: now(options)
      };

    case "role_reveal": {
      const everyoneConfirmed = aliveSeatOrder(state).every(
        (playerId) => state.players[playerId]?.hasConfirmedRoleReveal
      );
      assert(everyoneConfirmed, "모든 플레이어가 역할 확인을 마쳐야 합니다.");
      return addLog(
        beginPresidency(
          {
            ...state,
            phase: "president_rotation"
          },
          options
        ),
        "role_reveal_complete",
        "모든 플레이어가 역할 확인을 완료했습니다.",
        options
      );
    }

    case "president_rotation":
      assert(state.currentPresidentId, "대통령 후보가 없습니다.");
      return {
        ...state,
        phase: "chancellor_nomination",
        updatedAt: now(options)
      };

    case "voting_reveal":
      assert(state.revealedVoteSummary, "공개된 투표 결과가 없습니다.");
      if (state.revealedVoteSummary.passed) {
        return addLog(
          {
            ...state,
            phase: "government_formed",
            updatedAt: now(options)
          },
          "government_formed",
          `${state.players[state.currentPresidentId ?? ""]?.nickname ?? "대통령"} / ${
            state.players[state.currentChancellorId ?? ""]?.nickname ?? "수상"
          } 정부가 성립했습니다.`,
          options
        );
      }

      if (state.pendingPolicyResolution) {
        return {
          ...state,
          phase: "enact_policy",
          updatedAt: now(options)
        };
      }

      return prepareNextRound(state, options);

    case "government_formed":
      if (state.fascistPolicyCount >= 3) {
        return {
          ...state,
          phase: "hitler_chancellor_check",
          updatedAt: now(options)
        };
      }

      return {
        ...startLegislativeSession(state, options),
        phase: "president_draw_3",
        updatedAt: now(options)
      };

    case "hitler_chancellor_check": {
      const winner = getWinnerForHitlerElection(state);
      if (winner) {
        return withWinner(state, winner, options);
      }

      return {
        ...startLegislativeSession(state, options),
        phase: "president_draw_3",
        updatedAt: now(options)
      };
    }

    case "enact_policy": {
      assert(state.pendingPolicyResolution, "시행할 정책 정보가 없습니다.");

      if (state.pendingPolicyResolution.enactedPolicy === "liberal" && state.liberalPolicyCount >= 5) {
        return withWinner(
          state,
          {
            winner: "liberals",
            reason: "liberal_policy_track"
          },
          options
        );
      }

      if (
        state.pendingPolicyResolution.enactedPolicy === "fascist" &&
        state.fascistPolicyCount >= 6
      ) {
        return withWinner(
          state,
          {
            winner: "fascists",
            reason: "fascist_policy_track"
          },
          options
        );
      }

      if (
        state.pendingPolicyResolution.source === "government" &&
        state.pendingPolicyResolution.enactedPolicy === "fascist" &&
        state.pendingPolicyResolution.triggeredPower !== "none"
      ) {
        if (state.pendingPolicyResolution.triggeredPower === "policy_peek") {
          const preparedState = refillDeckIfNeeded(state, 3, options);
          const peekedPolicies = preparedState.drawPile.slice(0, 3) as [
            "liberal" | "fascist",
            "liberal" | "fascist",
            "liberal" | "fascist"
          ];

          return {
            ...preparedState,
            phase: "resolve_executive_power",
            pendingExecutiveAction: {
              power: "policy_peek",
              presidentId: state.currentPresidentId as string,
              targetId: null,
              investigationResult: null,
              peekedPolicies
            },
            updatedAt: now(options)
          };
        }

        return {
          ...state,
          phase: "resolve_executive_power",
          pendingExecutiveAction: {
            power: state.pendingPolicyResolution.triggeredPower,
            presidentId: state.currentPresidentId as string,
            targetId: null,
            investigationResult: null,
            peekedPolicies: null
          },
          updatedAt: now(options)
        };
      }

      return prepareNextRound(state, options);
    }

    case "resolve_executive_power": {
      assert(state.pendingExecutiveAction, "해결할 행정 권한이 없습니다.");
      if (state.pendingExecutiveAction.power === "policy_peek") {
        assert(
          state.pendingExecutiveAction.peekedPolicies,
          "정책 선정 결과가 없습니다."
        );
      }
      if (state.pendingExecutiveAction.power === "investigate_loyalty") {
        assert(
          state.pendingExecutiveAction.investigationResult,
          "조사 결과가 없습니다."
        );
      }
      return prepareNextRound(state, options);
    }

    case "next_round":
      return beginPresidency(state, options);

    default:
      throw new GameEngineError(
        `단계 ${state.phase}에서는 수동 진행이 필요하지 않습니다.`
      );
  }
}

export function createRoomState(input: {
  roomId: string;
  roomCode: string;
  createdAt?: string;
}): RoomState {
  const timestamp = input.createdAt ?? new Date().toISOString();
  return {
    roomId: input.roomId,
    roomCode: input.roomCode,
    createdAt: timestamp,
    updatedAt: timestamp,
    phase: "lobby",
    turn: 1,
    seatOrder: [],
    seatLocked: false,
    players: {},
    currentPresidentId: null,
    currentChancellorId: null,
    nominatedChancellorId: null,
    currentRoundType: null,
    regularNextPresidentId: null,
    specialElection: null,
    electionTracker: 0,
    liberalPolicyCount: 0,
    fascistPolicyCount: 0,
    drawPile: [],
    discardPile: [],
    pendingVotes: {},
    revealedVoteSummary: null,
    lastElectedGovernment: {
      presidentId: null,
      chancellorId: null
    },
    investigatedPlayerIds: [],
    pendingLegislativeSession: null,
    pendingPolicyResolution: null,
    pendingExecutiveAction: null,
    winner: null,
    publicLog: []
  };
}

export function applyCommand(
  state: RoomState,
  command: EngineCommand,
  options?: EngineOptions
): RoomState {
  switch (command.type) {
    case "add_player": {
      assertPhase(state, "lobby");
      assert(!state.seatLocked, "좌석이 잠겨 있어 참가할 수 없습니다.");
      assert(
        state.seatOrder.length < MAX_PLAYERS,
        "최대 10명까지만 참가할 수 있습니다."
      );
      assert(!state.players[command.playerId], "이미 참가한 플레이어입니다.");

      return addLog(
        {
          ...state,
          seatOrder: [...state.seatOrder, command.playerId],
          players: {
            ...state.players,
            [command.playerId]: {
              id: command.playerId,
              nickname: command.nickname,
              role: null,
              isAlive: true,
              isReady: false,
              hasConfirmedRoleReveal: false
            }
          },
          updatedAt: now(options)
        },
        "player_joined",
        `${command.nickname} 님이 로비에 참가했습니다.`,
        options
      );
    }

    case "set_player_ready": {
      assertPhase(state, "lobby");
      const player = getPlayerOrThrow(state, command.playerId);
      return {
        ...state,
        players: {
          ...state.players,
          [command.playerId]: {
            ...player,
            isReady: command.ready
          }
        },
        updatedAt: now(options)
      };
    }

    case "reorder_seats": {
      assertPhase(state, "lobby");
      const currentIds = [...state.seatOrder].sort();
      const nextIds = [...command.seatOrder].sort();
      assert(
        JSON.stringify(currentIds) === JSON.stringify(nextIds),
        "좌석 순서에는 현재 참가자만 포함되어야 합니다."
      );
      return addLog(
        {
          ...state,
          seatOrder: [...command.seatOrder],
          updatedAt: now(options)
        },
        "seat_order_updated",
        "좌석 순서가 변경되었습니다.",
        options
      );
    }

    case "randomize_seats": {
      assertPhase(state, "lobby");
      return addLog(
        {
          ...state,
          seatOrder: shuffleArray(state.seatOrder, options),
          updatedAt: now(options)
        },
        "seat_order_updated",
        "좌석 순서가 무작위로 배치되었습니다.",
        options
      );
    }

    case "set_seat_lock": {
      assertPhase(state, "lobby");
      return {
        ...state,
        seatLocked: command.locked,
        updatedAt: now(options)
      };
    }

    case "start_game":
      return startGame(state, options);

    case "advance_phase":
      return advancePhase(state, options);

    case "confirm_role_reveal": {
      assertPhase(state, "role_reveal");
      assertAlivePlayer(state, command.playerId);
      const player = getPlayerOrThrow(state, command.playerId);
      return {
        ...state,
        players: {
          ...state.players,
          [command.playerId]: {
            ...player,
            hasConfirmedRoleReveal: true
          }
        },
        updatedAt: now(options)
      };
    }

    case "nominate_chancellor": {
      assertPhase(state, "chancellor_nomination");
      assert(state.currentPresidentId === command.presidentId, "대통령만 수상을 지명할 수 있습니다.");
      const eligibleIds = getEligibleChancellorIds(state);
      assert(
        eligibleIds.includes(command.candidateId),
        "해당 플레이어는 수상 후보가 될 수 없습니다."
      );

      return addLog(
        {
          ...state,
          nominatedChancellorId: command.candidateId,
          phase: "voting_open",
          pendingVotes: {},
          updatedAt: now(options)
        },
        "nomination_made",
        `${state.players[command.presidentId]?.nickname ?? "대통령"} 님이 ${
          state.players[command.candidateId]?.nickname ?? "후보"
        } 님을 수상 후보로 지명했습니다.`,
        options
      );
    }

    case "cast_vote": {
      assertPhase(state, "voting_open");
      assertAlivePlayer(state, command.playerId);
      assert(!state.pendingVotes[command.playerId], "이미 투표를 제출했습니다.");

      const pendingVotes = {
        ...state.pendingVotes,
        [command.playerId]: command.vote
      };

      if (Object.keys(pendingVotes).length < aliveSeatOrder(state).length) {
        return {
          ...state,
          pendingVotes,
          updatedAt: now(options)
        };
      }

      const summary = tallyVotes(state, pendingVotes);
      let nextState: RoomState = {
        ...state,
        phase: "voting_reveal",
        pendingVotes,
        revealedVoteSummary: summary,
        updatedAt: now(options)
      };

      if (summary.passed) {
        nextState = {
          ...nextState,
          currentChancellorId: state.nominatedChancellorId,
          lastElectedGovernment: {
            presidentId: state.currentPresidentId,
            chancellorId: state.nominatedChancellorId
          }
        };
      } else {
        const rejectedState = {
          ...nextState,
          electionTracker: state.electionTracker + 1,
          currentChancellorId: null
        };

        nextState =
          rejectedState.electionTracker >= 3
            ? createChaosResolution(rejectedState, options)
            : rejectedState;
      }

      nextState = addLog(
        nextState,
        "votes_revealed",
        describeVoteSummary(summary),
        options
      );

      if (!summary.passed) {
        nextState = addLog(
          nextState,
          "government_rejected",
          "정부 구성안이 부결되었습니다.",
          options
        );
      }

      return nextState;
    }

    case "president_reveal_draw": {
      assertPhase(state, "president_draw_3");
      assert(
        state.currentPresidentId === command.presidentId,
        "대통령만 정책 카드를 확인할 수 있습니다."
      );
      return {
        ...state,
        phase: "president_discards_1",
        updatedAt: now(options)
      };
    }

    case "president_discard_policy": {
      assertPhase(state, "president_discards_1");
      assert(
        state.currentPresidentId === command.presidentId,
        "대통령만 정책 카드를 폐기할 수 있습니다."
      );
      const session = state.pendingLegislativeSession;
      assert(session, "진행 중인 입법 회의가 없습니다.");
      assert(session.cardsForChancellor === null, "이미 수상에게 카드가 전달되었습니다.");
      assert(
        command.policyIndex >= 0 && command.policyIndex < 3,
        "잘못된 정책 카드 인덱스입니다."
      );

      const discardedCard = session.drawnCards[command.policyIndex];
      assert(discardedCard, "선택한 정책 카드가 없습니다.");

      const remainingCards = session.drawnCards.filter(
        (_, index) => index !== command.policyIndex
      ) as ["liberal" | "fascist", "liberal" | "fascist"];

      return {
        ...state,
        phase: "chancellor_chooses_1_or_veto",
        discardPile: [...state.discardPile, discardedCard],
        pendingLegislativeSession: {
          ...session,
          cardsForChancellor: remainingCards
        },
        updatedAt: now(options)
      };
    }

    case "chancellor_request_veto": {
      assertPhase(state, "chancellor_chooses_1_or_veto");
      assert(
        state.currentChancellorId === command.chancellorId,
        "수상만 베토를 요청할 수 있습니다."
      );
      assert(state.fascistPolicyCount >= 5, "베토 권한이 아직 해금되지 않았습니다.");
      const session = state.pendingLegislativeSession;
      assert(session?.cardsForChancellor, "수상에게 전달된 정책 카드가 없습니다.");
      assert(!session.vetoRequested, "이미 베토를 요청했습니다.");

      return addLog(
        {
          ...state,
          pendingLegislativeSession: {
            ...session,
            vetoRequested: true
          },
          updatedAt: now(options)
        },
        "veto_requested",
        "수상이 베토를 요청했습니다.",
        options
      );
    }

    case "president_respond_veto": {
      assertPhase(state, "chancellor_chooses_1_or_veto");
      assert(
        state.currentPresidentId === command.presidentId,
        "대통령만 베토 요청에 응답할 수 있습니다."
      );
      const session = state.pendingLegislativeSession;
      assert(session?.cardsForChancellor, "베토를 처리할 정책 카드가 없습니다.");
      assert(session.vetoRequested, "대기 중인 베토 요청이 없습니다.");

      if (!command.accept) {
        return addLog(
          {
            ...state,
            pendingLegislativeSession: {
              ...session,
              vetoRequested: false
            },
            updatedAt: now(options)
          },
          "veto_rejected",
          "대통령이 베토를 거부했습니다.",
          options
        );
      }

      let nextState: RoomState = addLog(
        {
          ...state,
          discardPile: [...state.discardPile, ...session.cardsForChancellor],
          pendingLegislativeSession: null,
          electionTracker: state.electionTracker + 1,
          updatedAt: now(options)
        },
        "veto_accepted",
        "대통령이 베토를 수락했습니다.",
        options
      );

      if (nextState.electionTracker >= 3) {
        nextState = addLog(
          createChaosResolution(nextState, options),
          "chaos_policy_enacted",
          "선거 추적기가 가득 차 정책이 자동 시행됩니다.",
          options
        );
        return {
          ...nextState,
          phase: "enact_policy",
          updatedAt: now(options)
        };
      }

      return prepareNextRound(nextState, options);
    }

    case "chancellor_enact_policy": {
      assertPhase(state, "chancellor_chooses_1_or_veto");
      assert(
        state.currentChancellorId === command.chancellorId,
        "수상만 정책을 시행할 수 있습니다."
      );
      const session = state.pendingLegislativeSession;
      assert(session?.cardsForChancellor, "수상에게 전달된 정책 카드가 없습니다.");
      assert(
        command.policyIndex >= 0 && command.policyIndex < 2,
        "잘못된 정책 카드 인덱스입니다."
      );

      const enactedCard = session.cardsForChancellor[command.policyIndex];
      const discardedCard = session.cardsForChancellor[1 - command.policyIndex];
      assert(enactedCard && discardedCard, "정책 카드를 찾을 수 없습니다.");

      const enactedState = enactPolicy(
        {
          ...state,
          discardPile: [...state.discardPile, discardedCard]
        },
        enactedCard,
        "government",
        options
      );

      return addLog(
        {
          ...enactedState,
          phase: "enact_policy",
          updatedAt: now(options)
        },
        "policy_enacted",
        enactedCard === "liberal"
          ? "자유 정책이 시행되었습니다."
          : "파시스트 정책이 시행되었습니다.",
        options
      );
    }

    case "investigate_loyalty": {
      assertPhase(state, "resolve_executive_power");
      const pendingAction = state.pendingExecutiveAction;
      assert(
        pendingAction?.power === "investigate_loyalty",
        "현재는 충성심 조사를 사용할 수 없습니다."
      );
      assert(
        pendingAction.presidentId === command.presidentId,
        "대통령만 충성심 조사를 사용할 수 있습니다."
      );
      assertAlivePlayer(state, command.targetId);
      assert(command.targetId !== command.presidentId, "자기 자신은 조사할 수 없습니다.");
      assert(
        !state.investigatedPlayerIds.includes(command.targetId),
        "이미 조사한 플레이어입니다."
      );

      return addLog(
        {
          ...state,
          investigatedPlayerIds: [...state.investigatedPlayerIds, command.targetId],
          pendingExecutiveAction: {
            ...pendingAction,
            targetId: command.targetId,
            investigationResult: getInvestigationResult(state, command.targetId)
          },
          updatedAt: now(options)
        },
        "investigation_completed",
        `${state.players[command.targetId]?.nickname ?? "플레이어"} 님에 대한 조사 결과가 대통령에게 전달되었습니다.`,
        options
      );
    }

    case "special_election": {
      assertPhase(state, "resolve_executive_power");
      const pendingAction = state.pendingExecutiveAction;
      assert(
        pendingAction?.power === "special_election",
        "현재는 특수 선거를 사용할 수 없습니다."
      );
      assert(
        pendingAction.presidentId === command.presidentId,
        "대통령만 특수 선거를 지정할 수 있습니다."
      );
      assertAlivePlayer(state, command.targetId);
      assert(command.targetId !== command.presidentId, "자기 자신은 지명할 수 없습니다.");

      return prepareNextRound(
        addLog(
          {
            ...state,
            specialElection: {
              triggeredById: command.presidentId,
              forcedPresidentId: command.targetId
            },
            updatedAt: now(options)
          },
          "special_election_called",
          `${state.players[command.targetId]?.nickname ?? "플레이어"} 님이 차기 대통령 후보로 지정되었습니다.`,
          options
        ),
        options
      );
    }

    case "execute_player": {
      assertPhase(state, "resolve_executive_power");
      const pendingAction = state.pendingExecutiveAction;
      assert(
        pendingAction?.power === "execution",
        "현재는 처형을 사용할 수 없습니다."
      );
      assert(
        pendingAction.presidentId === command.presidentId,
        "대통령만 처형을 집행할 수 있습니다."
      );
      assertAlivePlayer(state, command.targetId);
      assert(command.targetId !== command.presidentId, "자기 자신은 처형할 수 없습니다.");

      const target = getPlayerOrThrow(state, command.targetId);
      const executedState: RoomState = addLog(
        {
          ...state,
          players: {
            ...state.players,
            [command.targetId]: {
              ...target,
              isAlive: false
            }
          },
          updatedAt: now(options)
        },
        "execution_completed",
        `${target.nickname} 님이 처형되었습니다.`,
        options
      );

      if (target.role === "hitler") {
        return withWinner(
          executedState,
          {
            winner: "liberals",
            reason: "hitler_executed"
          },
          options
        );
      }

      return prepareNextRound(executedState, options);
    }

    case "acknowledge_executive_action": {
      assertPhase(state, "resolve_executive_power");
      const pendingAction = state.pendingExecutiveAction;
      assert(
        pendingAction?.presidentId === command.presidentId,
        "대통령만 행정 조치를 마칠 수 있습니다."
      );

      if (pendingAction.power === "investigate_loyalty") {
        assert(
          pendingAction.investigationResult,
          "조사 결과가 준비되지 않았습니다."
        );
      }

      if (pendingAction.power === "policy_peek") {
        assert(pendingAction.peekedPolicies, "정책 선정 결과가 준비되지 않았습니다.");
      }

      return prepareNextRound(state, options);
    }

    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}
