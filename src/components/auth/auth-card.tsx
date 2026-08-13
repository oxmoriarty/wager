import type { ReactNode } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="text-foreground mb-8 block text-center text-lg font-semibold tracking-tight"
        >
          Wager
        </Link>
        <Card className="gap-6">
          <div className="flex flex-col gap-1.5 text-center">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <CardContent className="gap-6 p-0">{children}</CardContent>
          {footer && (
            <div className="text-muted-foreground text-center text-sm">
              {footer}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
