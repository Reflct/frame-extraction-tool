"use client"

import * as React from "react"
import { Slider } from "@/components/ui/slider"

interface VideoRangeSelectorProps {
  duration: number
  value: [number, number]
  onRangeChangeAction: (range: [number, number]) => void
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function VideoRangeSelector({
  duration,
  value,
  onRangeChangeAction,
  videoRef,
}: VideoRangeSelectorProps) {
  const [activeThumb, setActiveThumb] = React.useState<number | null>(null)

  // Update video position when value changes and no thumb is active
  React.useEffect(() => {
    if (activeThumb === null && videoRef.current) {
      videoRef.current.currentTime = value[0]
    }
  }, [value, activeThumb, videoRef])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
  }

  const handleValueChange = (newValue: number[]) => {
    if (newValue.length !== 2) return
    
    const newRange: [number, number] = [newValue[0], newValue[1]]
    
    // Ensure start is not greater than end
    if (newRange[0] > newRange[1]) {
      newRange[0] = newRange[1]
    }
    
    onRangeChangeAction(newRange)

    // Update video preview based on which handle was moved
    const video = videoRef.current
    if (video) {
      const newTime = activeThumb === 0 ? newRange[0] : newRange[1]
      video.currentTime = newTime
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <div className="text-sm font-medium">Start Time</div>
          <div className="text-sm text-muted-foreground">{formatTime(value[0])}</div>
        </div>
        <div className="text-sm text-muted-foreground mx-2">to</div>
        <div className="space-y-1 text-right">
          <div className="text-sm font-medium">End Time</div>
          <div className="text-sm text-muted-foreground">{formatTime(value[1])}</div>
        </div>
      </div>
      
      <div className="pt-2">
        <Slider
          min={0}
          max={duration}
          step={0.01}
          value={[value[0], value[1]]}
          onValueChange={handleValueChange}
          onValueCommit={() => setActiveThumb(null)}
          onPointerDown={(e) => {
            const thumb = e.target as HTMLElement
            const isThumb = thumb.getAttribute('role') === 'slider'
            if (isThumb) {
              const index = parseInt(thumb.getAttribute('aria-valuemax') || '0') === duration ? 1 : 0
              setActiveThumb(index)
            }
          }}
          className="w-full"
        />
      </div>
      
      <div className="text-sm text-muted-foreground">
        Duration: {formatTime(value[1] - value[0])}
      </div>
    </div>
  )
}
