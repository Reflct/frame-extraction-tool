# Desktop Porting Plan

Our goal is to move this web-based application to a cross-platform Electron desktop application while retaining all styling and features. We'll keep the existing OpenCV.js implementation for image processing while replacing WASM ffmpeg with native ffmpeg for improved video handling performance.

---

## Initial Setup Strategy

### 1. Repository Setup
- Fork the existing repository
- Clone the forked repository locally
- Create a new branch for Electron development:
  ```powershell
  PS> git checkout -b electron-port
  ```

### 2. Project Structure
- Keep the existing Next.js project in the root directory
- Create a new `electron/` directory for Electron-specific code:
  ```
  project/
  ├── src/                  # Existing Next.js source
  ├── public/              # Public assets
  ├── electron/           # New Electron-specific code
  │   ├── main.ts
  │   ├── preload.ts
  │   └── ffmpeg.ts
  └── package.json       # Updated with Electron configs
  ```

### 3. Development Workflow
- Maintain two separate npm scripts for web and desktop:
  ```json:package.json
  {
    "scripts": {
      "dev": "next dev",              # Original web development
      "dev:electron": "electron .",    # Electron development
      "build": "next build",          # Web build
      "build:electron": "electron-builder build"  # Electron build
    }
  }
  ```

### 4. Version Control Strategy
- Use feature branches for specific Electron implementations
- Keep the `main` branch synchronized with the original repository
- Document all Electron-specific changes in a separate changelog

### 5. Testing Approach
- Set up parallel testing environments for web and desktop versions
- Create separate test configurations for Electron-specific features
- Maintain existing web tests unchanged

---

## Phase 1: Project Setup
- Install Electron and electron-builder. You can use Windows PowerShell for all commands. For example:

  PS> npm install --save-dev electron electron-builder

- Create the primary Electron entry point (e.g., main.js or main.ts) and configure it to load your current React/Next.js UI in an Electron BrowserWindow.
- Configure electron-builder in package.json (or electron-builder config file) for cross-platform builds:
  
  PS> npm install --save-dev @types/electron-builder

- During this phase, maintain the existing web-based build for reference. We'll keep redundant code until the Electron file structure and build pipeline are fully established.

**Essential Configuration:**
```json:package.json
{
  "main": "electron/main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder build",
    "postinstall": "electron-builder install-app-deps"
  },
  "build": {
    "appId": "com.sharpframes.app",
    "productName": "Sharp Frames Tool",
    "files": [
      "build/**/*",
      "electron/**/*"
    ],
    "directories": {
      "buildResources": "assets",
      "output": "dist"
    },
    "extraResources": [
      {
        "from": "public/opencv.js",
        "to": "opencv.js"
      }
    ]
  }
}
```

**Security Best Practices:**
```typescript:electron/main.ts
app.on('ready', () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
});
```

---

## Phase 2: Native Library Integration
### Adapt OpenCV.js for Electron
- Ensure OpenCV.js is properly loaded in the Electron renderer process
- Update the existing OpenCV.js implementation to work within Electron's security context
- Configure CSP (Content Security Policy) to allow OpenCV.js to function properly

**Impacted Files and Components:**
- `src/lib/opencvUtils.ts`: Update script loading mechanism for Electron environment
- Update CSP in main process to allow OpenCV.js execution
- Ensure proper error handling for OpenCV.js initialization in Electron context

### Replace WASM ffmpeg with Native ffmpeg
- Install a native build of ffmpeg. Either bundle it alongside the app or instruct users to install ffmpeg on their system. 
- Replace your ffmpeg library calls with child_process usage of ffmpeg directly (e.g., spawning ffmpeg with appropriate arguments).

---

## Phase 3: Code Refactoring and Redundant Code Removal
- Once you confirm that native ffmpeg calls work correctly, begin pruning WASM ffmpeg-related code:
  - Clean up asynchronous code that was only needed to initialize WASM modules.
- Ensure that you do this only after the new native code paths are tested end-to-end, so you don't break the existing functionality prematurely.

**Detailed Refactoring Steps:**
1. **Adapt OpenCV.js for Electron:**
   - Update the `loadOpenCV` function to work within Electron's renderer process
   - Ensure proper path resolution for OpenCV.js script in production builds
   - Add appropriate error handling for OpenCV.js initialization
2. **Clean Up WASM ffmpeg:**
   - Identify and remove all WASM ffmpeg related code in `ffmpeg-core.js` and related modules.
   - Update `ffmpegWasm.ts` to utilize native ffmpeg via child_process instead of WASM.
3. **Test Removal:**
   - After removal, perform thorough testing to ensure that no residual dependencies break the application.

---

