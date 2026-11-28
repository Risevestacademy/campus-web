import { describe, expect, it } from "vitest";

import { createSendBudget } from "./send-budget";

function clock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance(milliseconds: number) {
      time += milliseconds;
    },
  };
}

describe("send budget", () => {
  it("lets five lines go at once and holds the sixth", () => {
    const budget = createSendBudget(clock().now);

    const taken = Array.from({ length: 6 }, () => budget.take());

    expect(taken).toEqual([true, true, true, true, true, false]);
  });

  it("gives back one line a second", () => {
    const time = clock();
    const budget = createSendBudget(time.now);
    for (let line = 0; line < 5; line += 1) budget.take();

    time.advance(999);
    expect(budget.take()).toBe(false);

    time.advance(1);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
  });

  it("never holds more than the burst, however long it rests", () => {
    const time = clock();
    const budget = createSendBudget(time.now);
    for (let line = 0; line < 5; line += 1) budget.take();

    time.advance(60_000);
    const taken = Array.from({ length: 6 }, () => budget.take());

    expect(taken).toEqual([true, true, true, true, true, false]);
  });

  it("takes a refund for a line that was never sent", () => {
    const budget = createSendBudget(clock().now);
    for (let line = 0; line < 5; line += 1) budget.take();

    budget.refund();

    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
  });

  it("ignores a clock that goes backwards", () => {
    const time = clock(10_000);
    const budget = createSendBudget(time.now);
    for (let line = 0; line < 5; line += 1) budget.take();

    time.advance(-5_000);

    expect(budget.take()).toBe(false);
  });
});
