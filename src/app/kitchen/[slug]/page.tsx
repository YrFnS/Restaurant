'use client';

import { use } from 'react';
import KitchenDisplay from '@/components/kitchen/KitchenDisplay';

export default function KitchenScreenPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <KitchenDisplay screenSlug={slug} />;
}
