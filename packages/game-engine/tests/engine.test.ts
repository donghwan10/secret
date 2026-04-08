import { describe, expect, it } from "vitest";

import { getHostView, getPlayerView } from "../src/projections.js";
import { applyCommand, createRoomState } from "../src/reducer.js";
import { getEligibleChancellorIds } from "../src/utils.js";
import type { RoomState } from "../src/types.js";
import type { Policy, Role } from "@secret/shared";

function buildRoom(playerCount: number): RoomState {
  let state = createRoomState({
    roomId: "room-1",
    roomCode: "ABCD",
    createdAt: "2026-04-08T00:00:00.000Z"
  });

  for (let index = 0; index < playerCount; index += 1) {
    state = applyCommand(state, {
      type: "add_player",
      playerId: `p${index + 1}`,
      nickname: `플레이어 ${index + 1}`
    });
  }

  return state;
}

function withRoles(state: RoomState, roles: Role[]): RoomState {
  const players = { ...state.players };
  state.seatOrder.forEach((playerId, index) => {
    const existing = players[playerId];
    if (!existing) {
      throw new Error(`missing player ${playerId}`);
    }
    players[playerId] = {
      ...existing,
      role: roles[index] ?? null,
      isAlive: true
    };
  });

  return {
    ...state,
    players
  };
}

function setDeck(state: RoomState, drawPile: Policy[], discardPile: Policy[] = []): RoomState {
  return {
    ...state,
    drawPile,
    discardPile
  };
}

function toRoleReveal(state: RoomState): RoomState {
  return {
    ...state,
    phase: "role_reveal"
  };
}

function toNomination(state: RoomState, presidentId = "p1"): RoomState {
  return {
    ...state,
    phase: "chancellor_nomination",
    currentPresidentId: presidentId,
    currentRoundType: "regular",
    regularNextPresidentId: presidentId
  };
}

function toVotingOpen(
  state: RoomState,
  presidentId = "p1",
  chancellorId = "p2"
): RoomState {
  return {
    ...state,
    phase: "voting_open",
    currentPresidentId: presidentId,
    nominatedChancellorId: chancellorId,
    currentRoundType: "regular"
  };
}

function voteAll(state: RoomState, vote: "ja" | "nein"): RoomState {
  let nextState = state;
  for (const playerId of nextState.seatOrder) {
    nextState = applyCommand(nextState, {
      type: "cast_vote",
      playerId,
      vote
    });
  }
  return nextState;
}

