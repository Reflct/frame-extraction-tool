'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Loader } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
  frameCount: number;
  selectedFrameCount: number;
  isDownloading?: boolean;
  downloadProgress?: number;
  onDownloadAction: () => void;
}

export function Header({ frameCount, selectedFrameCount, isDownloading = false, downloadProgress = 0, onDownloadAction }: HeaderProps) {
  return (
    <div className="fixed top-3 px-7 left-0 right-0 z-50">
      <div className="container mx-auto">
        <Card className="rounded-[1.125rem] bg-white">
          <div className="p-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <a href="https://reflct.app" target="_blank" rel="noopener noreferrer">
                <Image 
                  src="/Full Logo Vector.svg" 
                  alt="Logo" 
                  width={120} 
                  height={32} 
                  className="h-8 w-auto hidden md:block" 
                />
                <Image 
                  src="/Logo Vector.svg" 
                  alt="Logo" 
                  width={32} 
                  height={32} 
                  className="h-8 w-auto md:hidden" 
                />
              </a>
            </div>
            <div className="flex items-center gap-6">
              <a 
                href="https://discord.gg/rfYNxSw3yx" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-dm-mono text-[#111214] text-sm font-medium uppercase leading-[100%] text-edge-cap hidden md:block"
              >
                Discord
              </a>
              <a 
                href="https://reflct.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-dm-mono text-[#111214] text-sm font-medium uppercase leading-[100%] text-edge-cap hidden md:block"
              >
                Reflct.app
              </a>
              <div className="relative">
                <Button
                  onClick={onDownloadAction}
                  disabled={frameCount === 0 || isDownloading}
                  className={`flex h-10 p-3 justify-center items-center gap-1 bg-[#3190ff] hover:bg-[#2170df] transition-all ${
                    frameCount === 0 || isDownloading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isDownloading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span
                    className="font-dm-mono text-white text-sm font-medium uppercase leading-[100%] text-edge-cap"
                  >
                    <span className="hidden md:inline">
                      {isDownloading ? 'Downloading' : 'Download'}{' '}
                    </span>
                    {isDownloading ? (
                      `${downloadProgress}%`
                    ) : (
                      `Frames ${frameCount > 0 && `(${selectedFrameCount})`}`
                    )}
                  </span>
                </Button>
                {isDownloading && downloadProgress > 0 && (
                  <div className="absolute bottom-0 left-0 h-1 bg-[#3190ff] transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
