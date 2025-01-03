# Frame Extractor

A powerful web-based tool for extracting and analyzing frames from video files. Built with Next.js, OpenCV.js, and FFMPEG.wasm.

## Features

- Extract frames from video files directly in your browser
- Advanced frame analysis with OpenCV.js
- Fast processing using WebAssembly
- Local browser storage for extracted frames
- Export frames as ZIP archives

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/shrimbly/frame-extractor.git
cd frame-extractor
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI**: Tailwind CSS + Shadcn/ui
- **Video Processing**: FFMPEG.wasm
- **Image Processing**: OpenCV.js
- **Storage**: Browser IndexedDB

## License

MIT License
