'use client';

import { StaffNavBar } from '@/components/staff/StaffNavBar';

export default function AdminLayout({
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
