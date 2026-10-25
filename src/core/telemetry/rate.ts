/** Measured sample rate over a sliding window of recent timestamps (seconds). */
export class RateMeter {
  private times: number[] = [];

  constructor(private readonly windowS = 3) {}

  tick(t: number): void {
    this.times.push(t);
    const cutoff = t - this.windowS;
    while (this.times.length > 0 && this.times[0]! < cutoff) this.times.shift();
  }

  hz(now: number): number {
    const recent = this.times.filter((t) => t >= now - this.windowS);
    if (recent.length < 2) return 0;
    const span = recent[recent.length - 1]! - recent[0]!;
    return span > 0 ? (recent.length - 1) / span : 0;
  }

  lastT(): number | null {
    return this.times.length > 0 ? this.times[this.times.length - 1]! : null;
  }
}
