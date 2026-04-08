export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

export const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const;

export const GAME_PHASES = [
  "lobby",
  "game_setup",
  "role_reveal",
  "president_rotation",
  "chancellor_nomination",
  "voting_open",
  "voting_reveal",
  "government_formed",
  "hitler_chancellor_check",
  "president_draw_3",
  "president_discards_1",
  "chancellor_chooses_1_or_veto",
  "enact_policy",
  "resolve_executive_power",
  "next_round",
  "game_over"
] as const;

export const ROLES = ["liberal", "fascist", "hitler"] as const;
export const PARTY_MEMBERSHIPS = ["liberal", "fascist"] as const;
export const POLICIES = ["liberal", "fascist"] as const;
export const VOTES = ["ja", "nein"] as const;

export const EXECUTIVE_POWERS = [
  "none",
  "investigate_loyalty",
  "special_election",
  "policy_peek",
  "execution"
] as const;

export const WINNERS = ["liberals", "fascists"] as const;
export const GAME_OVER_REASONS = [
  "liberal_policy_track",
  "fascist_policy_track",
  "hitler_elected_chancellor",
  "hitler_executed"
] as const;

export const PUBLIC_LOG_KINDS = [
  "room_created",
  "player_joined",
  "seat_order_updated",
  "game_started",
  "role_reveal_complete",
  "nomination_made",
  "votes_revealed",
  "government_formed",
  "government_rejected",
  "chaos_policy_enacted",
  "policy_enacted",
  "investigation_completed",
  "special_election_called",
  "execution_completed",
  "veto_requested",
  "veto_rejected",
  "veto_accepted",
  "game_over"
] as const;

export const ROLE_DISTRIBUTION = {
  5: { liberal: 3, fascist: 1, hitler: 1 },
  6: { liberal: 4, fascist: 1, hitler: 1 },
  7: { liberal: 4, fascist: 2, hitler: 1 },
  8: { liberal: 5, fascist: 2, hitler: 1 },
  9: { liberal: 5, fascist: 3, hitler: 1 },
  10: { liberal: 6, fascist: 3, hitler: 1 }
} as const;

export const POLICY_DECK_COUNTS = {
  liberal: 6,
  fascist: 11
} as const;

export const FASCIST_EXECUTIVE_TRACK = {
  5: ["none", "none", "policy_peek", "execution", "execution"],
  6: ["none", "none", "policy_peek", "execution", "execution"],
  7: [
    "none",
    "investigate_loyalty",
    "special_election",
    "execution",
    "execution"
  ],
  8: [
    "none",
    "investigate_loyalty",
    "special_election",
    "execution",
    "execution"
  ],
  9: [
    "investigate_loyalty",
    "investigate_loyalty",
    "special_election",
    "execution",
    "execution"
  ],
  10: [
    "investigate_loyalty",
    "investigate_loyalty",
    "special_election",
    "execution",
    "execution"
  ]
} as const;
