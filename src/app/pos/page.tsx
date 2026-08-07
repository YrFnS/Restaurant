import { redirect } from "next/navigation";
import { PosTerminal } from "@/components/pos/PosTerminal";
import { RegisterSessionControl } from "@/components/pos/RegisterSessionControl";
import { getStaffSession } from "@/lib/auth/session";

export default async function PosPage() {
  if (!(await getStaffSession())) redirect("/admin?next=%2Fpos");

  return (
    <>
      <RegisterSessionControl />
      <PosTerminal />
    </>
  );
}
