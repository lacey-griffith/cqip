'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface RowActionsMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  ticketId: string;
  logNumber: number;
}

export function RowActionsMenu({ onEdit, onDelete, ticketId, logNumber }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${ticketId} log #${logNumber}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--f92-border)] bg-white text-[color:var(--f92-gray)] transition hover:bg-[color:var(--f92-tint)] hover:text-[color:var(--f92-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--f92-orange)]"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
