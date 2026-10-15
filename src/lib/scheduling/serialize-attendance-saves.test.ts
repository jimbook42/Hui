import { describe, expect, it } from "vitest";

import {
  createAttendanceSaveSerializer,
  createPerCandidateAttendanceSaveSerializers,
} from "@/lib/scheduling/serialize-attendance-saves";

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

describe("createPerCandidateAttendanceSaveSerializers", () => {
  it("serializes per candidate but allows different candidates in parallel", async () => {
    const run = createPerCandidateAttendanceSaveSerializers();
    let inFlight = 0;
    let maxInFlight = 0;

    const gateA = new Promise<void>((resolve) => {
      (globalThis as { releaseA?: () => void }).releaseA = resolve;
    });
    const gateB = new Promise<void>((resolve) => {
      (globalThis as { releaseB?: () => void }).releaseB = resolve;
    });

    const track = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
    };

    const a1 = run("a", async () => {
      await track();
      await gateA;
    });
    const a2 = run("a", async () => {
      await track();
    });
    const b1 = run("b", async () => {
      await track();
      await gateB;
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(maxInFlight).toBeGreaterThan(1);

    (globalThis as { releaseA?: () => void }).releaseA?.();
    (globalThis as { releaseB?: () => void }).releaseB?.();
    await Promise.all([a1, a2, b1]);
  });
});
