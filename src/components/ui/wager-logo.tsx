import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface WagerLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  priority?: boolean;
}

const SIZE_MAP = {
  sm: "h-6 w-auto",
  md: "h-7 w-auto sm:h-8",
  lg: "h-10 w-auto",
  xl: "h-12 w-auto sm:h-14",
};

export function WagerLogo({
  className,
  size = "md",
  href,
  priority = false,
}: WagerLogoProps) {
  const content = (
    <div className={cn("inline-flex items-center select-none", className)}>
      <Image
        src="/WagerLogo.svg"
        alt="Wager"
        width={140}
        height={52}
        priority={priority}
        className={cn("object-contain transition-transform hover:scale-[1.02]", SIZE_MAP[size])}
      />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
