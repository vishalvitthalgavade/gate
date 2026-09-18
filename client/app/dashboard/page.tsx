"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Welcome back, {user.name}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Dashboard functionality will be implemented in Phase 3. For now, this is a protected
          route demonstrating that authentication is working.
        </p>
        <div className="mt-4 rounded-md bg-muted p-4">
          <p className="text-xs font-mono text-muted-foreground">
            User ID: {user.id}
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            Email: {user.email}
          </p>
        </div>
      </div>
    </main>
  );
}
