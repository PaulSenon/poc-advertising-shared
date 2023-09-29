import { buildStatsAndToWrapper } from "../../utils/SafePromiseWrapper";
import StatsCollector from "../../utils/StatsCollector";
import IService from "../IService";
import YieldbirdService from "./Hooks/YieldbirdService";
import IAdvertisingLifecycleHook, { AdSlotData, filterHooks } from "./IAdvertisingLifecycleHook";

/**
 * This class is meant to manage an array of potentially unsafe IAdvertisingLifecycleBlockingHook
 * And add parallelization/timeout/stats to them.
 * This is the layer to use from Advertising.ts to run any hook.
 */
export class AdsLifecycleHooksRunner implements IService {
    private wrapPromise;
    private unsafeHooks: (IService & IAdvertisingLifecycleHook)[];
    // TODO
    // PromiseWrapperBuilder
    //         .withTimeout()
    //         .withStatsCollector()
    //         .build()
    constructor(
        private statsCollector: StatsCollector,
    ) {
        // TODO not like this
        this.wrapPromise = buildStatsAndToWrapper(this.statsCollector, 200);

        // TODO passer dans l'init (ou i resolve dependencies si c'est des services)
        this.unsafeHooks = [ // just throw all thirdparties here! too easy !
            new YieldbirdService(),
        ]
    }

    // hack to propagate init, it is managed automatically by our app core on the real website
    async init(): Promise<void> {
        for (const hook of this.unsafeHooks) {
            await hook.init();
        }
        return Promise.resolve();
    }

    // hack to propagate reset, it is managed automatically by our app core on the real website
    async reset(): Promise<void> {
        for (const hook of this.unsafeHooks) {
            await hook.reset();
        }
        return Promise.resolve();
    }

    addHook(unsafeHook: IService & IAdvertisingLifecycleHook): void {
        this.unsafeHooks.push(unsafeHook);
    }

    /**
     * Should be called/awaited before setuping googletag
     * 
     * ✅ safely timed-out
     * ✅ safely handled and logs
     * ✅ parallelized
     * ✅ performance of each hook saved
     */
    public async runHooksBeforeGoogleTagInit(): Promise<void> {
        const hooks = filterHooks('handleBeforeGoogletagInit', this.unsafeHooks);
        const promises = hooks.map(async hook => {
            const hookName = `${hook.constructor.name}.${'handleBeforeGoogletagInit'}`;
            const { hasTimedout } = await this.wrapPromise(
                hookName,
                () => hook.handleBeforeGoogletagInit(),
            );
            if (hasTimedout) {
                console.warn(`Hook [${hookName}] for [${'handleBeforeGoogletagInit'}] has been timed out [${200}ms]. Continue...`);
            }
        });
        await Promise.all(promises)
            .catch((e) => console.error(`handleBeforeGoogletagInit error. Skipping all hooks.\n`, e));
        return;
    }

    /**
     * Should be called/awaited right before destoying all slots from googletag
     * 
     * ✅ safely timed-out
     * ✅ safely handled and logs
     * ✅ parallelized
     * ✅ performance of each hook saved
     */
    public async runHooksDestroyAllSlots(): Promise<void> {
        const hooks = filterHooks('handleDestroyAllSlots', this.unsafeHooks);
        const promises = hooks.map(async hook => {
            const hookName = `${hook.constructor.name}.${'handleDestroyAllSlots'}`;
            const { hasTimedout } = await this.wrapPromise(
                hookName,
                () => hook.handleDestroyAllSlots(),
            );
            if (hasTimedout) {
                console.warn(`Hook [${hookName}] for [${'handleDestroyAllSlots'}] has been timed out [${200}ms]. Continue...`);
            }
        });
        await Promise.all(promises)
            .catch((e) => console.error(`handleDestroyAllSlots error. Skipping all hooks.\n`, e));
        return;
    }

