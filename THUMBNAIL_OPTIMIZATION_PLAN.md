# Thumbnail Loading Optimization Plan

## Problem Statement

The Frame Analysis component has TWO major thumbnail loading issues:

### Issue 1: Bulk Loading (lines 79-111)
- Loads ALL 5,000+ thumbnails on mount
- Only 10-50 selected frames are displayed
- Causes 500MB-1GB memory usage and mount/unmount thrashing

### Issue 2: Chart Hover Loading (lines 122-159)
- Loads thumbnail for EVERY frame user hovers over
- With 5,000 frames, user could trigger thousands of IndexedDB reads
- Each mouse movement across chart loads a new thumbnail
- Creates stuttering/lag during chart interaction
- Thumbnails accumulate in memory without cleanup strategy

## Current Behavior Analysis

```typescript
// Lines 122-159: Hover effect loads thumbnail immediately
useEffect(() => {
  if (!hoveredFrame?.id || thumbnailUrls.has(hoveredFrame.id)) return;
  
  async function loadHoveredThumbnail() {
    // IndexedDB read + URL.createObjectURL for EVERY hover
    const thumbnail = await frameStorage.getFrameThumbnail(frameId);
    const url = URL.createObjectURL(thumbnail);
    setThumbnailUrls(prev => new Map(prev.set(frameId, url)));
  }
  
  loadHoveredThumbnail();
}, [hoveredFrame, thumbnailUrls, frames]); // Fires on every hover change
```

**User Experience:**
- User hovers over chart from left to right
- Hovers over 100 frames in 2 seconds
- Triggers 100 IndexedDB reads + 100 blob URLs created
- Memory grows by ~10-20MB
- Chart tooltip may lag/stutter
- No cleanup of unused thumbnails

## Solution Strategy

### Approach: Smart Cache with Preloading + LRU Eviction

**Key Principles:**
1. **Preload thumbnails in sliding window** around visible chart area
2. **Limit total thumbnails in memory** (e.g., 200 max)
3. **LRU eviction** when cache limit reached
4. **Only load for selected frames** in the grid (solves Issue 1)
5. **Debounced preloading** to avoid excessive requests

## Detailed Implementation

### Step 1: Create Thumbnail Cache Manager

**New File:** `src/lib/thumbnailCache.ts`

```typescript
import { frameStorage } from './frameStorage';

interface CacheEntry {
  url: string;
  lastAccessed: number;
  frameId: string;
}

export class ThumbnailCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private loadingQueue: Set<string> = new Set();
  
  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }
  
  /**
   * Get thumbnail URL from cache or load it
   */
  async get(frameId: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(frameId);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.url;
    }
    
    // Don't load if already in queue
    if (this.loadingQueue.has(frameId)) {
      return null;
    }
    
    // Load thumbnail
    this.loadingQueue.add(frameId);
    try {
      const blob = await frameStorage.getFrameThumbnail(frameId);
      if (!blob) return null;
      
      const url = URL.createObjectURL(blob);
      
      // Add to cache
      this.cache.set(frameId, {
        url,
        lastAccessed: Date.now(),
        frameId
      });
      
      // Enforce cache size limit
      this.evictIfNeeded();
      
      return url;
    } finally {
      this.loadingQueue.delete(frameId);
    }
  }
  
  /**
   * Preload thumbnails for frame IDs (non-blocking)
   */
  async preload(frameIds: string[]): Promise<void> {
    // Load in small batches to avoid blocking
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < frameIds.length; i += BATCH_SIZE) {
      const batch = frameIds.slice(i, i + BATCH_SIZE);
      
      // Load batch in parallel
      await Promise.all(
        batch.map(id => {
          // Skip if already cached or loading
          if (this.cache.has(id) || this.loadingQueue.has(id)) {
            return Promise.resolve();
          }
          return this.get(id).catch(() => {
            // Ignore preload failures
          });
        })
      );
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  
  /**
   * LRU eviction when cache exceeds max size
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.maxSize) return;
    
    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Evict oldest 20% of cache
    const evictCount = Math.ceil(this.maxSize * 0.2);
    
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      const [frameId, entry] = entries[i];
      URL.revokeObjectURL(entry.url);
      this.cache.delete(frameId);
    }
  }
  
  /**
   * Check if frame is cached
   */
  has(frameId: string): boolean {
    return this.cache.has(frameId);
  }
  
  /**
   * Clear entire cache
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.url);
    }
    this.cache.clear();
    this.loadingQueue.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      loading: this.loadingQueue.size
    };
  }
}
```

