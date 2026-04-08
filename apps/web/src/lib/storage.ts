const HOST_PREFIX = "sh.host.";
const PLAYER_PREFIX = "sh.player.";
const LAST_NICKNAME_KEY = "sh.nickname";

export function getHostToken(roomId: string): string | null {
  return window.localStorage.getItem(`${HOST_PREFIX}${roomId}`);
}

export function setHostToken(roomId: string, hostToken: string): void {
  window.localStorage.setItem(`${HOST_PREFIX}${roomId}`, hostToken);
}

export function getPlayerToken(roomId: string): string | null {
  return window.localStorage.getItem(`${PLAYER_PREFIX}${roomId}`);
}

export function setPlayerToken(roomId: string, playerToken: string): void {
  window.localStorage.setItem(`${PLAYER_PREFIX}${roomId}`, playerToken);
}

export function setLastNickname(nickname: string): void {
  window.localStorage.setItem(LAST_NICKNAME_KEY, nickname);
}

export function getLastNickname(): string {
  return window.localStorage.getItem(LAST_NICKNAME_KEY) ?? "";
}
