import { Stepper } from "@/components/Stepper";
import { requireSetup } from "@/lib/server/guards";

// Placeholder until the plan page ticket: proves Step 3 is reachable only after Step 2.
export default async function PlanPage() {
  await requireSetup();
  return (
    <>
      <Stepper current={3} />
      <h1>Plan</h1>
    </>
  );
}
