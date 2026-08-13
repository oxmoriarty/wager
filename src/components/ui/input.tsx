import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input text-foreground placeholder:text-muted-foreground flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
