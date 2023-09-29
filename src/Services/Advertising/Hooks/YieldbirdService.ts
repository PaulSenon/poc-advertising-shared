import IService from "../../IService";
import IAdvertisingLifecycleHook, { AdSlotData } from "../IAdvertisingLifecycleHook";

//////////////////////////////////
// Mocking Quickwrap
//////////////////////////////////
interface QW {
    cmd: (() => void)[],
    adUnitMapper?(slots: googletag.Slot[]): void;
    fetchAdUnits?(): Promise<void>;
}

declare global {
    interface Window {
        Quickwrap: QW
    }
}

window.Quickwrap = {
    cmd: [],
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
    private qw?: QW;

    // automatically called at page load 
    // this method will be handled by our core framework so we are sure it
    // resolved before anything else is run (e.g. the hook methods implemented below)
    public async init(): Promise<void> {
        console.debug('Yieldbird: init()');

        // make sure window.Quickwrap.cmd queue is defined
        this.setWindowApiObject();
        
        // load quickwrap (resolves with a ready qw instance)
        this.qw = await this.loadQw();
    }

    // automatically called and awaited at page reset (SPA page change (using swiper))
    public reset(): Promise<void> {
        console.debug('TODO: Yieldbird: reset()')
        return Promise.resolve();
    }


    // hook when all slots are created for googletag
    public async handleAllSlotsCreated(adSlotsData: AdSlotData[]): Promise<void> {
        const slots = adSlotsData.map(data => data.slot);
        this.qw?.adUnitMapper?.(slots);
    }

    // hook right before calling ads (pubads.refesh())
    public async handleBeforeCallingAds(): Promise<void> {
        await this.qw?.fetchAdUnits?.();
    }

    /**
     * Defined window.Quickwrap cmd queue if not defined;
     */
    private setWindowApiObject(): void {
        window.Quickwrap = window.Quickwrap || {};
        window.Quickwrap.cmd = window.Quickwrap.cmd || [];
    }

    /**
     * Loads qw.js and resolve window.Quickwrap when it's fully ready
     */
    private async loadQw(): Promise<QW> {
        return new Promise((resolve) => {
            // TODO: find a way to detect when window.Quickwrap is ready (sub to global event or define global method or something)
            // As a suggestion I guess we can just queue up a callback for Quickwrap to call and if will be called when everything is ready ?
            // => window.Quickwrap.cmd.push(() => resolve(window.Quickwrap));
            // but as we have no read qw in this poc, I will just resolve my mock to provide don't stay in pending state for our tests:
            return resolve(window.Quickwrap);

            // example of how we could load the tag if qw is no longer a mock:
            // const scriptTag = document.createElement('script');
            // scriptTag.defer = true;
            // scriptTag.id = 'yieldbirdQuickwrapTag'
            // scriptTag.src = '[...]/qw.js'
            // scriptTag.onerror = reject;

            // document.head.appendChild(scriptTag);
        })
    }
}