import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useParams } from "react-router-dom";
import type { HostView } from "@secret/game-engine";

import { HostBoard } from "@/components/HostBoard";
import { claimHost } from "@/lib/api";
import { connectSocket, emitWithAck, sendCommand } from "@/lib/socket";
import { getHostToken } from "@/lib/storage";

export function HostPage() {
  const params = useParams();
  const roomId = params.roomId ?? "";
  const hostToken = roomId ? getHostToken(roomId) : null;
  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lanOrigin, setLanOrigin] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!roomId || !hostToken) {
      setError("호스트 토큰을 찾을 수 없습니다. 루트 화면에서 방을 다시 생성해 주세요.");
      return;
    }

    let isMounted = true;
    const socket = connectSocket();

    const load = async () => {
      try {
        const claimed = await claimHost(roomId, hostToken);
        if (!isMounted) {
          return;
        }

        setView(claimed.hostView);
        setLanOrigin(claimed.lanOrigin);
        await emitWithAck(socket, "host:subscribe", {
          roomId,
          hostToken
        });
      } catch (nextError) {
        if (!isMounted) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "호스트 연결에 실패했습니다.");
      }
    };

    const onHostUpdate = (payload: HostView) => {
      setView(payload);
    };

    const onError = (payload: { message: string }) => {
      setError(payload.message);
    };

    socket.on("host:update", onHostUpdate);
    socket.on("server:error", onError);
    void load();

    return () => {
      isMounted = false;
      socket.off("host:update", onHostUpdate);
      socket.off("server:error", onError);
    };
  }, [hostToken, roomId]);

  const joinUrl = useMemo(() => {
    if (!view) {
      return "";
    }
    const baseOrigin = lanOrigin || window.location.origin;
    return `${baseOrigin}/join?room=${view.roomCode}`;
  }, [lanOrigin, view]);

  useEffect(() => {
    if (!joinUrl) {
      return;
    }
    void QRCode.toDataURL(joinUrl, {
      width: 220,
      margin: 1
    }).then(setQrCodeUrl);
  }, [joinUrl]);

  const submit = async (command: Parameters<typeof sendCommand>[1]) => {
    const socket = connectSocket();
    setIsSubmitting(true);
    setError(null);
    try {
      await sendCommand(socket, command);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "명령 처리에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!view) {
    return (
      <main className="status-page">
        <p>{error ?? "호스트 화면을 불러오는 중..."}</p>
      </main>
    );
  }

  const moveSeat = async (playerId: string, direction: -1 | 1) => {
    const currentIndex = view.players.findIndex((player) => player.id === playerId);
    if (currentIndex < 0) {
      return;
    }
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= view.players.length) {
      return;
    }
    const nextOrder = view.players.map((player) => player.id);
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex] as string,
      nextOrder[currentIndex] as string
    ];
    await submit({
      type: "host:reorder-seats",
      seatOrder: nextOrder
    });
  };

  return (
    <main className="host-page">
      <header className="host-topbar">
        <div>
          <p className="eyebrow">HOST SCREEN</p>
          <h1>방 코드 {view.roomCode}</h1>
          <p>{view.statusText}</p>
        </div>
        <div className="host-room-meta">
          <div>
            <span>접속 URL</span>
            <strong>{joinUrl}</strong>
          </div>
          {qrCodeUrl ? <img alt="QR 코드" className="qr-code" src={qrCodeUrl} /> : null}
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            type="button"
          >
            전체 화면
          </button>
        </div>
      </header>

      <section className="host-main-grid">
        <div className="host-board-panel">
          <HostBoard view={view} />
          <div className="host-board-actions">
            {view.phase === "lobby" ? (
              <>
                <button
                  disabled={isSubmitting || view.seatLocked}
                  onClick={() => submit({ type: "host:randomize-seats" })}
                  type="button"
                >
                  랜덤 정렬
                </button>
                <button
                  disabled={isSubmitting}
                  onClick={() =>
                    submit({
                      type: "host:set-seat-lock",
                      locked: !view.seatLocked
                    })
                  }
                  type="button"
                >
                  {view.seatLocked ? "좌석 잠금 해제" : "좌석 잠금"}
                </button>
                <button
                  disabled={isSubmitting || view.players.length < 5 || view.players.length > 10}
                  onClick={() => submit({ type: "host:start-game" })}
                  type="button"
                >
                  게임 시작
                </button>
              </>
            ) : null}
            {view.canAdvance ? (
              <button
                className="accent"
                disabled={isSubmitting}
                onClick={() => submit({ type: "host:advance-phase" })}
                type="button"
              >
                다음 단계
              </button>
            ) : null}
          </div>
        </div>

        <aside className="host-sidebar">
          <section className="host-card">
            <h2>현재 정부</h2>
            <dl className="government-summary">
              <div>
                <dt>대통령</dt>
                <dd>{view.currentGovernment.presidentName ?? "미정"}</dd>
              </div>
              <div>
                <dt>수상</dt>
                <dd>{view.currentGovernment.chancellorName ?? "미정"}</dd>
              </div>
            </dl>
            {view.revealedVotes ? (
              <ul className="vote-records">
                {view.revealedVotes.map((record) => (
                  <li key={`${record.playerId}-${record.vote}`}>
                    <strong>{record.nickname}</strong>
                    <span>{record.vote === "ja" ? "Ja" : "Nein"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">최근 공개된 투표가 없습니다.</p>
            )}
          </section>

          <section className="host-card">
            <h2>좌석 순서</h2>
            <ul className="seat-list">
              {view.players.map((player) => (
                <li key={player.id}>
                  <div>
                    <strong>{player.nickname}</strong>
                    <span>
                      {player.isAlive ? "생존" : "사망"} /{" "}
                      {player.isConnected ? "접속 중" : "오프라인"}
                    </span>
                  </div>
                  {view.phase === "lobby" ? (
                    <div className="seat-controls">
                      <button disabled={view.seatLocked} onClick={() => moveSeat(player.id, -1)} type="button">
                        ←
                      </button>
                      <button disabled={view.seatLocked} onClick={() => moveSeat(player.id, 1)} type="button">
                        →
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="host-card">
            <h2>공개 로그</h2>
            <ul className="public-log">
              {[...view.publicLog].reverse().map((entry) => (
                <li key={entry.id}>
                  <strong>{entry.message}</strong>
                  <span>{new Date(entry.createdAt).toLocaleTimeString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </section>

      {error ? <p className="error-text host-error">{error}</p> : null}
    </main>
  );
}