## Phase 4: Best Practices and Electron Guidelines
- Follow official Electron security guidelines:
  - Enable contextIsolation.
  - Disable remote module if possible.
  - Serve local resources in production using file:// or a secure local express server if needed.
- Keep performance best practices:
  - Offload CPU-intensive tasks (like CV or ffmpeg) to separate processes or to Python scripts to maintain UI responsiveness.
- Maintain your current styling. Use the same React components and CSS logic within the Electron BrowserWindow.

**Additional Best Practices:**
- **Environment Variables:**
  - Securely manage environment variables using `dotenv` or Electron's built-in capabilities.
- **Error Handling:**
  - Implement robust error handling for IPC communications to gracefully handle failures in native processes.
- **Resource Management:**
  - Ensure that all spawned processes (e.g., Python scripts) are properly terminated to prevent memory leaks.
- **Code Organization:**
  - Structure the main and renderer processes separately, adhering to modular design principles for maintainability.

**OpenCV.js Security Considerations:**
- Configure CSP headers to allow OpenCV.js execution while maintaining security
- Ensure OpenCV.js is loaded from local resources rather than CDN
- Implement proper error boundaries around OpenCV.js operations

**Updated Security Guidelines:**
- Use a strict CSP policy:
  ```typescript:electron/main.ts
  mainWindow.webContents.setCSP({
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'"]
  });
  ```
- Validate deep links using custom protocol
- Use allowlist for external URLs
- Implement proper origin checks for IPC communication

---

## Phase 5: Cross-Platform Distribution
- Leverage electron-builder configurations to target Windows, macOS, and Linux. Example script in package.json:

  "build": "electron-builder --publish never"

- Depending on installed libraries, provide instructions or scripts to ensure cv2 and ffmpeg are available on each platform. For example, distributing a static build of ffmpeg or bundling Python with a virtual environment.

**Detailed Distribution Steps:**
1. **Bundling Native Libraries:**
   - **ffmpeg:**
     - Include pre-built binaries for Windows, macOS, and Linux within the application's resources.
     - Reference these binaries in the build scripts to ensure they're packaged with the app.
   - **Python and cv2:**
     - Consider using tools like `pyinstaller` to bundle Python scripts into executables.
     - Alternatively, instruct users to install Python and necessary packages, providing clear setup instructions.
2. **Electron-Builder Configuration:**
   - Update `electron-builder` settings to include native binaries in the build output.
     ```json:package.json
     {
       "build": {
         "files": [
           "build/**/*",
           "main.js",
           "package.json",
           "path/to/ffmpeg/**/*",
           "public/opencv.js"
         ],
         "extraResources": [
           {
             "from": "path/to/ffmpeg/",
             "to": "ffmpeg/",
             "filter": ["**/*"]
           },
           {
             "from": "public/opencv.js",
             "to": "opencv.js"
           }
         ],
         "mac": {
           "target": "dmg"
         },
         "win": {
           "target": "nsis"
         },
         "linux": {
           "target": ["AppImage", "deb"]
         }
       }
     }
     ```
3. **Platform-Specific Scripts:**
   - Create setup scripts for each OS to handle any post-installation configurations if necessary.

**Platform-Specific Configurations:**
```json:electron-builder.json
{
  "mac": {
    "target": ["dmg", "zip"],
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist"
  },
  "win": {
    "target": ["nsis", "portable"],
    "artifactName": "${productName}-Setup-${version}.${ext}"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "category": "Utility"
  },
  "publish": {
    "provider": "github",
    "releaseType": "release"
  }
}
```

---

## Phase 6: Testing and Validation
- Validate all features:
  - Video ingestion and frame extraction.
  - Image directory processing.
  - Sharpness scoring with cv2.
  - ffmpeg-based video operations.
- Use manual end-to-end testing on all platforms to confirm performance improvements and feature parity.

**Enhanced Testing Procedures:**
1. **Automated Testing:**
   - Implement automated tests for IPC communication using tools like `Spectron` or `Playwright`.
   - Write unit tests for Python scripts to ensure reliability in cv2 operations.
2. **Performance Testing:**
   - Benchmark performance improvements with native libraries compared to the web-based approach.
   - Monitor CPU and memory usage during intensive tasks to ensure optimal performance.
3. **Cross-Platform Verification:**
   - Set up virtual machines or use CI/CD pipelines to test builds on Windows, macOS, and Linux.
   - Verify that all native binaries are correctly bundled and executed on each platform.

---

## Phase 7: Production Build and Deployment
- Finalize build scripts:
  
  PS> npm run build
  PS> npm run release
  
- Provide necessary documentation for installation or usage of the Electron application, including any dependency requirements (Python, ffmpeg, etc.) if not fully bundled.

