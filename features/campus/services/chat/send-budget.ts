// World lets an account say five lines at once, then one a second, and drops
// what comes faster, so the panel keeps its own count and holds the text back
// instead of losing it.
const BURST = 5;
const PER_SECOND = 1;

export interface SendBudget {
  // Whether there is a line to spend, without spending it.
  available(): boolean;
  // Spends one line when there is one to spend.
  take(): boolean;
  // Gives it back: the line was never sent.
  refund(): void;
}

export function createSendBudget(now: () => number = Date.now): SendBudget {
  let lines = BURST;
  let refilledAt = now();

  function refill() {
    const at = now();
    const elapsed = Math.max(0, at - refilledAt);
    lines = Math.min(BURST, lines + (elapsed * PER_SECOND) / 1000);
    refilledAt = Math.max(refilledAt, at);
  }

  return {
    available() {
      refill();
      return lines >= 1;
    },
    take() {
      refill();
      if (lines < 1) return false;
      lines -= 1;
      return true;
    },
    refund() {
      lines = Math.min(BURST, lines + 1);
    },
  };
}
