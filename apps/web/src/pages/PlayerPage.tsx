import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { PlayerView } from "@secret/game-engine";

import { SpriteCrop } from "@/components/SpriteCrop";
import { claimPlayer } from "@/lib/api";
import { assets, crops } from "@/lib/assets";
import { connectSocket, emitWithAck, sendCommand } from "@/lib/socket";
import { setPlayerToken } from "@/lib/storage";

function ActionButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="action-button" type="button" {...props}>
      {props.children}
    </button>
  );
}

function PolicyCard(props: { policy: "liberal" | "fascist" }) {
  return (
    <SpriteCrop
      alt={props.policy === "liberal" ? "자유 정책" : "파시스트 정책"}
      className="policy-card"
      crop={props.policy === "liberal" ? crops.liberalPolicy : crops.fascistPolicy}
      source={props.policy === "liberal" ? assets.liberalPolicy : assets.fascistPolicy}
    />
  );
}

export function PlayerPage() {
  const params = useParams();
  const playerToken = params.playerToken ?? "";
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleRevealed, setIsRoleRevealed] = useState(false);

  useEffect(() => {
    if (!playerToken) {
      setError("플레이어 토큰이 없습니다.");
      return;
    }

    let isMounted = true;
    const socket = connectSocket();

    const load = async () => {
      try {
        const claimed = await claimPlayer(playerToken);
        if (!isMounted) {
          return;
        }
        setPlayerToken(claimed.roomId, playerToken);
        setView(claimed.playerView);
        await emitWithAck(socket, "player:subscribe", {
          playerToken
        });
      } catch (nextError) {
        if (!isMounted) {
          return;
        }
        setError(nextError instanceof Error ? nextError.message : "플레이어 연결에 실패했습니다.");
      }
    };

    const onUpdate = (payload: PlayerView) => {
      setView(payload);
    };

    const onError = (payload: { message: string }) => {
      setError(payload.message);
    };

    socket.on("player:update", onUpdate);
    socket.on("server:error", onError);
    void load();

    return () => {
      isMounted = false;
      socket.off("player:update", onUpdate);
      socket.off("server:error", onError);
    };
  }, [playerToken]);

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

  const roleSprite = useMemo(() => {
    if (!view?.role) {
      return null;
    }

    if (view.role === "liberal") {
      return (
        <SpriteCrop
          alt="자유당원 역할 카드"
          className="role-card"
          crop={crops.roleLiberal}
          source={assets.roleLiberal}
        />
      );
    }

    if (view.role === "hitler") {
      return (
        <SpriteCrop
          alt="히틀러 역할 카드"
          className="role-card"
          crop={crops.roleHitler}
          source={assets.roles}
        />
      );
    }

    return (
      <SpriteCrop
        alt="파시스트 역할 카드"
        className="role-card"
        crop={crops.roleFascist}
        source={assets.roles}
      />
    );
  }, [view?.role]);

  if (!view) {
    return (
      <main className="status-page">
        <p>{error ?? "플레이어 화면을 불러오는 중..."}</p>
      </main>
    );
  }

  const membershipSprite =
    view.partyMembership === "liberal" ? (
      <SpriteCrop
        alt="자유당 멤버십 카드"
        className="membership-card"
        crop={crops.membershipLiberal}
        source={assets.memberships}
      />
    ) : (
      <SpriteCrop
        alt="파시스트 멤버십 카드"
        className="membership-card"
        crop={crops.membershipFascist}
        source={assets.memberships}
      />
    );
  const chancellorAction = view.action.kind === "chancellor_legislate" ? view.action : null;

  return (
    <main className="player-page">
      <header className="player-header">
        <div>
          <p className="eyebrow">PLAYER VIEW</p>
          <h1>{view.nickname}</h1>
          <p>
            방 코드 {view.roomCode} / 라운드 {view.turn}
          </p>
        </div>
        <div className={`phase-chip ${view.isAlive ? "" : "dead"}`}>
          {view.isAlive ? view.publicState.statusText : "사망"}
        </div>
      </header>

      <section className="player-card">
        {(view.phase === "role_reveal" || view.action.kind === "role_reveal") && roleSprite ? (
          <>
            <div className="reveal-toggle-row">
              <button onClick={() => setIsRoleRevealed((current) => !current)} type="button">
                {isRoleRevealed ? "비공개로 가리기" : "역할 공개하기"}
              </button>
            </div>
            {isRoleRevealed ? (
              <>
                {roleSprite}
                {membershipSprite}
                {view.teamKnowledge.length > 0 ? (
                  <div className="team-knowledge">
                    <h2>당신이 아는 팀 정보</h2>
                    <ul>
                      {view.teamKnowledge.map((entry) => (
                        <li key={entry.playerId}>
                          {entry.nickname} / {entry.role === "hitler" ? "히틀러" : "파시스트"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="muted-text">현재 추가로 공개된 팀 정보가 없습니다.</p>
                )}
              </>
            ) : (
              <div className="concealed-role">
                <p>어깨 너머 노출을 막기 위해 가려진 상태입니다.</p>
              </div>
            )}
            {view.action.kind === "role_reveal" && view.action.canConfirm ? (
              <ActionButton
                disabled={isSubmitting}
                onClick={() => submit({ type: "player:confirm-role-reveal" })}
              >
                역할 확인 완료
              </ActionButton>
            ) : null}
          </>
        ) : null}

        {view.action.kind === "lobby" ? (
          <ActionButton
            disabled={isSubmitting}
            onClick={() =>
              submit({
                type: "player:set-ready",
                ready: !view.publicState.players.find((player) => player.id === view.playerId)?.isReady
              })
            }
          >
            준비 상태 토글
          </ActionButton>
        ) : null}

        {view.action.kind === "nominate_chancellor" ? (
          <div className="action-grid">
            {view.action.eligibleCandidateIds.map((candidateId) => {
              const candidate = view.publicState.players.find((player) => player.id === candidateId);
              return (
                <ActionButton
                  key={candidateId}
                  disabled={isSubmitting}
                  onClick={() =>
                    submit({
                      type: "president:nominate-chancellor",
                      candidateId
                    })
                  }
                >
                  {candidate?.nickname ?? candidateId}
                </ActionButton>
              );
            })}
          </div>
        ) : null}

        {view.action.kind === "vote" ? (
          <div className="vote-grid">
            <button
              className="vote-card-button"
              disabled={isSubmitting || view.action.hasSubmitted}
              onClick={() => submit({ type: "player:cast-vote", vote: "ja" })}
              type="button"
            >
              <SpriteCrop alt="Ja 투표 카드" crop={crops.voteJa} source={assets.voteJa} />
            </button>
            <button
              className="vote-card-button"
              disabled={isSubmitting || view.action.hasSubmitted}
              onClick={() => submit({ type: "player:cast-vote", vote: "nein" })}
              type="button"
            >
              <SpriteCrop alt="Nein 투표 카드" crop={crops.voteNein} source={assets.voteNein} />
            </button>
          </div>
        ) : null}

        {view.action.kind === "president_draw" ? (
          <>
            <div className="policy-row">
              {view.action.cards.map((policy, index) => (
                <PolicyCard key={`${policy}-${index}`} policy={policy} />
              ))}
            </div>
            <ActionButton
              disabled={isSubmitting}
              onClick={() => submit({ type: "president:reveal-draw" })}
            >
              카드 확인 후 폐기 고르기
            </ActionButton>
          </>
        ) : null}

        {view.action.kind === "president_discard" ? (
          <div className="policy-row">
            {view.action.cards.map((policy, index) => (
              <button
                key={`${policy}-${index}`}
                className="policy-choice-button"
                disabled={isSubmitting}
                onClick={() =>
                  submit({
                    type: "president:discard-policy",
                    policyIndex: index
                  })
                }
                type="button"
              >
                <PolicyCard policy={policy} />
                <span>이 카드를 폐기</span>
              </button>
            ))}
          </div>
        ) : null}

        {chancellorAction ? (
          <>
            <div className="policy-row">
              {chancellorAction.cards.map((policy, index) => (
                <button
                  key={`${policy}-${index}`}
                  className="policy-choice-button"
                  disabled={isSubmitting || chancellorAction.waitingOnPresident}
                  onClick={() =>
                    submit({
                      type: "chancellor:enact-policy",
                      policyIndex: index
                    })
                  }
                  type="button"
                >
                  <PolicyCard policy={policy} />
                  <span>이 정책 시행</span>
                </button>
              ))}
            </div>
            {chancellorAction.canRequestVeto ? (
              <ActionButton
                disabled={isSubmitting || chancellorAction.waitingOnPresident}
                onClick={() => submit({ type: "chancellor:request-veto" })}
              >
                {chancellorAction.vetoRequested ? "베토 응답 대기 중" : "베토 요청"}
              </ActionButton>
            ) : null}
          </>
        ) : null}

        {view.action.kind === "president_veto_response" ? (
          <>
            <div className="policy-row">
              {view.action.cards.map((policy, index) => (
                <PolicyCard key={`${policy}-${index}`} policy={policy} />
              ))}
            </div>
            <p className="result-panel">수상이 베토를 요청했습니다. 대통령이 수락 또는 거부를 선택합니다.</p>
            <div className="action-grid">
              <ActionButton
                disabled={isSubmitting}
                onClick={() => submit({ type: "president:respond-veto", accept: true })}
              >
                베토 수락
              </ActionButton>
              <ActionButton
                disabled={isSubmitting}
                onClick={() => submit({ type: "president:respond-veto", accept: false })}
              >
                베토 거부
              </ActionButton>
            </div>
          </>
        ) : null}

        {view.action.kind === "investigate" ? (
          <>
            {view.action.result ? (
              <>
                <p className="result-panel">
                  조사 결과: {view.action.result === "fascist" ? "파시스트 멤버십" : "자유당 멤버십"}
                </p>
                <ActionButton
                  disabled={isSubmitting}
                  onClick={() => submit({ type: "president:acknowledge-executive-action" })}
                >
                  결과 확인 완료
                </ActionButton>
              </>
            ) : (
              <div className="action-grid">
                {view.action.eligibleTargetIds.map((targetId) => {
                  const target = view.publicState.players.find((player) => player.id === targetId);
                  return (
                    <ActionButton
                      key={targetId}
                      disabled={isSubmitting}
                      onClick={() =>
                        submit({
                          type: "president:investigate",
                          targetId
                        })
                      }
                    >
                      {target?.nickname ?? targetId}
                    </ActionButton>
                  );
                })}
              </div>
            )}
          </>
        ) : null}

        {view.action.kind === "special_election" ? (
          <div className="action-grid">
            {view.action.eligibleTargetIds.map((targetId) => {
              const target = view.publicState.players.find((player) => player.id === targetId);
              return (
                <ActionButton
                  key={targetId}
                  disabled={isSubmitting}
                  onClick={() =>
                    submit({
                      type: "president:special-election",
                      targetId
                    })
                  }
                >
                  {target?.nickname ?? targetId}
                </ActionButton>
              );
            })}
          </div>
        ) : null}

        {view.action.kind === "execution" ? (
          <div className="action-grid">
            {view.action.eligibleTargetIds.map((targetId) => {
              const target = view.publicState.players.find((player) => player.id === targetId);
              return (
                <ActionButton
                  key={targetId}
                  disabled={isSubmitting}
                  onClick={() =>
                    submit({
                      type: "president:execute",
                      targetId
                    })
                  }
                >
                  {target?.nickname ?? targetId}
                </ActionButton>
              );
            })}
          </div>
        ) : null}

        {view.action.kind === "policy_peek" ? (
          <>
            <div className="policy-row">
              {view.action.cards.map((policy, index) => (
                <PolicyCard key={`${policy}-${index}`} policy={policy} />
              ))}
            </div>
            <ActionButton
              disabled={isSubmitting}
              onClick={() => submit({ type: "president:acknowledge-executive-action" })}
            >
              정책 순서 확인 완료
            </ActionButton>
          </>
        ) : null}

        {view.action.kind === "dead" ? (
          <div className="dead-panel">
            <p>당신은 처형되었습니다. 더 이상 투표나 행동을 할 수 없습니다.</p>
          </div>
        ) : null}

        {view.action.kind === "waiting" ? (
          <div className="waiting-panel">
            <p>{view.action.message}</p>
          </div>
        ) : null}
      </section>

      <section className="player-public-panel">
        <h2>공개 정보</h2>
        <ul className="player-public-list">
          {view.publicState.players.map((player) => (
            <li key={player.id}>
              <strong>{player.nickname}</strong>
              <span>{player.isAlive ? "생존" : "사망"}</span>
            </li>
          ))}
        </ul>
      </section>

      {error ? <p className="error-text player-error">{error}</p> : null}
    </main>
  );
}