**Comprehensive Deployment Steps:**
1. **Finalize Build Scripts:**
   - Ensure that all build scripts correctly package native dependencies.
   - Test build scripts across all target platforms to verify consistency.
2. **Documentation:**
   - Create a detailed `README` or user guide outlining installation steps, dependencies, and troubleshooting tips.
   - Include information on how to update or manage native dependencies if required.
3. **Distribution Channels:**
   - Decide on distribution platforms (e.g., GitHub Releases, official website).
   - Set up proper signing for macOS and Windows to prevent security warnings during installation.
4. **Continuous Integration/Continuous Deployment (CI/CD):**
   - Configure CI/CD pipelines to automate builds, tests, and deployments for each platform.
   - Use services like GitHub Actions, Travis CI, or CircleCI to streamline the process.

---

## Key Points
1. Remove only WASM ffmpeg code after confirming the native ffmpeg pipeline
2. Maintain OpenCV.js implementation while ensuring it works properly in Electron
3. Use electron-builder for straightforward, cross-platform builds
4. Carefully test each step to avoid regression from the current web-based solution
5. Ensure proper security configuration for OpenCV.js in Electron context
6. Implement robust IPC communication strategies for ffmpeg operations

This enhanced plan provides a more comprehensive roadmap for transitioning to an Electron-based desktop application, detailing the specific files and components affected by the integration of native libraries and outlining the necessary steps for effective IPC refactoring.

---

## File Changes Overview

### Files to Remove or Significantly Refactor
1. **WASM FFmpeg Related:**
   - `public/ffmpeg-core.js` - Remove completely
   - `public/ffmpeg-core.wasm` - Remove completely
   - `src/lib/ffmpegWasm.ts` - Refactor to use native ffmpeg

2. **Build Configuration:**
   - `next.config.js` - Update for Electron compatibility
   - `package.json` - Add Electron-specific scripts and dependencies

### Files to Refactor (Minor Changes)
1. **OpenCV.js Integration:**
   - `src/lib/opencvUtils.ts` - Update script loading for Electron
   - `public/opencv.js` - Relocate to appropriate resource directory

2. **Core Application Logic:**
   - `src/hooks/use-frame-extraction.ts` - Update ffmpeg calls
   - `src/lib/browserFrameExtraction.ts` - Update video processing logic
   - `src/lib/videoUtils.ts` - Update to use native ffmpeg

3. **New Files to Create:**
   - `electron/main.ts` - Main process entry point
   - `electron/preload.ts` - Preload script for IPC
   - `electron/ffmpeg.ts` - Native ffmpeg integration
   - `electron/builder.json` - Electron builder configuration

### Files to Preserve (Minimal/No Changes)
1. **UI Components:**
   - `src/components/description.tsx`
   - `src/components/frame-analysis.tsx`
   - `src/components/frame-analysis-card.tsx`
   - `src/components/frame-preview-dialog.tsx`
   - `src/components/header.tsx`
   - `src/components/main-layout.tsx`
   - `src/components/upload-card.tsx`
   - All UI-related components in `src/components/ui/*`

2. **Core Logic:**
   - `src/lib/imageUtils.ts`
   - `src/lib/frameStorage.ts`
   - `src/utils/frame-selection.ts`

3. **Types and Interfaces:**
   - `src/types/frame.ts`
   - `src/types/frame-extraction.ts`

4. **Styling:**
   - All CSS files
   - Tailwind configuration
   - Theme configuration

### Migration Priority Order
1. Set up basic Electron structure while preserving existing functionality
   - Create main process and preload scripts
   - Set up basic IPC communication channels
   - Ensure the app loads and runs in Electron
   - Configure proper security settings:
     ```typescript:electron/preload.ts
     import { contextBridge, ipcRenderer } from 'electron'
     
     contextBridge.exposeInMainWorld('electronAPI', {
       processVideo: (file: File) => ipcRenderer.invoke('process-video', file),
       extractFrames: (options: any) => ipcRenderer.invoke('extract-frames', options),
       // Add other API endpoints as needed
     })
     ```

2. Implement core IPC infrastructure
   - Define IPC interfaces for video processing
   - Set up error handling and logging
   - Create test harness for IPC communication

3. Replace WASM ffmpeg with native implementation
   - Implement ffmpeg operations through IPC
   - Test video processing end-to-end
   - Validate performance improvements

4. Adapt OpenCV.js loading for Electron
   - Update script loading mechanism
   - Test image processing features

5. Update build configuration
   - Configure electron-builder
   - Set up development and production builds

6. Final testing and optimization
   - Cross-platform testing
   - Performance optimization
   - User experience validation

