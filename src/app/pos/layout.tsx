'use client';

import { StaffNavBar } from '@/components/staff/StaffNavBar';

export default function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StaffNavBar />
      {children}
    </>
  );
}
