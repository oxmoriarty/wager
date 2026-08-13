import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-24">
      <Card className="w-full max-w-md items-center text-center">
        <CardTitle className="text-2xl">Page not found</CardTitle>
        <CardDescription>
          That page doesn&apos;t exist, or the account has been removed.
        </CardDescription>
        <CardContent className="w-full">
          <Button className="w-full" asChild>
            <Link href="/">Back to Wager</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
