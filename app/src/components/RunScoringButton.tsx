"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunScoringButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ml/score", { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; updated?: number; error?: string };
      if (!res.ok || !data.ok) {
        setMessage(data.error ?? "Scoring failed.");
        return;
      }
      setMessage(`Scoring finished. Updated ${data.updated ?? 0} shipments.`);
      router.refresh();
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={loading}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
      >
        {loading ? "Running scoring…" : "Run scoring (ML job)"}
      </button>
      {message ? (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{message}</span>
      ) : null}
    </div>
  );
}
