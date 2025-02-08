_Unlike Reflct.app, this project was primarily built using AI coding tools. There may be some repetition or inconsistency in the code._

# Frame Extractor

A powerful web-based tool for extracting and analyzing frames from video files, or existing image datasets. Built with Next.js, OpenCV.js, and FFMPEG.wasm.

## Features

- Extract frames from video files directly in your browser
- Advanced frame analysis with OpenCV.js
- Fast web based frame extraction with native video element
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
- **Video Processing**: FFMPEG.wasm, native video element + canvas
- **Image Processing**: OpenCV.js
- **Storage**: Browser IndexedDB

## License

MIT License
