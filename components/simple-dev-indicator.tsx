"use client";

import { useEffect, useState } from "react";

export function SimpleDevIndicator() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show in development and after component has mounted
  if (process.env.NODE_ENV === "production" || !mounted) return null;

  return (
    <div className="fixed bottom-2 left-2 z-[9999] rounded bg-black/80 px-2 py-1 font-mono text-xs text-white backdrop-blur">
      DEV
    </div>
  );
}