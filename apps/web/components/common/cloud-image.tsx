'use client';

import Image from 'next/image';
import type { ComponentProps } from 'react';

/** next/image wrapper for Cloudinary HTTPS URLs (see next.config remotePatterns). */
export function CloudImage(props: ComponentProps<typeof Image>) {
  return <Image {...props} />;
}
