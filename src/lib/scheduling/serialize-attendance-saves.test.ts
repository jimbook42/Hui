import { describe, expect, it } from "vitest";

import { createAttendanceSaveSerializer } from "@/lib/scheduling/serialize-attendance-saves";

describe("createAttendanceSaveSerializer", () => {
  it("runs tasks one at a time", async () => {
    const run = createAttendanceSaveSerializer();
    let inFlight = 0;
    let maxInFlight = 0;
    const order: number[] = [];

    const tasks = [1, 2, 3].map((id) => async () => {
      order.push(id);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          inFlight -= 1;
          resolve();
        }, 5);
      });
    });

    await Promise.all(tasks.map((task) => run(task)));
    expect(maxInFlight).toBe(1);
    expect(order).toEqual([1, 2, 3]);
  });
});
