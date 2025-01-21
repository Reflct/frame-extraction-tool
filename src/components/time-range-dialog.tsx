"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { VideoRangeSelector } from "@/components/video-range-selector"

interface TimeRangeDialogProps {
  duration: number
  timeRange: [number, number]
  videoRef: React.RefObject<HTMLVideoElement | null>
  onTimeRangeChangeAction: (range: [number, number]) => void
}

export function TimeRangeDialog({
  duration,
  timeRange,
  videoRef,
  onTimeRangeChangeAction,
}: TimeRangeDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [localRange, setLocalRange] = React.useState(timeRange)
  const [startTimeText, setStartTimeText] = React.useState("")
  const [endTimeText, setEndTimeText] = React.useState("")
  const [timeError, setTimeError] = React.useState<string | null>(null)
  const startPreviewRef = React.useRef<HTMLVideoElement>(null)
  const endPreviewRef = React.useRef<HTMLVideoElement>(null)

  // Reset local range and text inputs when dialog opens
  React.useEffect(() => {
    if (open) {
      setLocalRange(timeRange)
      setStartTimeText(formatTime(timeRange[0]))
      setEndTimeText(formatTime(timeRange[1]))
      setTimeError(null)
    }
  }, [open, timeRange])

  // Update preview videos when range changes
  React.useEffect(() => {
    if (startPreviewRef.current) {
      startPreviewRef.current.currentTime = localRange[0]
    }
    if (endPreviewRef.current) {
      endPreviewRef.current.currentTime = localRange[1]
    }
  }, [localRange])

  // Update text fields when range changes via slider
  React.useEffect(() => {
    // Only update text fields if they don't have focus
    const activeElement = document.activeElement
    if (activeElement !== document.getElementById('start-time-input') && 
        activeElement !== document.getElementById('end-time-input')) {
      setStartTimeText(formatTime(localRange[0]))
      setEndTimeText(formatTime(localRange[1]))
    }
  }, [localRange])

  const handleRangeChange = (range: [number, number]) => {
    setLocalRange(range)
    setTimeError(null)
  }

  const parseTimeInput = (timeStr: string): number | null => {
    // Handle input without decimal places by adding .00
    if (/^\d+:[0-5]?\d$/.test(timeStr)) {
      timeStr = timeStr + '.00';
    }

    const pattern = /^(\d+):([0-5]?\d)\.(\d{1,2})$/
    const match = timeStr.match(pattern)
    
    if (!match) return null
    
    const [, minutes, seconds, centiseconds] = match
    return parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds.padEnd(2, '0')) / 100
  }

  const handleTimeInput = (value: string, isStart: boolean) => {
    // Just update the text field during typing
    if (isStart) {
      setStartTimeText(value)
    } else {
      setEndTimeText(value)
    }
  }

  const validateAndUpdateTime = (value: string, isStart: boolean) => {
    // Handle input without decimal places by adding .00
    if (/^\d+:[0-5]?\d$/.test(value)) {
      value = value + '.00';
      // Update the text field to show the complete format
      if (isStart) {
        setStartTimeText(value)
      } else {
        setEndTimeText(value)
      }
    }

    const time = parseTimeInput(value)
    if (time === null) {
      // If invalid format, reset to current range value
      if (isStart) {
        setStartTimeText(formatTime(localRange[0]))
      } else {
        setEndTimeText(formatTime(localRange[1]))
      }
      setTimeError("Invalid time format. Use M:SS or M:SS.CC")
      return
    }

    let newRange: [number, number]
    if (isStart) {
      if (time >= localRange[1]) {
        setStartTimeText(formatTime(localRange[0]))
        setTimeError("Start time must be before end time")
        return
      }
      if (time < 0 || time > duration) {
        setStartTimeText(formatTime(localRange[0]))
        setTimeError(`Start time must be between 0:00.00 and ${formatTime(duration)}`)
        return
      }
      newRange = [time, localRange[1]]
    } else {
      if (time <= localRange[0]) {
        setEndTimeText(formatTime(localRange[1]))
        setTimeError("End time must be after start time")
        return
      }
      if (time < 0 || time > duration) {
        setEndTimeText(formatTime(localRange[1]))
        setTimeError(`End time must be between 0:00.00 and ${formatTime(duration)}`)
        return
      }
      newRange = [localRange[0], time]
    }

    setTimeError(null)
    setLocalRange(newRange)
  }

  const handleSave = () => {
    if (!timeError) {
      onTimeRangeChangeAction(localRange)
      setOpen(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          Time Range: {formatTime(timeRange[0])} - {formatTime(timeRange[1])}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Select Time Range</DialogTitle>
          <DialogDescription>
            Choose the start and end times for frame extraction.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Time</label>
              <Input
                id="start-time-input"
                value={startTimeText}
                onChange={(e) => handleTimeInput(e.target.value, true)}
                onBlur={(e) => validateAndUpdateTime(e.target.value, true)}
                placeholder="0:00.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Time</label>
              <Input
                id="end-time-input"
                value={endTimeText}
                onChange={(e) => handleTimeInput(e.target.value, false)}
                onBlur={(e) => validateAndUpdateTime(e.target.value, false)}
                placeholder={formatTime(duration)}
              />
            </div>
          </div>

          {timeError && (
            <div className="text-sm text-red-500">{timeError}</div>
          )}

          <VideoRangeSelector
            duration={duration}
            value={localRange}
            onRangeChangeAction={handleRangeChange}
            videoRef={videoRef}
          />
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Start Frame</div>
              {videoRef.current && (
                <video
                  ref={startPreviewRef}
                  src={videoRef.current.src}
                  className="w-full h-auto rounded-lg object-contain"
                  controls={false}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium">End Frame</div>
              {videoRef.current && (
                <video
                  ref={endPreviewRef}
                  src={videoRef.current.src}
                  className="w-full h-auto rounded-lg object-contain"
                  controls={false}
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!!timeError}>
            Save Range
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
