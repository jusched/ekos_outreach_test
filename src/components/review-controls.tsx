"use client";

type ReviewControlsProps = {
  humanReviewStatus: "pending" | "approved" | "rejected";
  evaluatorApproved: boolean;
  gmailConnected: boolean;
  gmailDraftStatus: "not_started" | "blocked" | "created" | "failed";
};

function getDisabledReason({
  humanReviewStatus,
  evaluatorApproved,
  gmailConnected,
}: ReviewControlsProps) {
  if (!evaluatorApproved || humanReviewStatus !== "approved") {
    return "Evaluator approval and human approval are both required.";
  }

  if (!gmailConnected) {
    return "Connect Gmail before draft creation is available.";
  }

  return null;
}

export function ReviewControls(props: ReviewControlsProps) {
  const disabledReason = getDisabledReason(props);
  const disabled = disabledReason !== null;
  const label =
    props.gmailDraftStatus === "created" ? "Draft Created" : "Create Gmail Draft";

  return (
    <div className="reviewControls">
      <button disabled={disabled} type="submit">
        {label}
      </button>
      <p className="muted">
        {disabledReason ?? "This will create a Gmail draft only. No email is sent automatically."}
      </p>
    </div>
  );
}
