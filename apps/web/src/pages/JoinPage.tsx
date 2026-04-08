import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { joinRoom } from "@/lib/api";
import { getLastNickname, setLastNickname, setPlayerToken } from "@/lib/storage";

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState(searchParams.get("room") ?? "");
  const [nickname, setNickname] = useState(getLastNickname());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedRoomCode = useMemo(() => roomCode.trim().toUpperCase(), [roomCode]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const joined = await joinRoom(normalizedRoomCode, nickname.trim());
      setPlayerToken(joined.roomId, joined.playerToken);
      setLastNickname(nickname.trim());
      navigate(`/p/${joined.playerToken}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "참가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="join-page">
      <form className="join-card" onSubmit={handleSubmit}>
        <h1>플레이어 참가</h1>
        <label>
          <span>방 코드</span>
          <input
            autoCapitalize="characters"
            inputMode="text"
            maxLength={5}
            onChange={(event) => setRoomCode(event.target.value)}
            value={roomCode}
          />
        </label>
        <label>
          <span>닉네임</span>
          <input
            maxLength={32}
            onChange={(event) => setNickname(event.target.value)}
            value={nickname}
          />
        </label>
        <button disabled={isSubmitting} type="submit">
          {isSubmitting ? "참가 중..." : "로비 참가"}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </main>
  );
}
