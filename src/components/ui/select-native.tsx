import * as React from "react";

import { cn } from "@/lib/utils";

function SelectNative({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select-native"
      className={cn(
        "border-input text-foreground flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { SelectNative };
