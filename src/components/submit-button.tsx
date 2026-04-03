"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const status = useFormStatus();

  return (
    <button disabled={status.pending} type="submit">
      {status.pending ? pendingLabel : idleLabel}
    </button>
  );
}
