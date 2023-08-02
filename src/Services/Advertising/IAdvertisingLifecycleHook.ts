import { AdSlotConfig } from "./Advertising";

export type AdSlotData = { // TODO
    slot: googletag.Slot,
    element: HTMLElement,
    config: AdSlotConfig,
};


export default interface IAdvertisingLifecycleHook{
    /**
     * Called when googletag is loaded but not yet initialized.
     * This is called once per pageload. reset/swipe won't rerun it.
     */
    handleBeforeGoogletagInit?(): Promise<void>;

    /**
     * Called right before we delete all slots and attached stuff.
     * Should clear everything like nothing as ever been set.
     * This is NOT called at page load, but between page reset/swipe.
     */
    handleDestroyAllSlots?(): Promise<void>;
    
    /**
     * Called at the end of global googletag setup, so set the global targeting.
     * You must return an array of keyvalue to set in googletag.pubads().setTargeting(k, v);
     */
    handleGetExternalKeyvalues?(): Promise<Record<string, string>>;

    /**
     * Called everytime a new slot is created from googletag.
     * You should not run any async process or long process here. This is meant for instant sync callback.
     * If you want to make heavier/async process to the created slots, please implement the handleAllSlotsCreated() hook instead
     * (and mind using Promise.all() to run aync process in parallel)
     */
    handleSlotCreated?(adSlotData: AdSlotData): void; 
    
    /**
     * Called after all slots have been created after a pageload/reset/swipe
     * (mind using Promise.all() to run aync processes in parallel if you have async process for each slot)
     */
    handleAllSlotsCreated?(adSlotsData: AdSlotData[]): Promise<void>;

    /**
     * Called right before calling/rendering ads (googletag.pubads().refresh())
     * You should add here any step that should be awaited before calling ads sur as header bidding response.
     */
    handleBeforeCallingAds?(): Promise<void>;
}

/**
 * example
 * filterHooks('handleBeforeGoogletagInit', [
 *      {
 *          handleBeforeGoogletagInit(){return Promise.resolve()},
 *          handleDestroyAllSlots(){return Promise.resolve()},
 *      }, {
 *          handleBeforeGoogletagInit(){return Promise.resolve()},
 *          handleDestroyAllSlots(){return Promise.resolve()},
 *      }, 
 *      {
 *          handleNewSlotCreated(){return Promise.resolve()},
 *          handleDestroyAllSlots(){return Promise.resolve()},
 *      }, 
 *  ]).forEach(e => e.handleBeforeGoogletagInit())
 */
export function filterHooks<
    T extends keyof IAdvertisingLifecycleHook
>(
    hookName: T, 
    hooks: IAdvertisingLifecycleHook[]
): Required<Pick<IAdvertisingLifecycleHook, T>>[] {
    return hooks.filter(h => typeof h[hookName] === 'function') as Required<Pick<IAdvertisingLifecycleHook, T>>[];
}

