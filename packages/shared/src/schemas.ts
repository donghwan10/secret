import { z } from "zod";

import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  POLICIES,
  VOTES
} from "./constants.js";

export const voteSchema = z.enum(VOTES);
export const policySchema = z.enum(POLICIES);

export const createRoomRequestSchema = z.object({});

export const createRoomResponseSchema = z.object({
  roomId: z.string().min(1),
  roomCode: z.string().min(4),
  hostToken: z.string().min(1),
  lanOrigin: z.string().url()
});

export const joinRoomRequestSchema = z.object({
  roomCode: z.string().trim().min(4).max(8),
  nickname: z.string().trim().min(1).max(32)
});

export const joinRoomResponseSchema = z.object({
  roomId: z.string().min(1),
  playerId: z.string().min(1),
  playerToken: z.string().min(1)
});

export const claimHostRequestSchema = z.object({
  roomId: z.string().min(1),
  hostToken: z.string().min(1)
});

export const claimPlayerRequestSchema = z.object({
  playerToken: z.string().min(1)
});

export const hostSubscribeSchema = z.object({
  roomId: z.string().min(1),
  hostToken: z.string().min(1)
});

export const playerSubscribeSchema = z.object({
  playerToken: z.string().min(1)
});

export const commandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("player:set-ready"),
    ready: z.boolean()
  }),
  z.object({
    type: z.literal("host:reorder-seats"),
    seatOrder: z.array(z.string().min(1)).min(MIN_PLAYERS).max(MAX_PLAYERS)
  }),
  z.object({
    type: z.literal("host:randomize-seats")
  }),
  z.object({
    type: z.literal("host:set-seat-lock"),
    locked: z.boolean()
  }),
  z.object({
    type: z.literal("host:start-game")
  }),
  z.object({
    type: z.literal("host:advance-phase")
  }),
  z.object({
    type: z.literal("player:confirm-role-reveal")
  }),
  z.object({
    type: z.literal("president:nominate-chancellor"),
    candidateId: z.string().min(1)
  }),
  z.object({
    type: z.literal("player:cast-vote"),
    vote: voteSchema
  }),
  z.object({
    type: z.literal("president:reveal-draw")
  }),
  z.object({
    type: z.literal("president:discard-policy"),
    policyIndex: z.number().int().min(0).max(2)
  }),
  z.object({
    type: z.literal("chancellor:request-veto")
  }),
  z.object({
    type: z.literal("president:respond-veto"),
    accept: z.boolean()
  }),
  z.object({
    type: z.literal("chancellor:enact-policy"),
    policyIndex: z.number().int().min(0).max(1)
  }),
  z.object({
    type: z.literal("president:investigate"),
    targetId: z.string().min(1)
  }),
  z.object({
    type: z.literal("president:special-election"),
    targetId: z.string().min(1)
  }),
  z.object({
    type: z.literal("president:execute"),
    targetId: z.string().min(1)
  }),
  z.object({
    type: z.literal("president:acknowledge-executive-action")
  })
]);

export type Command = z.infer<typeof commandSchema>;
