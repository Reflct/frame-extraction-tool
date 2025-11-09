'use client';

import { AlertCircle } from "lucide-react";

export function Description() {

  return (
    <div className="max-w-3xl pl-7">
      <h1 className="text-[clamp(36px,8vw,64px)] font-medium mb-4 leading-[1.1]">Sharp Frames Tool</h1>
      <p className="text-lg text-gray-700">
        Extract full size frames from your video or analyze images from a directory, with blur detection and smart frame selection 
        designed for 3DGS and NeRF dataset preparation. 
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
        <p className="text-[#4B5563] mt-4 leading-relaxed">
          Use Chrome for best results. To avoid these restrictions, try <a href="https://github.com/Reflct/sharp-frames-python" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">SharpFrames Python</a> or join our <a href="https://discord.gg/rfYNxSw3yx" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">Discord</a> for access to the Windows app (beta).
        </p>
      </div>
    </div>
  );
}
