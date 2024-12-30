'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NumberInputProps { 
  value: number;
  onChange: (value: number) => void;
  min: number;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function NumberInput({ 
  value, 
  onChange, 
  min,
  label,
  className = "",
  disabled = false
}: NumberInputProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-8 w-8"
          disabled={disabled}
        >
          -
        </Button>
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || min)}
          min={min}
          className="w-20 text-center"
          disabled={disabled}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange(value + 1)}
          className="h-8 w-8"
          disabled={disabled}
        >
          +
        </Button>
      </div>
    </div>
  );
}
