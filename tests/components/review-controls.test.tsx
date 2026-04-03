import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ReviewControls } from "@/src/components/review-controls";

describe("ReviewControls", () => {
  test("disables Gmail draft creation until evaluator and human approval are both complete", () => {
    render(
      <ReviewControls
        evaluatorApproved={false}
        gmailConnected={true}
        gmailDraftStatus="not_started"
        humanReviewStatus="pending"
      />,
    );

    expect(screen.getByRole("button", { name: "Create Gmail Draft" })).toBeDisabled();
    expect(
      screen.getByText("Evaluator approval and human approval are both required."),
    ).toBeInTheDocument();
  });

  test("enables Gmail draft creation when the run has cleared every gate", () => {
    render(
      <ReviewControls
        evaluatorApproved={true}
        gmailConnected={true}
        gmailDraftStatus="not_started"
        humanReviewStatus="approved"
      />,
    );

    expect(screen.getByRole("button", { name: "Create Gmail Draft" })).toBeEnabled();
  });
});
