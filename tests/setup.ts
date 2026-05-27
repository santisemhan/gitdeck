import "@testing-library/jest-dom/vitest";

type IOCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void;

interface FakeIntersectionObserver extends IntersectionObserver {
  __trigger(isIntersecting: boolean): void;
}

class IntersectionObserverPolyfill implements FakeIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IOCallback;
  private targets: Element[] = [];

  constructor(callback: IOCallback, _options?: IntersectionObserverInit) {
    this.callback = callback;
  }

  observe(target: Element): void {
    if (!this.targets.includes(target)) this.targets.push(target);
  }

  unobserve(target: Element): void {
    this.targets = this.targets.filter((t) => t !== target);
  }

  disconnect(): void {
    this.targets = [];
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  __trigger(isIntersecting: boolean): void {
    const entries = this.targets.map(
      (target) =>
        ({
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        }) as IntersectionObserverEntry,
    );
    this.callback(entries, this);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __ioInstances: IntersectionObserverPolyfill[];
}

globalThis.__ioInstances = [];

const OriginalIO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;

(globalThis as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  function IO(callback: IOCallback, options?: IntersectionObserverInit) {
    const instance = new IntersectionObserverPolyfill(callback, options);
    globalThis.__ioInstances.push(instance);
    return instance;
  } as unknown as typeof IntersectionObserver;

export function triggerAllIntersections(isIntersecting: boolean): void {
  for (const io of globalThis.__ioInstances) io.__trigger(isIntersecting);
}

export function resetIntersectionObservers(): void {
  globalThis.__ioInstances = [];
}

export { OriginalIO };
