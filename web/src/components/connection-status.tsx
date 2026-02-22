"use client";

import { useEffect, useState } from "react";
import { checkStudioStatus } from "@/lib/api";

export function ConnectionStatus({ token }: { token: string | null }) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const poll = async () => {
      try {
        const { connected } = await checkStudioStatus(token);
        setConnected(connected);
      } catch {
        setConnected(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-2.5 h-2.5 rounded-full ${
          connected ? "bg-green-500" : "bg-gray-500"
        }`}
      />
      <span className="text-muted-foreground">
        {connected ? "Studio connected" : "Waiting for Studio"}
      </span>
    </div>
  );
}
