import type { PartyMembership, Role } from "@secret/shared";

import type { RoomState } from "./types.js";

export function getPartyMembership(role: Role): PartyMembership {
  return role === "liberal" ? "liberal" : "fascist";
}

export function getKnownTeam(
  state: RoomState,
  playerId: string
): Array<{
  playerId: string;
  nickname: string;
  role: Role;
  partyMembership: PartyMembership;
}> {
  const self = state.players[playerId];
  if (!self?.role) {
    return [];
  }

  if (self.role === "liberal") {
    return [];
  }

  const aliveOrAll = Object.values(state.players).filter(
    (player) => player.id !== playerId && player.role !== null
  );

  if (state.seatOrder.length <= 6) {
    return aliveOrAll
      .filter((player) => player.role === "fascist" || player.role === "hitler")
      .map((player) => ({
        playerId: player.id,
        nickname: player.nickname,
        role: player.role as Role,
        partyMembership: getPartyMembership(player.role as Role)
      }));
  }

  if (self.role === "hitler") {
    return [];
  }

  return aliveOrAll
    .filter((player) => player.role === "fascist" || player.role === "hitler")
    .map((player) => ({
      playerId: player.id,
      nickname: player.nickname,
      role: player.role as Role,
      partyMembership: getPartyMembership(player.role as Role)
    }));
}
