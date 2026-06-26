'use client';

import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { BrandQaConfigForm, type BrandQaConfig } from './brand-qa-config-form';

// Thin Sheet wrapper around BrandQaConfigForm (Batch 005.1 Phase 4). The form
// body was extracted to brand-qa-config-form.tsx so it can also be hosted
// inline by the coverage-page BrandAdminDrawer's QA tab. This wrapper preserves
// the settings-page contract verbatim: same props, closes on save.
//
// BrandQaConfig is re-exported here so existing imports
// (`import { ..., type BrandQaConfig } from '.../edit-brand-qa-config-drawer'`)
// keep resolving — the settings page is not deleted until Phase 5.
export type { BrandQaConfig } from './brand-qa-config-form';

interface EditBrandQaConfigDrawerProps {
  brand: BrandQaConfig | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditBrandQaConfigDrawer({ brand, open, onOpenChange, onSaved }: EditBrandQaConfigDrawerProps) {
  if (!brand) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent />
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit QA Config — {brand.display_name}</SheetTitle>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[color:var(--f92-gray)]">
            <span>{brand.brand_code}</span>
            {brand.qa_automation_enabled ? (
              <Badge variant="resolved">QA Enabled</Badge>
            ) : (
              <Badge variant="default">QA Disabled</Badge>
            )}
          </div>
        </SheetHeader>

        <div className="mt-6">
          <BrandQaConfigForm
            key={brand.id}
            brand={brand}
            onSaved={() => { onSaved(); onOpenChange(false); }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
