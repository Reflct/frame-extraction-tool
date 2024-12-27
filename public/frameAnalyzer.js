// Frame analyzer web worker
self.onmessage = async function(e) {
  const { data } = e;
  
  try {
    // Create array to store frame timestamps
    const timestamps = [];
    let lastTimestamp = -1;
    
    // Create video element
    const offscreenVideo = new OffscreenVideo();
    const objectUrl = URL.createObjectURL(data.file);
    offscreenVideo.src = objectUrl;
    
    // Analyze frames
    offscreenVideo.onframe = (timestamp) => {
      if (timestamp !== lastTimestamp) {
        timestamps.push(timestamp);
        lastTimestamp = timestamp;
      }
    };
    
    // Wait for enough frames to calculate FPS
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Calculate FPS from timestamps
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i-1]);
    }
    
    // Get average interval
    const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
    const fps = Math.round(1000 / avgInterval);
    
    // Clean up
    URL.revokeObjectURL(objectUrl);
    
    // Send result back
    self.postMessage({ fps });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
