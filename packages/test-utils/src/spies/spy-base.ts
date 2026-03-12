/**
 * Base class for test spy doubles.
 * Tracks call count, last call args, and allows configuring return values.
 */
export class SpyBase {
  protected calls: Map<string, { count: number; lastArgs: unknown[] }> = new Map()

  protected trackCall(method: string, args: unknown[]): void {
    const existing = this.calls.get(method) ?? { count: 0, lastArgs: [] }
    this.calls.set(method, {
      count: existing.count + 1,
      lastArgs: args,
    })
  }

  /** Returns how many times a method was called */
  callCount(method: string): number {
    return this.calls.get(method)?.count ?? 0
  }

  /** Returns the last arguments passed to a method */
  lastCallArgs(method: string): unknown[] {
    return this.calls.get(method)?.lastArgs ?? []
  }

  /** Returns true if a method was called at least once */
  wasCalled(method: string): boolean {
    return this.callCount(method) > 0
  }

  /** Resets all tracking state */
  reset(): void {
    this.calls.clear()
  }
}
