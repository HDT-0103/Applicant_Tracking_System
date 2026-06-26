import { useState } from 'react';
import Button from '@/components/ui/button';

interface ProfileHeaderProps {
  pdfUrl: string;
  onRunSync: () => void;
}

export default function ProfileHeader({ pdfUrl, onRunSync }: ProfileHeaderProps) {
  return (
    <div className="p-4">
      <div className="max-w-4xl mx-auto">
        {/* PDF Embed */}
        <iframe
          src={pdfUrl}
          className="w-full h-96 rounded-md border border-background"
          title="Candidate Resume PDF"
        />
        <Button className="mt-4 w-full" onClick={onRunSync}>
          Run Sync
        </Button>
      </div>
    </div>
  );
}