describe("game engine", () => {
  it("assigns the correct role distribution", () => {
    let state = buildRoom(10);
    state = applyCommand(state, { type: "start_game" }, {
      random: () => 0,
      now: "2026-04-08T00:00:00.000Z"
    });

    const roles = Object.values(state.players).map((player) => player.role);
    expect(roles.filter((role) => role === "liberal")).toHaveLength(6);
    expect(roles.filter((role) => role === "fascist")).toHaveLength(3);
    expect(roles.filter((role) => role === "hitler")).toHaveLength(1);
  });

  it("reveals secret team information differently for 5-6 and 7-10 players", () => {
    const fivePlayerState = withRoles(toRoleReveal(buildRoom(5)), [
      "hitler",
      "fascist",
      "liberal",
      "liberal",
      "liberal"
    ]);
    const sevenPlayerState = withRoles(toRoleReveal(buildRoom(7)), [
      "hitler",
      "fascist",
      "fascist",
      "liberal",
      "liberal",
      "liberal",
      "liberal"
    ]);

    expect(getPlayerView(fivePlayerState, "p1").teamKnowledge.map((entry) => entry.playerId)).toEqual([
      "p2"
    ]);
    expect(getPlayerView(fivePlayerState, "p2").teamKnowledge.map((entry) => entry.playerId)).toEqual([
      "p1"
    ]);

    expect(getPlayerView(sevenPlayerState, "p1").teamKnowledge).toEqual([]);
    expect(getPlayerView(sevenPlayerState, "p2").teamKnowledge.map((entry) => entry.playerId)).toEqual([
      "p1",
      "p3"
    ]);
  });

  it("applies the five-player chancellor eligibility exception", () => {
    const state = {
      ...toNomination(buildRoom(5), "p3"),
      lastElectedGovernment: {
        presidentId: "p1",
        chancellorId: "p2"
      }
    };

    const eligible = getEligibleChancellorIds(state);
    expect(eligible).toContain("p1");
    expect(eligible).not.toContain("p2");
  });

  it("handles election failures and chaos policy enactment", () => {
    let state = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    state = setDeck(
      {
        ...toVotingOpen(state),
        electionTracker: 2
      },
      ["fascist", "liberal", "liberal"]
    );

    state = voteAll(state, "nein");

    expect(state.phase).toBe("voting_reveal");
    expect(state.pendingPolicyResolution?.source).toBe("chaos");
    expect(state.pendingPolicyResolution?.enactedPolicy).toBe("fascist");
    expect(state.electionTracker).toBe(0);
    expect(state.lastElectedGovernment).toEqual({
      presidentId: null,
      chancellorId: null
    });
  });

  it("keeps votes hidden until all living players submit, then reveals every named vote at once", () => {
    let state = toVotingOpen(buildRoom(5), "p1", "p2");

    state = applyCommand(state, {
      type: "cast_vote",
      playerId: "p1",
      vote: "ja"
    });
    state = applyCommand(state, {
      type: "cast_vote",
      playerId: "p2",
      vote: "nein"
    });

    expect(state.phase).toBe("voting_open");
    expect(getHostView(state).revealedVotes).toBeNull();

    state = applyCommand(state, {
      type: "cast_vote",
      playerId: "p3",
      vote: "ja"
    });
    state = applyCommand(state, {
      type: "cast_vote",
      playerId: "p4",
      vote: "nein"
    });
    state = applyCommand(state, {
      type: "cast_vote",
      playerId: "p5",
      vote: "ja"
    });

    expect(state.phase).toBe("voting_reveal");
    expect(getHostView(state).revealedVotes).toEqual([
      { playerId: "p1", nickname: "플레이어 1", vote: "ja" },
      { playerId: "p2", nickname: "플레이어 2", vote: "nein" },
      { playerId: "p3", nickname: "플레이어 3", vote: "ja" },
      { playerId: "p4", nickname: "플레이어 4", vote: "nein" },
      { playerId: "p5", nickname: "플레이어 5", vote: "ja" }
    ]);
    expect(state.publicLog.at(-1)?.message).toContain("플레이어 1 Ja");
    expect(state.publicLog.at(-1)?.message).toContain("플레이어 2 Nein");
    expect(state.publicLog.at(-1)?.message).toContain("Ja 3표, Nein 2표");
  });

  it("awards fascist victory when hitler is elected chancellor after three fascist policies", () => {
    let state = withRoles(buildRoom(5), [
      "liberal",
      "hitler",
      "liberal",
      "liberal",
      "fascist"
    ]);
    state = {
      ...toVotingOpen(state, "p1", "p2"),
      fascistPolicyCount: 3
    };

    state = voteAll(state, "ja");
    state = applyCommand(state, { type: "advance_phase" });
    state = applyCommand(state, { type: "advance_phase" });
    state = applyCommand(state, { type: "advance_phase" });

    expect(state.phase).toBe("game_over");
    expect(state.winner).toEqual({
      winner: "fascists",
      reason: "hitler_elected_chancellor"
    });
  });

  it("publishes that a surviving chancellor is not hitler before legislation begins", () => {
    let state = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "hitler",
      "liberal",
      "fascist"
    ]);
    state = setDeck(
      {
        ...toVotingOpen(state, "p1", "p2"),
        fascistPolicyCount: 3
      },
      ["liberal", "fascist", "liberal", "fascist"]
    );

    state = voteAll(state, "ja");
    state = applyCommand(state, { type: "advance_phase" });
    state = applyCommand(state, { type: "advance_phase" });
    state = applyCommand(state, { type: "advance_phase" });

    expect(state.phase).toBe("president_draw_3");
    expect(state.publicLog.at(-1)?.message).toBe("새 수상은 히틀러가 아닙니다.");
  });

  it("shows hitler as fascist when investigating party membership", () => {
    let state = withRoles(buildRoom(7), [
      "liberal",
      "hitler",
      "fascist",
      "fascist",
      "liberal",
      "liberal",
      "liberal"
    ]);
    state = {
      ...state,
      phase: "resolve_executive_power",
      currentPresidentId: "p3",
      pendingExecutiveAction: {
        power: "investigate_loyalty",
        presidentId: "p3",
        targetId: null,
        investigationResult: null,
        peekedPolicies: null
      }
    };

    state = applyCommand(state, {
      type: "investigate_loyalty",
      presidentId: "p3",
      targetId: "p2"
    });

    expect(state.pendingExecutiveAction?.investigationResult).toBe("fascist");
  });

  it("prevents the same player from being investigated twice", () => {
    let state = withRoles(buildRoom(7), [
      "liberal",
      "hitler",
      "fascist",
      "fascist",
      "liberal",
      "liberal",
      "liberal"
    ]);
    state = {
      ...state,
      phase: "resolve_executive_power",
      currentPresidentId: "p3",
      investigatedPlayerIds: ["p2"],
      pendingExecutiveAction: {
        power: "investigate_loyalty",
        presidentId: "p3",
        targetId: null,
        investigationResult: null,
        peekedPolicies: null
      }
    };

    expect(() =>
      applyCommand(state, {
        type: "investigate_loyalty",
        presidentId: "p3",
        targetId: "p2"
      })
    ).toThrow(/이미 조사한 플레이어/);
  });

  it("returns presidency order correctly after a special election", () => {
    let state = withRoles(buildRoom(7), [
      "liberal",
      "hitler",
      "fascist",
      "fascist",
      "liberal",
      "liberal",
      "liberal"
    ]);
    state = {
      ...state,
      phase: "resolve_executive_power",
      currentPresidentId: "p1",
      currentRoundType: "regular",
      regularNextPresidentId: "p1",
      pendingExecutiveAction: {
        power: "special_election",
        presidentId: "p1",
        targetId: null,
        investigationResult: null,
        peekedPolicies: null
      }
    };

    state = applyCommand(state, {
      type: "special_election",
      presidentId: "p1",
      targetId: "p5"
    });
    expect(state.phase).toBe("next_round");
    expect(state.specialElection?.forcedPresidentId).toBe("p5");
    expect(state.regularNextPresidentId).toBe("p2");

    state = applyCommand(state, { type: "advance_phase" });
    expect(state.currentPresidentId).toBe("p5");

    state = applyCommand(state, { type: "advance_phase" });
    state = applyCommand(state, {
      type: "nominate_chancellor",
      presidentId: "p5",
      candidateId: "p1"
    });
    state = voteAll(state, "nein");
    state = applyCommand(state, { type: "advance_phase" });
    state = applyCommand(state, { type: "advance_phase" });

    expect(state.currentPresidentId).toBe("p2");
  });

  it("peeks the top three policies without changing order", () => {
    let state = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    state = setDeck(
      {
        ...state,
        phase: "enact_policy",
        currentPresidentId: "p1",
        fascistPolicyCount: 3,
        pendingPolicyResolution: {
          source: "government",
          enactedPolicy: "fascist",
          triggeredPower: "policy_peek"
        }
      },
      ["liberal", "fascist", "fascist", "liberal"]
    );

    state = applyCommand(state, { type: "advance_phase" });

    expect(state.phase).toBe("resolve_executive_power");
    expect(state.pendingExecutiveAction?.peekedPolicies).toEqual([
      "liberal",
      "fascist",
      "fascist"
    ]);
    expect(state.drawPile.slice(0, 3)).toEqual(["liberal", "fascist", "fascist"]);
  });

  it("handles execution and hitler execution victory", () => {
    let nonHitlerState = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    nonHitlerState = {
      ...nonHitlerState,
      phase: "resolve_executive_power",
      currentPresidentId: "p1",
      currentRoundType: "regular",
      pendingExecutiveAction: {
        power: "execution",
        presidentId: "p1",
        targetId: null,
        investigationResult: null,
        peekedPolicies: null
      }
    };

    nonHitlerState = applyCommand(nonHitlerState, {
      type: "execute_player",
      presidentId: "p1",
      targetId: "p4"
    });

    expect(nonHitlerState.players.p4?.isAlive).toBe(false);
    expect(nonHitlerState.phase).toBe("next_round");

    let hitlerState = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    hitlerState = {
      ...hitlerState,
      phase: "resolve_executive_power",
      currentPresidentId: "p1",
      pendingExecutiveAction: {
        power: "execution",
        presidentId: "p1",
        targetId: null,
        investigationResult: null,
        peekedPolicies: null
      }
    };

    hitlerState = applyCommand(hitlerState, {
      type: "execute_player",
      presidentId: "p1",
      targetId: "p5"
    });

    expect(hitlerState.phase).toBe("game_over");
    expect(hitlerState.winner).toEqual({
      winner: "liberals",
      reason: "hitler_executed"
    });
  });

  it("supports veto acceptance and rejection", () => {
    let rejectState = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    rejectState = {
      ...rejectState,
      phase: "chancellor_chooses_1_or_veto",
      currentPresidentId: "p1",
      currentChancellorId: "p2",
      fascistPolicyCount: 5,
      pendingLegislativeSession: {
        presidentId: "p1",
        chancellorId: "p2",
        drawnCards: ["fascist", "liberal", "fascist"],
        cardsForChancellor: ["fascist", "liberal"],
        vetoRequested: true
      }
    };

    rejectState = applyCommand(rejectState, {
      type: "president_respond_veto",
      presidentId: "p1",
      accept: false
    });

    expect(rejectState.pendingLegislativeSession?.vetoRequested).toBe(false);
    expect(rejectState.phase).toBe("chancellor_chooses_1_or_veto");

    let acceptState = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    acceptState = {
      ...acceptState,
      phase: "chancellor_chooses_1_or_veto",
      currentPresidentId: "p1",
      currentChancellorId: "p2",
      currentRoundType: "regular",
      fascistPolicyCount: 5,
      electionTracker: 1,
      pendingLegislativeSession: {
        presidentId: "p1",
        chancellorId: "p2",
        drawnCards: ["fascist", "liberal", "fascist"],
        cardsForChancellor: ["fascist", "liberal"],
        vetoRequested: true
      }
    };

    acceptState = applyCommand(acceptState, {
      type: "president_respond_veto",
      presidentId: "p1",
      accept: true
    });

    expect(acceptState.phase).toBe("next_round");
    expect(acceptState.electionTracker).toBe(2);
    expect(acceptState.discardPile).toEqual(["fascist", "liberal"]);
  });

  it("reshuffles the discard pile when fewer than three policy cards remain", () => {
    let state = withRoles(buildRoom(5), [
      "liberal",
      "liberal",
      "liberal",
      "fascist",
      "hitler"
    ]);
    state = setDeck(
      {
        ...state,
        phase: "government_formed",
        currentPresidentId: "p1",
        currentChancellorId: "p2"
      },
      ["liberal", "fascist"],
      ["fascist", "liberal", "fascist"]
    );

    state = applyCommand(state, { type: "advance_phase" }, { random: () => 0 });

    expect(state.phase).toBe("president_draw_3");
    expect(state.pendingLegislativeSession?.drawnCards).toHaveLength(3);
    expect(state.discardPile).toEqual([]);
  });

  it("locks dead players out of gameplay actions", () => {
    const baseState = buildRoom(5);
    const deadPlayer = baseState.players.p3;
    if (!deadPlayer) {
      throw new Error("missing p3");
    }
    const state = {
      ...toVotingOpen(baseState),
      players: {
        ...baseState.players,
        p3: {
          ...deadPlayer,
          isAlive: false
        }
      }
    };

    expect(() =>
      applyCommand(state, {
        type: "cast_vote",
        playerId: "p3",
        vote: "ja"
      })
    ).toThrow(/탈락한 플레이어/);
  });

  it("keeps public and private state separated", () => {
    let state = withRoles(buildRoom(5), [
      "hitler",
      "fascist",
      "liberal",
      "liberal",
      "liberal"
    ]);
    state = {
      ...state,
      phase: "president_discards_1",
      currentPresidentId: "p1",
      currentChancellorId: "p2",
      pendingLegislativeSession: {
        presidentId: "p1",
        chancellorId: "p2",
        drawnCards: ["fascist", "liberal", "fascist"],
        cardsForChancellor: null,
        vetoRequested: false
      }
    };

    const hostView = getHostView(state);
    const playerView = getPlayerView(state, "p1");
    const hostJson = JSON.stringify(hostView);
    const playerJson = JSON.stringify(playerView);

    expect(hostJson).not.toContain("hitler");
    expect(hostJson).not.toContain("drawnCards");
    expect(hostJson).not.toContain("fascist,liberal,fascist");

    expect(playerJson).toContain("hitler");
    expect(playerView.action.kind).toBe("president_discard");
  });

  it("shows the nominated chancellor in public state before the vote resolves", () => {
    const state = {
      ...toVotingOpen(buildRoom(5), "p1", "p4")
    };

    const hostView = getHostView(state);
    expect(hostView.currentGovernment.presidentName).toBe("플레이어 1");
    expect(hostView.currentGovernment.chancellorName).toBe("플레이어 4");
  });
});
