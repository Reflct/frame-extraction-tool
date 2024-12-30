'use client';

import { Header } from '@/components/header';
import { Description } from '@/components/description';

interface MainLayoutProps {
  frameCount: number;
  selectedFrameCount: number;
  onDownloadAction: () => void;
  children: React.ReactNode;
}

export function MainLayout({
  frameCount,
  selectedFrameCount,
  onDownloadAction,
  children
}: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-[#E0E0E0]">
      <div className="container mx-auto space-y-4 relative pb-20">
        <Header 
          frameCount={frameCount}
          selectedFrameCount={selectedFrameCount}
          onDownloadAction={onDownloadAction}
        />

        {/* Main Content - Adjust padding top to account for new header height */}
        <div className="pt-28 space-y-8">
          <Description />
          {children}
        </div>
      </div>
    </div>
  );
}
