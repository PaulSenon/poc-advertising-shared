import StatsCollector, { wrapStatsCollector } from "./StatsCollector";

export async function wrapTimeout<T>(promise: Promise<T> | undefined, timeout: number, ): Promise<{res?: T, hasTimedout: boolean}> {
    if (!promise) return { hasTimedout: false, res: undefined };
    const timeoutPromise: Promise<'timedout'> = new Promise((resolve) => setTimeout(() => resolve('timedout'), timeout));
    const result = await Promise.race([
        promise,
        timeoutPromise,
    ]);
    const hasTimedout = result === 'timedout';
    return {
        res: hasTimedout ? undefined : result,
        hasTimedout,
    }
}

export function buildStatsAndToWrapper(collector: StatsCollector, defaultTimeoutMs: number) {
    return async <V, T extends Promise<V>>(id: string, promiseRunner: () => T, timeoutMs = defaultTimeoutMs): Promise<{res: V | undefined, hasTimedout: boolean}> => {
        const promise = wrapStatsCollector(promiseRunner, id, collector, timeoutMs);
        const {hasTimedout, res} = await wrapTimeout(promise, timeoutMs);
        if (hasTimedout) {
            console.warn(`${id} as timedout after ${timeoutMs}ms.`);
        }
        return {hasTimedout, res};
    }
}
