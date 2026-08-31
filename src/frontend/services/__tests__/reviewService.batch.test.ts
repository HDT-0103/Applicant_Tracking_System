import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
vi.mock("../httpClient", () => ({ api: { post: (...a: unknown[]) => post(...a) } }));

import { getReviewStatuses, REVIEW_BATCH_LIMIT } from "../reviewService";

function statusesFor(uuids: string[]) {
  return Object.fromEntries(
    uuids.map((u) => [u, { candidate_uuid: u, overall_status: "waiting_for_tls" }]),
  );
}

describe("getReviewStatuses", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockImplementation((_url: string, body: { candidate_uuids: string[] }) =>
      Promise.resolve(statusesFor(body.candidate_uuids)),
    );
  });

  it("asks for a whole screenful in one request", async () => {
    const uuids = ["a", "b", "c"];
    const result = await getReviewStatuses(uuids);

    // The point of the endpoint: one round trip, not one per row.
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/api/review/batch", { candidate_uuids: uuids });
    expect(Object.keys(result)).toEqual(uuids);
  });

  it("makes no request at all for an empty list", async () => {
    expect(await getReviewStatuses([])).toEqual({});
    expect(post).not.toHaveBeenCalled();
  });

  it("collapses duplicates rather than asking twice for the same candidate", async () => {
    await getReviewStatuses(["a", "b", "a"]);
    expect(post).toHaveBeenCalledWith("/api/review/batch", { candidate_uuids: ["a", "b"] });
  });

  it("splits a list the server would refuse, and merges the pieces back", async () => {
    // The endpoint caps a batch; sending more in one go is a 422, so a caller
    // with a long list must not be silently truncated.
    const uuids = Array.from({ length: REVIEW_BATCH_LIMIT + 5 }, (_, i) => `c-${i}`);
    const result = await getReviewStatuses(uuids);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1].candidate_uuids).toHaveLength(REVIEW_BATCH_LIMIT);
    expect(post.mock.calls[1][1].candidate_uuids).toHaveLength(5);
    expect(Object.keys(result)).toHaveLength(uuids.length);
  });
});
