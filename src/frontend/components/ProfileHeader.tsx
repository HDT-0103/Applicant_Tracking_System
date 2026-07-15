import { useState } from 'react';

interface ProfileHeaderProps {
  pdfUrl: string;
  onRunSync: () => void;
}

export default function ProfileHeader({ pdfUrl, onRunSync }: ProfileHeaderProps) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRunSync = async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      await Promise.resolve(onRunSync());
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        {/* PDF Embed */}
        <iframe
          src={pdfUrl}
          className="w-full h-96 rounded-md border border-background"
          title="Candidate Resume PDF"
        />
        <button
          type="button"
          className="mt-4 w-full rounded-md bg-[#1B62F0] px-4 py-2 text-sm font-medium text-white hover:bg-[#1653cc] disabled:cursor-not-allowed disabled:opacity-70"
          onClick={handleRunSync}
          disabled={isRunning}
        >
          {isRunning ? 'Running…' : 'Run Sync'}
        </button>
      </div>
    </div>
  );
}