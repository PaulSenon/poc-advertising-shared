import IService from "../../IService";
import IAdvertisingLifecycleHook, { AdSlotData } from "../IAdvertisingLifecycleHook";

//////////////////////////////////
// Mocking Quickwrap
//////////////////////////////////
interface QW {
    adUnitMapper(slots: googletag.Slot[]): void;
    fetchAdUnits(): Promise<void>;
}

declare global {
    interface Window {
        Quickwrap: QW
    }
}

window.Quickwrap = {
    adUnitMapper(slots: googletag.Slot[]): void {
        console.debug('QW: Adding slots:', slots);
    },
    fetchAdUnits(): Promise<void> {
        console.debug('QW: fetching data');
        return new Promise(resolve => setTimeout(resolve, 100));
    }
}
//////////////////////////////////

export default class YieldbirdService implements IService, IAdvertisingLifecycleHook {

    // automatically called at page load
    public init(): Promise<void> {
        console.debug('TODO: Yieldbird: init()')
        return Promise.resolve();
    }

    // automatically called at page reset (SPA page change (using swiper))
    public reset(): Promise<void> {
        console.debug('TODO: Yieldbird: reset()')
        return Promise.resolve();
    }


    // hook when all slots are created for googletag
    public async handleAllSlotsCreated(adSlotsData: AdSlotData[]): Promise<void> {
        const slots = adSlotsData.map(data => data.slot);
        window.Quickwrap.adUnitMapper(slots);
    }

    // hook right before calling ads (pubads.refesh())
    public async handleBeforeCallingAds(): Promise<void> {
        await window.Quickwrap.fetchAdUnits();
    }
}