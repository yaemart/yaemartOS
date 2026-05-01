'use client';

import { DevPreviewProvider } from '@/providers/dev-preview-provider';
import { DevPreviewDock } from '@/components/dev/dev-preview-dock';
import { DevViewportFrame } from '@/components/dev/dev-viewport-frame';
import { DevPreviewShell } from '@/components/dev/dev-preview-shell';
import { PortalShell } from '@/components/portal/portal-shell';
import { AdminShell } from '@/components/dev/admin-shell-preview';

export default function DevPreviewPage() {
  return (
    <DevPreviewProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <DevViewportFrame>
          <DevPreviewShell adminContent={<AdminShell />} portalContent={<PortalShell />} />
        </DevViewportFrame>
      </div>
      <DevPreviewDock />
    </DevPreviewProvider>
  );
}