    /**
     * Should be called/awaited when seting global targeting/keyvalues (googletag.pubads().setTargeting())
     * 
     * ✅ safely timed-out
     *      -> will eventually still set targetin after timeout, that's what the callback is for.
     *         but it will no longer be blocking (so might or might not be set when doing ad call)  
     * ✅ safely handled and logs
     * ✅ parallelized
     * ✅ performance of each hook saved
     */
    public async runHooksExternalKeyvalues(cb: (keyvalues: Record<string, string>) => void | Promise<void>): Promise<void> {
        const hooks = filterHooks('handleGetExternalKeyvalues', this.unsafeHooks);
        const promises = hooks.map(async kvProvider => {
            // we create a promise that always setTargeting in then, 
            // so even when it times out, it still eventually set the 
            // targeting value for the subsequent ad calls
            const providerName = `${kvProvider.constructor.name}.${'handleGetExternalKeyvalues'}`;
            let hasTimedout = false;
            const res = await this.wrapPromise(
                providerName, 
                () => kvProvider.handleGetExternalKeyvalues().then(async (keyvalues) => {
                    await cb(keyvalues);
                    if (hasTimedout) {
                        console.debug(`The Thirdparty Keyvalue provider [${providerName}] for the keyvalue [${Object.keys(keyvalues).join(', ')}] eventually resolved after timeout [${200}ms].`)
                    }
                })
            );
            hasTimedout = res.hasTimedout;
            if (hasTimedout) {
                console.warn(`The Thirdparty Keyvalue provider [${providerName}] has been timed out [${200}ms] but will continue run in background and asynchonously set keyvalues when it eventually resolves.`)
            }
        })
        await Promise.all(promises)
            .catch((e) => console.error(`handleGetExternalKeyvalues error. Skipping all hooks.\n`, e));
        return;
    }

    /**
     * Should be called right after a slot is created (googletag.pubads().defineSlot())
     * This is meant to be sync, to force using runHooksAllSlotsCreated for async process and therefore parallizing async computations 
     * 
     * ❌ safely timed-out
     * ✅ safely handled and logs
     * ❌ parallelized
     * ✅ performance of each hook saved
     */
    runHooksSlotCreated(adSlotData: AdSlotData): void {
        const hooks = filterHooks('handleSlotCreated', this.unsafeHooks);
        try {
            for (const hook of hooks) {
                const hookName = `${hook.constructor.name}.${'handleSlotCreated'}`;
                const startTimeMs = Date.now();
                hook.handleSlotCreated(adSlotData);
                const endTimeMs = Date.now();
                this.statsCollector.push(hookName, {
                    startTimeMs,
                    endTimeMs,
                    timeoutMs: -1
                });
            }
        } catch (e) {
            console.error(`handleSlotCreated error. Skipping all hooks.\n`, e)
        }
    }

    /**
     * Should be called/awaited right after all slot have been created
     * 
     * ✅ safely timed-out
     * ✅ safely handled and logs
     * ✅ parallelized
     * ✅ performance of each hook saved
     */
    public async runHooksAllSlotsCreated(adSlotsData: AdSlotData[]): Promise<void> {
        const hooks = filterHooks('handleAllSlotsCreated', this.unsafeHooks);
        const promises = hooks.map(async hook => {
            const hookName = `${hook.constructor.name}.${'handleAllSlotsCreated'}`;
            const { hasTimedout } = await this.wrapPromise(
                hookName,
                () => hook.handleAllSlotsCreated(adSlotsData),
            );
            if (hasTimedout) {
                console.warn(`Hook [${hookName}] for [${'handleAllSlotsCreated'}] has been timed out [${200}ms]. Continue...`);
            }
        });
        await Promise.all(promises)
            .catch((e) => console.error(`handleAllSlotsCreated error. Skipping all hooks.\n`, e));
        return;
    }

    /**
     * Should be called/awaited right before calling/rendering ads (googletag.pubads().refresh())
     * 
     * ✅ safely timed-out
     * ✅ safely handled and logs
     * ✅ parallelized
     * ✅ performance of each hook saved
     */
    public async runHooksBeforeCallingAds(): Promise<void> {
        const hooks = filterHooks('handleBeforeCallingAds', this.unsafeHooks);
        const promises = hooks.map(async hook => {
            const hookName = `${hook.constructor.name}.${'handleBeforeCallingAds'}`;
            const { hasTimedout } = await this.wrapPromise(
                hookName,
                () => hook.handleBeforeCallingAds(),
            );
            if (hasTimedout) {
                console.warn(`Hook [${hookName}] for [${'handleBeforeCallingAds'}] has been timed out [${200}ms]. Continue...`);
            }
        });
        await Promise.all(promises)
            .catch((e) => console.error(`handleBeforeCallingAds error. Skipping all hooks.\n`, e));
        return;
    }

}