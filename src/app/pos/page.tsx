import { PosTerminal } from "@/components/pos/PosTerminal";
import { RegisterSessionControl } from "@/components/pos/RegisterSessionControl";

export default function PosPage() {
  return (
    <>
      <RegisterSessionControl />
      <PosTerminal />
    </>
  );
}
