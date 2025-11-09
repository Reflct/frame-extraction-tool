<!-- 30c93b29-711c-475b-bd64-f4d8d506c10d ec5e316d-5506-446e-b669-faebea12f700 -->
# Canvas Chart Upgrade

1. Deep-Dive Current Recharts Flow

- Trace the data pipeline: `chartData` → `visibleChartData` → `BarChart`/`Bar`/`Cell`, noting 10px slot sizing, 8px bar width, axis formatting, and dynamic width handling.
- Document event wiring: `handleChartMouseMove`, `handleChartMouseLeave`, `handleChartScroll`, and click logic (modal open + `convertBlobToUint8Array`), plus `frameMap` and tooltip positioning via `chartRef`.
- Capture UX affordances: hover tooltip with thumbnail lazy-loading, selected vs unselected colors, scroll virtualization debounce, keyboard shortcut (`a`), and interactions with `FramePreviewDialog`.

2. Design High-Performance Canvas Renderer

- Specify a `CanvasFrameChart` in `src/components/frame-canvas-chart.tsx` accepting frames, selected ids, scroll offset, and callback props (`onHover`,`onLeave`,`onClick`,`onScrollEnd`).
- Plan rendering: single `<canvas>` with cached draw params, batched `requestAnimationFrame` updates, and optimized painting of only visible bars based on container width / scroll position.
- Define pointer-to-frame math that respects 10px slots, horizontal scroll, and device pixel ratio, and return canvas-relative coordinates for tooltip anchoring.

3. Refactor FrameAnalysis Integration

- Replace the Recharts JSX with the canvas component while preserving the outer scroll container (or move scrolling inside the canvas component if performance dictates).
- Wire canvas callbacks to existing state setters (`setHoveredFrame`, `setTooltipPosition`, dialog toggles) and reuse `frameMap` / `chartRef` as needed; remove redundant derived state like `visibleChartData` if canvas owns it.
- Drop Recharts imports and update supporting logic (e.g., delete now-unused YAxis/XAxis formatting, streamline virtualization state) without regressing thumbnail preload or keyboard handling.

4. Validate UX & Performance Guarantees

- Exercise hover tooltip thumbnails, click-to-open preview, selection toggles, scroll behavior, and keyboard shortcut with large datasets to confirm parity.
- Inspect memory usage and frame rate versus the original implementation; document any residual edge cases or follow-up tasks for future tuning.

### To-dos

- [ ] Catalog current Recharts data flow, event handlers, and styling in `FrameAnalysis`.
- [ ] Implement canvas-based chart renderer with drawing, hover, click, and scroll hooks.
- [ ] Swap FrameAnalysis to use the canvas chart and confirm tooltip/modal flows.
- [ ] Exercise the UI to ensure behavior parity and improved performance.