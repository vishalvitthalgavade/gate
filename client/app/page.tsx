import Link from "next/link";
import { ApiStatus } from "@/components/api-status";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Phase 2 Complete</p>
      <h1 className="text-4xl font-semibold tracking-tight">GATEFLOW</h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        Personal GATE 2027 study tracker. Authentication is now implemented.
      </p>
      <ApiStatus />
      <div className="flex gap-3">
        <Link href="/auth/login">
          <Button type="button">Sign in</Button>
        </Link>
        <Link href="/auth/register">
          <Button type="button" variant="outline">
            Create account
          </Button>
        </Link>
      </div>
    </main>
  );
}
