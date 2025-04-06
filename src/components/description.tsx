'use client';

import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function Description() {
  const [betaExpanded, setBetaExpanded] = useState(true);

  return (
    <div className="max-w-3xl pl-7">
      <h1 className="text-[clamp(36px,8vw,64px)] font-medium mb-4 leading-[1.1]">Sharp Frames Tool</h1>
      <p className="text-lg text-gray-700">
        Extract full size frames from your video or analyze images from a directory, with blur detection and smart frame selection 
        designed for 3DGS and NeRF dataset preparation. Frame selection 
        inspired by <a href="https://github.com/SharkWipf/nerf_dataset_preprocessing_helper" target="_blank" rel="noopener noreferrer" className="text-[#3190ff]">SharkWipf.</a>
      </p>
      <p className="text-lg text-gray-700 mt-4">All processing happens in your browser, <span className="font-bold">we will never see or store your data.</span></p>
      
      <div className="mt-8 p-6 rounded-[14px] border border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-[#6B7280]" />
          <h2 className="text-lg font-semibold text-[#111214]">Requirements</h2>
        </div>
        <ul className="space-y-4 mb-4">
          <li className="text-[#4B5563] flex items-start group">
            <div className="min-w-[130px] mr-3">
              <span className="font-medium text-[#111214]">Video file size limit</span>
            </div>
            <div className="flex-1">
              <p>~1.9GB - this varies due to browser memory limitations</p>
            </div>
          </li>
          <li className="text-[#4B5563] flex items-start group">
            <div className="min-w-[130px] mr-3">
              <span className="font-medium text-[#111214]">Supported codecs</span>
            </div>
            <div className="flex-1">
              <p className="leading-relaxed">H264, HEVC, VP8, VP9, AV1</p>
            </div>
          </li>
        </ul>
        <p className="text-[#4B5563] leading-relaxed">
          For larger files you will need to chunk the video, or you can convert the video to frames and use the image directory mode. Note that large image datasets will use a lot of memory.
        </p>
      </div>
      
      <div className="mt-4 p-6 rounded-[14px] border border-[#E5E7EB] bg-gradient-to-b from-[#f0f8ff] to-[#e6f0ff] shadow-sm border-[#c2d8ff]">
        <div 
          className="flex items-center gap-2 mb-3 cursor-pointer" 
          onClick={() => setBetaExpanded(!betaExpanded)}
        >
          <span className="px-2 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold">BETA</span>
          <h2 className="text-lg font-semibold text-[#111214] flex-1">Sharp Frames for Windows</h2>
          {betaExpanded ? 
            <ChevronUp className="w-5 h-5 text-[#4B5563]" /> : 
            <ChevronDown className="w-5 h-5 text-[#4B5563]" />
          }
        </div>
        
        {betaExpanded && (
          <>
            <p className="text-[#4B5563] leading-relaxed mb-3">
              Try our new native Windows app with: 
            </p>
            <ul className="space-y-2 mb-4 pl-6 list-disc">
              <li className="text-[#4B5563]">New selection methods</li>
              <li className="text-[#4B5563]">No file size limits</li>
              <li className="text-[#4B5563]">No codec restrictions</li>
              <li className="text-[#4B5563]">10-20x faster processing</li>
            </ul>
            <p className="text-[#4B5563] leading-relaxed">
              Find the latest builds in our <a href="https://discord.gg/rfYNxSw3yx" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">Discord</a>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
