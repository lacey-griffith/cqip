'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface SplitButtonAction {
  label: string;
  onClick: () => void;
}

interface SplitButtonProps {
  primary: SplitButtonAction;
  secondary: SplitButtonAction;
  disabled?: boolean;
}

export function SplitButton({ primary, secondary, disabled }: SplitButtonProps) {
  return (
    <div className="inline-flex rounded-md shadow-sm">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={primary.onClick}
        disabled={disabled}
        className="rounded-r-none border-r border-[color:var(--f92-border)]"
      >
        {primary.label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled}
            aria-label={`${primary.label} — more options`}
            className="rounded-l-none px-2"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[10rem]">
          <DropdownMenuItem onSelect={() => secondary.onClick()}>
            {secondary.label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
