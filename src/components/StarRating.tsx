import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  className?: string;
}

const sizeMap = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" };

export function StarRating({ value, onChange, size = "md", readOnly, className }: StarRatingProps) {
  const interactive = !readOnly && !!onChange;
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} role={interactive ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const Comp = interactive ? "button" : "span";
        return (
          <Comp
            key={n}
            type={interactive ? "button" : undefined}
            onClick={interactive ? () => onChange!(n) : undefined}
            aria-label={interactive ? `${n} star${n > 1 ? "s" : ""}` : undefined}
            className={cn(interactive && "cursor-pointer transition-transform hover:scale-110")}
          >
            <Star
              className={cn(
                sizeMap[size],
                filled ? "fill-accent text-accent" : "text-muted-foreground/40",
              )}
            />
          </Comp>
        );
      })}
    </div>
  );
}
