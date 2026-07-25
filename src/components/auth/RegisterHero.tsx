import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import img1 from "@/assets/auth/interior-1.jpg";
import img2 from "@/assets/auth/interior-2.jpg";
import img3 from "@/assets/auth/interior-3.jpg";
import img4 from "@/assets/auth/interior-4.jpg";

const IMAGES = [img1, img2, img3, img4];
const ROTATE_MS = 5000;

interface Props {
  title?: string;
  subtitle?: string;
}

/**
 * Single-column hero banner for the Register screen.
 * Rotates interior photos and fades softly into the white page below.
 */
export function RegisterHero({ title, subtitle }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % IMAGES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  // Fade the bottom 25% of the banner into the page background.
  const fadeMask =
    "linear-gradient(to bottom, #000 0%, #000 75%, transparent 100%)";

  return (
    <div
      className="relative w-full overflow-hidden bg-background"
      style={{
        WebkitMaskImage: fadeMask,
        maskImage: fadeMask,
      }}
    >
      <div className="relative h-[42vh] min-h-[260px] w-full sm:h-[46vh] md:h-[52vh]">
        {IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            width={1280}
            height={1600}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Darken slightly for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/35 via-foreground/10 to-transparent" />

        <Link
          to="/"
          aria-label="Home"
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition hover:bg-background"
        >
          <Home className="h-5 w-5" />
        </Link>

        {(title || subtitle) && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-background [text-shadow:0_2px_8px_rgba(0,0,0,0.45)]">
            {title && (
              <h2 className="mx-auto max-w-xl text-2xl font-bold leading-tight md:text-4xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mx-auto mt-3 max-w-md text-sm text-background/90 md:text-base">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-1.5">
          {IMAGES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-background" : "w-1.5 bg-background/60"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
