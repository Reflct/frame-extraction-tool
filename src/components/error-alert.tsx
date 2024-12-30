'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorAlertProps {
  error: string | null;
  className?: string;
}

export function ErrorAlert({ error, className = '' }: ErrorAlertProps) {
  if (!error) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}
