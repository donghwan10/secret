import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SpriteCrop } from "@/components/SpriteCrop";
import { createRoom } from "@/lib/api";
import { assets, crops } from "@/lib/assets";
import { setHostToken } from "@/lib/storage";

export function HomePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const room = await createRoom();
      setHostToken(room.roomId, room.hostToken);
      navigate(`/host/${room.roomId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "방 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="landing-page">
      <section className="landing-card">
        <SpriteCrop
          alt="시크릿 히틀러 로고"
          className="landing-logo"
          crop={crops.coverLogo}
          source={assets.cover}
        />
        <p className="landing-copy">
          하나의 호스트 화면과 각 플레이어의 스마트폰으로 진행하는 LAN 전용 시크릿 히틀러.
        </p>
        <div className="landing-actions">
          <button disabled={isSubmitting} onClick={handleCreateRoom} type="button">
            {isSubmitting ? "방 생성 중..." : "호스트 방 만들기"}
          </button>
          <button onClick={() => navigate("/join")} type="button">
            플레이어로 참가하기
          </button>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </main>
  );
}
