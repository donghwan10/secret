import type { CropRect, SpriteSource } from "@/lib/assets";

interface SpriteCropProps {
  source: SpriteSource;
  crop: CropRect;
  className?: string;
  alt: string;
}

export function SpriteCrop({ source, crop, className, alt }: SpriteCropProps) {
  const scaleX = (source.width / crop.width) * 100;
  const scaleY = (source.height / crop.height) * 100;
  const left = -(crop.x / crop.width) * 100;
  const top = -(crop.y / crop.height) * 100;
  const rotate = crop.rotate ?? 0;

  return (
    <div
      aria-label={alt}
      className={className}
      role="img"
      style={{
        aspectRatio: `${crop.width} / ${crop.height}`,
        overflow: "hidden",
        position: "relative"
      }}
    >
      <img
        alt=""
        aria-hidden="true"
        src={source.src}
        style={{
          position: "absolute",
          inset: 0,
          width: `${scaleX}%`,
          height: `${scaleY}%`,
          left: `${left}%`,
          top: `${top}%`,
          maxWidth: "none",
          objectFit: "cover",
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
          transformOrigin: "center"
        }}
      />
    </div>
  );
}
