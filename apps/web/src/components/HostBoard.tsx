import type { HostView } from "@secret/game-engine";

import { assets, crops } from "@/lib/assets";
import { SpriteCrop } from "./SpriteCrop";

const powerLabels: Record<string, string> = {
  none: "없음",
  investigate_loyalty: "조사",
  special_election: "특수 선거",
  policy_peek: "정책 선정",
  execution: "처형"
};

interface HostBoardProps {
  view: HostView;
}

function TrackCells(props: {
  label: string;
  count: number;
  filled: number;
  powers?: readonly string[];
}) {
  return (
    <div className="track-cells">
      <div className="track-label">{props.label}</div>
      <div className="track-grid">
        {Array.from({ length: props.count }).map((_, index) => {
          const filled = index < props.filled;
          const power =
            props.powers && index < props.powers.length
              ? powerLabels[props.powers[index] ?? "none"]
              : index === props.count - 1
                ? "승리"
                : "";

          return (
            <div key={`${props.label}-${index}`} className={`track-cell ${filled ? "filled" : ""}`}>
              <span>{index + 1}</span>
              <small>{power}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HostBoard({ view }: HostBoardProps) {
  const boardAsset =
    view.players.length <= 6
      ? assets.fascistBoard56
      : view.players.length <= 8
        ? assets.fascistBoard78
        : assets.fascistBoard910;
  const boardCrop =
    view.players.length <= 6
      ? crops.fascistBoard56
      : view.players.length <= 8
        ? crops.fascistBoard78
        : crops.fascistBoard910;

  return (
    <section className="host-board">
      <div className="board-track">
        <SpriteCrop
          alt="자유당 보드"
          className="board-art"
          crop={crops.liberalBoard}
          source={assets.liberalBoard}
        />
        <TrackCells count={5} filled={view.liberalPolicyCount} label="자유 정책" />
      </div>
      <div className="tracker-panel">
        <div className="tracker-title">선거 추적기</div>
        <div className="tracker-dots">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`tracker-dot ${index < view.electionTracker ? "active" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="board-track">
        <SpriteCrop
          alt="파시스트 보드"
          className="board-art"
          crop={boardCrop}
          source={boardAsset}
        />
        <TrackCells
          count={6}
          filled={view.fascistPolicyCount}
          label="파시스트 정책"
          powers={view.fascistTrack}
        />
      </div>
    </section>
  );
}
