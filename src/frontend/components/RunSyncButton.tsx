"use client";

import { useRouter } from "next/navigation";

export default function RunSyncButton() {
  const router = useRouter();

  const handleRunSync = () => {
    // Navigate to the AI Agent prompt page
    router.push("/ai-agent-prompt");
  };

  return (
    <button
      onClick={handleRunSync}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Run Sync
    </button>
  );
}