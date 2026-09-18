"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/utils";

type HealthResponse = {
  success: boolean;
  data?: {
    status: string;
    database: "up" | "down";
    examDate: string;
  };
};

export function ApiStatus() {
  const [health, setHealth] = useState<HealthResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${apiUrl}/api/health`)
      .then(async (response) => {
        const body = (await response.json()) as HealthResponse;
        if (!cancelled) {
          setHealth(body.data ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("API is not reachable yet. Start the server with npm run dev:server.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }

  if (!health) {
    return <p className="text-sm text-muted-foreground">Checking API…</p>;
  }

  return (
    <p className="text-sm text-muted-foreground">
      API {health.status} · database {health.database} · exam {health.examDate}
    </p>
  );
}