### Step 2: Modify Frame Analysis Component

**File:** `src/components/frame-analysis.tsx`

```typescript
import { ThumbnailCache } from '@/lib/thumbnailCache';

export function FrameAnalysis({
  frames,
  selectedFrames,
  onFrameSelectAction,
  showImageGrid = true,
}: FrameAnalysisProps) {
  const [selectedFrame, setSelectedFrame] = useState<FrameData | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<FrameData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [frameData, setFrameData] = useState<Record<string, Uint8Array>>({});
  const convertingRef = useRef<Record<string, boolean>>({});
  
  // NEW: Replace Map with ThumbnailCache
  const thumbnailCache = useRef<ThumbnailCache>(new ThumbnailCache(200));
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const chartRef = useRef<HTMLDivElement>(null);
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Component lifecycle - cleanup cache on unmount
  useEffect(() => {
    return () => {
      thumbnailCache.current.clear();
    };
  }, []);

  // REMOVE: Lines 53-119 (bulk loading effect)
  
  // NEW: Load thumbnails ONLY for selected frames (grid display)
  useEffect(() => {
    const loadSelectedThumbnails = async () => {
      const selectedFrameIds = Array.from(selectedFrames);
      
      for (const frameId of selectedFrameIds) {
        if (thumbnailCache.current.has(frameId)) {
          // Already cached, just update state
          const url = await thumbnailCache.current.get(frameId);
          if (url) {
            setThumbnailUrls(prev => new Map(prev.set(frameId, url)));
          }
        } else {
          // Load on demand
          const url = await thumbnailCache.current.get(frameId);
          if (url) {
            setThumbnailUrls(prev => new Map(prev.set(frameId, url)));
          }
        }
      }
    };
    
    loadSelectedThumbnails();
  }, [selectedFrames]);

  // NEW: Preload thumbnails in sliding window around hovered frame
  useEffect(() => {
    if (!hoveredFrame) return;
    
    // Clear any pending preload
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
    }
    
    // Load hovered frame immediately
    const loadHoveredAndPreload = async () => {
      // 1. Load hovered frame with priority
      const hoveredUrl = await thumbnailCache.current.get(hoveredFrame.id);
      if (hoveredUrl) {
        setThumbnailUrls(prev => new Map(prev.set(hoveredFrame.id, hoveredUrl)));
      }
      
      // 2. Preload nearby frames (debounced)
      preloadTimerRef.current = setTimeout(async () => {
        const currentIndex = frames.findIndex(f => f.id === hoveredFrame.id);
        if (currentIndex === -1) return;
        
        // Preload ±15 frames around hovered frame
        const preloadRange = 15;
        const start = Math.max(0, currentIndex - preloadRange);
        const end = Math.min(frames.length, currentIndex + preloadRange + 1);
        
        const nearbyFrameIds = frames
          .slice(start, end)
          .map(f => f.id);
        
        // Non-blocking preload
        thumbnailCache.current.preload(nearbyFrameIds).catch(() => {
          // Ignore preload errors
        });
      }, 150); // Debounce preload by 150ms
    };
    
    loadHoveredAndPreload();
    
    return () => {
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
      }
    };
  }, [hoveredFrame, frames]);

  // NEW: Get thumbnail URL from cache
  const getThumbnailUrl = useCallback((frameId: string) => {
    return thumbnailUrls.get(frameId);
  }, [thumbnailUrls]);

  // Rest of component remains the same...
}
```

### Step 3: Update Chart Tooltip for Better Loading State

**File:** `src/components/chart-tooltip.tsx`

