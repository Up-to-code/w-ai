"use client";

import { useEffect, useState } from "react";

// Simple toast notification system without hydration issues
export function SimpleToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Only render after hydration is complete
  if (!mounted) return null;

  return (
    <div
      id="toast-container"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col-reverse gap-2"
      aria-live="polite"
    >
      {/* Toast messages will be inserted here via JavaScript */}
    </div>
  );
}