import type { HostView } from "@secret/game-engine";

import { assets, crops } from "@/lib/assets";
import { SpriteCrop } from "./SpriteCrop";

const powerLabels: Record<string, string> = {
  none: "없음",
  investigate_loyalty: "충성심 조사",
  special_election: "특수 선거",
  policy_peek: "정책 확인",
  execution: "처형"
};

interface HostBoardProps {
  view: HostView;
}

function BoardPolicyMarker(props: {
  policy: "liberal" | "fascist";
  filled: boolean;
  index: number;
}) {
  if (!props.filled) {
    return (
      <div
        aria-label={`${props.index + 1}번 정책 슬롯 비어 있음`}
        className="board-policy-marker empty"
      />
    );
  }

  return (
    <SpriteCrop
      alt={`${props.index + 1}번 ${
        props.policy === "liberal" ? "자유" : "파시스트"
      } 정책`}
      className="board-policy-marker"
      crop={props.policy === "liberal" ? crops.liberalPolicy : crops.fascistPolicy}
      source={props.policy === "liberal" ? assets.liberalPolicy : assets.fascistPolicy}
    />
  );
}

function BoardSheet(props: {
  title: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  policy: "liberal" | "fascist";
  filled: number;
  total: number;
  powers?: readonly string[];
}) {
  return (
    <section className={`print-board-sheet ${props.policy}`}>
      <div className="print-board-header">
        <h2>{props.title}</h2>
        <strong>
          {props.filled}/{props.total}
        </strong>
      </div>
      <img
        alt={`${props.title} 보드`}
        className="print-board-image"
        height={props.imageHeight}
        src={props.image}
        width={props.imageWidth}
      />
      <div className="board-policy-strip">
        {Array.from({ length: props.total }).map((_, index) => (
          <BoardPolicyMarker
            key={`${props.policy}-${index}`}
            filled={index < props.filled}
            index={index}
            policy={props.policy}
          />
        ))}
      </div>
      {props.powers ? (
        <ol className="board-power-strip">
          {props.powers.map((power, index) => (
            <li key={`${power}-${index}`} className={index < props.filled ? "active" : ""}>
              <span>{index + 1}</span>
              <strong>{powerLabels[power] ?? power}</strong>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function HostBoard({ view }: HostBoardProps) {
  const fascistBoard =
    view.players.length <= 6
      ? assets.fascistBoard56
      : view.players.length <= 8
        ? assets.fascistBoard78
        : assets.fascistBoard910;

  return (
    <section className="host-board">
      <BoardSheet
        filled={view.liberalPolicyCount}
        image={assets.liberalBoard.src}
        imageHeight={assets.liberalBoard.height}
        imageWidth={assets.liberalBoard.width}
        policy="liberal"
        title="자유당 보드"
        total={5}
      />
      <BoardSheet
        filled={view.fascistPolicyCount}
        image={fascistBoard.src}
        imageHeight={fascistBoard.height}
        imageWidth={fascistBoard.width}
        policy="fascist"
        powers={view.fascistTrack}
        title="파시스트 보드"
        total={6}
      />
      <section className="tracker-panel">
        <div className="tracker-title">선거 추적기</div>
        <div className="tracker-dots">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`tracker-dot ${index < view.electionTracker ? "active" : ""}`}
            />
          ))}
        </div>
      </section>
    </section>
  );
}
