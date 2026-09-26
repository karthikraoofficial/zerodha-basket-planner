export type StepId = 1 | 2 | 3;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Login" },
  { id: 2, label: "Bucket & Horizon" },
  { id: 3, label: "Plan" },
];

/** Steps before `current` are done; steps after it are locked. */
export function Stepper({ current }: { current: StepId }) {
  return (
    <ol className="stepper" aria-label="Progress">
      {STEPS.map((step) => {
        const state = step.id < current ? "done" : step.id === current ? "current" : "locked";
        return (
          <li key={step.id} className={`step step-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="step-mark" aria-hidden>
              {state === "done" ? "✓" : state === "locked" ? "🔒" : step.id}
            </span>
            <span className="step-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
