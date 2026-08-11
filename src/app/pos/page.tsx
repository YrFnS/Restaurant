import { PosTerminal } from "@/components/pos/PosTerminal";
import { RegisterSessionControl } from "@/components/pos/RegisterSessionControl";
import { requireStaffPage } from "@/lib/auth/page-guard";
import { ORDER_MANAGEMENT_ROLES } from "@/lib/auth/roles";

export default async function PosPage() {
  await requireStaffPage("/pos", ORDER_MANAGEMENT_ROLES);

  return (
    <>
      <RegisterSessionControl />
      <PosTerminal />
    </>
  );
}
