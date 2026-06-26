"use client";

import ProfileHeader from "@/components/ProfileHeader";

export default function CandidateProfilePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ProfileHeader pdfUrl="/pdfs/candidate.pdf" onRunSync={() => {}} />
    </div>
  );
}