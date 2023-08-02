export type Stats = {
    startTimeMs: number;
    endTimeMs: number;
    timeoutMs: number;
}

export default class StatsCollector {
    private readonly statsBag: Map<string, Stats[]> = new Map(); 
    public push(id: string, stats: Stats) {
        const savedStats = this.statsBag.get(id) || [];
        savedStats.push(stats);

        // in case wasn't existing we register the new created stats array
        if (!this.statsBag.has(id)) this.statsBag.set(id, savedStats);
    }

    public get(id: string): Stats[] | undefined {
        return this.statsBag.get(id);
    }

    public clear(): void {
        this.statsBag.clear();
    }

    public getTotalBlockingTimeMs(): number {
        let total = 0;
        for (const [_key, values] of this.statsBag) {
            for(const stats of values) {
               const deltaTime = stats.endTimeMs - stats.startTimeMs;
               total += deltaTime;
            }
        }
        return total;
    }

    public toString(): string {
        let output = `Collected stats by id:\n`;
        for (const [key, values] of this.statsBag) {
            output+=`    ${key}:`;
            if(values.length === 1) {
                const onlyStats = values[0];
                const deltaTime = onlyStats.endTimeMs - onlyStats.startTimeMs;
                const hasTimedout = deltaTime > onlyStats.timeoutMs;
                output+=` took ${deltaTime}ms ${hasTimedout?`🔴 (TO: ${onlyStats.timeoutMs}ms)`:'🟢'}\n`
                continue;
            }
            output+=`\n`;
            for(const stats of values) {
                const deltaTime = stats.endTimeMs - stats.startTimeMs;
                const hasTimedout = deltaTime > stats.timeoutMs;
                output+=`        [${stats.startTimeMs}]: took ${deltaTime}ms ${hasTimedout?`🔴 (TO: ${stats.timeoutMs}ms)`:'🟢'}\n`;
            }
        }
        return output;
    }
}

export function wrapStatsCollector<T extends Promise<unknown>>(promiseRunner: () => T, id: string, collector: StatsCollector, timeoutMs: number): T {
    const startTimeMs = Date.now();
    const promise = promiseRunner();
    promise.then(() => {
        const endTimeMs = Date.now();
        collector.push(id, {
            startTimeMs,
            endTimeMs,
            timeoutMs,
        });
    });
    return promise;
}