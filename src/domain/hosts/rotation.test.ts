import { describe, expect, it } from "vitest";

import { buildHostHistory, suggestHost } from "./rotation";

describe("host rotation", () => {
  it("counts member-level accepted hosts from history rows only", () => {
    const history = buildHostHistory([
      { userId: "a", displayName: "Alex" },
      { userId: "b", displayName: "Blake" },
      { userId: "a", displayName: "Alex" },
    ]);
    expect(history).toEqual([
      { userId: "a", displayName: "Alex", count: 2 },
      { userId: "b", displayName: "Blake", count: 1 },
    ]);
  });

  it("sorts history alphabetically without ranking members", () => {
    const history = buildHostHistory([
      { userId: "z", displayName: "Zoe" },
      { userId: "a", displayName: "Alex" },
      { userId: "z", displayName: "Zoe" },
      { userId: "z", displayName: "Zoe" },
    ]);
    expect(history.map((e) => e.displayName)).toEqual(["Alex", "Zoe"]);
    expect(history.find((e) => e.userId === "z")?.count).toBe(3);
  });

  it("suggests the member with the fewest hosting turns deterministically", () => {
    const suggestion = suggestHost(
      [
        { userId: "1", displayName: "Charlie" },
        { userId: "2", displayName: "Alex" },
        { userId: "3", displayName: "Blake" },
      ],
      buildHostHistory([
        { userId: "1", displayName: "Charlie" },
        { userId: "1", displayName: "Charlie" },
        { userId: "3", displayName: "Blake" },
      ]),
    );
    expect(suggestion?.userId).toBe("2");
    expect(suggestion?.hostedCount).toBe(0);
    expect(suggestion?.reason).toContain("Alex");
  });

  it("breaks ties by display name then user id", () => {
    const suggestion = suggestHost(
      [
        { userId: "b-id", displayName: "Sam" },
        { userId: "a-id", displayName: "Sam" },
      ],
      [],
    );
    expect(suggestion?.userId).toBe("a-id");
  });

  it("does not compute scores or ranks beyond factual counts", () => {
    const suggestion = suggestHost(
      [{ userId: "1", displayName: "Alex" }],
      buildHostHistory([{ userId: "1", displayName: "Alex" }]),
    );
    expect(suggestion).toMatchObject({
      hostedCount: 1,
    });
    expect(suggestion).not.toHaveProperty("rank");
    expect(suggestion).not.toHaveProperty("score");
  });
});