```typescript
export function ChartTooltip({ frame, position, getThumbnailUrl }: ChartTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!tooltipRef.current || !position) return;
    const tooltip = tooltipRef.current;
    const x = position.x;
    const y = position.y - 16;
    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [position]);
  
  useEffect(() => {
    if (frame && !getThumbnailUrl(frame.id)) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [frame, getThumbnailUrl]);

  if (!frame || !position) return null;

  const thumbnailUrl = getThumbnailUrl(frame.id);

  return (
    <div
      ref={tooltipRef}
      className="fixed top-0 left-0 bg-white p-3 border rounded-lg shadow-lg pointer-events-none z-[9999]"
      style={{
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden'
      }}
    >
      <div className="relative w-48 aspect-video mb-2 rounded-md overflow-hidden bg-gray-100">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
          </div>
        )}
        {thumbnailUrl && (
          <Image
            src={thumbnailUrl}
            alt={frame.name}
            fill
            className="object-cover"
            sizes="192px"
            priority
          />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{frame.name}</p>
        <p className="text-sm text-muted-foreground">
          Sharpness: {frame.sharpnessScore?.toFixed(1)}
        </p>
      </div>
    </div>
  );
}
```

## Performance Impact

### Before Optimization
- **Issue 1 (Bulk Load):** 5,000 thumbnails × 10KB = ~50MB IndexedDB reads + ~1GB blob URLs
- **Issue 2 (Hover):** 100 hovers/2sec = 50 loads/second, ~5MB/sec memory growth
- **Total Memory:** 500MB-1GB for thumbnails alone
- **Chart Performance:** Stuttering due to constant IndexedDB reads

### After Optimization
- **Issue 1:** Load only selected frames (10-50 frames = ~100KB-500KB)
- **Issue 2:** Max 200 thumbnails cached (200 × 10KB = ~2MB)
- **Preloading:** ±15 frames loaded = ~30 frames = ~300KB
- **Total Memory:** 2-3MB for thumbnails (98-99% reduction!)
- **Chart Performance:** Smooth hover with preloaded thumbnails

## Implementation Checklist

- [ ] Create `src/lib/thumbnailCache.ts` with ThumbnailCache class
- [ ] Update `src/components/frame-analysis.tsx`:
  - [ ] Remove bulk loading effect (lines 53-119)
  - [ ] Add thumbnailCache ref
  - [ ] Implement selected frames loading
  - [ ] Implement hover preloading with debounce
  - [ ] Update getThumbnailUrl callback
- [ ] Update `src/components/chart-tooltip.tsx`:
  - [ ] Add loading state
  - [ ] Show spinner while thumbnail loads
- [ ] Test with large files (5000+ frames):
  - [ ] Verify memory usage < 50MB for thumbnails
  - [ ] Verify smooth chart hover
  - [ ] Verify selected frames display correctly
  - [ ] Check cache eviction works (DevTools Memory)

## Configuration Options

Adjustable parameters:
- `maxSize: 200` - Maximum thumbnails in cache (can increase for more memory/less loading)
- `preloadRange: 15` - Frames to preload around hovered frame
- `debounceDelay: 150ms` - Delay before preloading starts
- `BATCH_SIZE: 5` - Preload batch size

## Testing Strategy

### Test Case 1: Small File (100 frames)
- All selected frames should load
- Hover should be instant (all fit in cache)
- No performance degradation

### Test Case 2: Medium File (1000 frames)
- Selected frames load
- Hover preloads nearby frames
- Cache stays under 200 thumbnails

### Test Case 3: Large File (5000 frames)
- Selected frames load (10-50 frames)
- Chart hover smooth with preloading
- Memory usage monitored
- LRU eviction occurs when hovering across entire chart

### Memory Profiling
Use Chrome DevTools:
1. Take heap snapshot before loading frames
2. Load 5000-frame video
3. Take snapshot after extraction
4. Hover across entire chart
5. Take final snapshot
6. Verify: `Detached` blob URLs are cleaned up
7. Verify: Total thumbnail memory < 50MB

## Migration Notes

**Breaking Changes:** None - this is an internal refactor

**Backwards Compatibility:** Full - getThumbnailUrl callback signature unchanged

**Rollback Plan:** Keep current implementation in git history, can revert if issues found

## Success Metrics

- ✅ Memory usage < 50MB for thumbnails (from 500MB-1GB)
- ✅ Chart hover remains smooth (no stuttering)
- ✅ Selected frames display correctly
- ✅ No bulk loading on mount (< 100ms mount time)
- ✅ Preloading improves UX (no loading spinner on hover)

