import { Link } from "react-router-dom";
import { Home } from "lucide-react";
import { useEffect, useState } from "react";
import img1 from "@/assets/auth/auth-1.jpg";
import img2 from "@/assets/auth/auth-2.jpg";
import img3 from "@/assets/auth/auth-3.jpg";
import img4 from "@/assets/auth/auth-4.jpg";
import img5 from "@/assets/auth/auth-5.jpg";

interface AuthLayoutProps {
  children: React.ReactNode;
  sideTitle?: string;
  sideSubtitle?: string;
}

const IMAGES = [img1, img2, img3, img4, img5];
const ROTATE_MS = 6000;

/**
 * Split-screen auth layout.
 * Desktop: image left (50%), form right (50%).
 * Mobile/Tablet: image on top (~30vh), form below.
 */
export function AuthLayout({ children, sideTitle, sideSubtitle }: AuthLayoutProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % IMAGES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-2">
        {/* Image side - top on mobile, left on desktop */}
        <aside className="relative h-[30vh] w-full overflow-hidden bg-muted lg:h-screen lg:sticky lg:top-0">
          {IMAGES.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/15 to-transparent" />

          {/* Home brand button - bottom left */}
          <Link
            to="/"
            aria-label="Home"
            className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition hover:bg-background lg:left-6 lg:top-auto lg:bottom-32"
          >
            <Home className="h-5 w-5" />
          </Link>

          {(sideTitle || sideSubtitle) && (
            <div className="absolute inset-x-0 bottom-0 p-6 text-background lg:p-10">
              {sideTitle && (
                <h2 className="text-xl font-bold leading-tight md:text-3xl lg:text-4xl">
                  {sideTitle}
                </h2>
              )}
              {sideSubtitle && (
                <p className="mt-2 max-w-md text-xs text-background/85 md:text-sm">
                  {sideSubtitle}
                </p>
              )}
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {IMAGES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-background" : "w-1.5 bg-background/50"
                }`}
              />
            ))}
          </div>
        </aside>

        {/* Form side */}
        <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 md:px-12 lg:py-12">
          <div className="mx-auto flex w-full max-w-md flex-1 items-center">
            <div className="w-full">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
