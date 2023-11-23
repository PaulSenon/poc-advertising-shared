import IAdvertisingLifecycleHook, { AdSlotData } from "../IAdvertisingLifecycleHook";
import IService from "../../IService";

//////////////////////////////////
// Mocking Quickwrap
//////////////////////////////////
interface QW {
    cmd: (() => void)[],
    adUnitMapper?(slots: googletag.Slot[]): void;
    fetchAdUnits?(): Promise<void>;
}

interface YbConfiguration {
   integrationMethod: string;
   smartRefreshDisabled: boolean; 
}

interface Yieldbird {
    cmd: (() => void)[],
}

declare global {
    interface Window {
        Quickwrap: QW,
        ybConfiguration: YbConfiguration,
        Yieldbird: Yieldbird,
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
        this.setWindowApiObjects();
        
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
        console.debug('Sending all slots to Quickwrap:', adSlotsData);
        const slots = adSlotsData.map(data => data.slot);
        this.qw?.adUnitMapper?.(slots);
    }

    // hook right before calling ads (pubads.refesh())
    public async handleBeforeCallingAds(): Promise<void> {
        console.debug('Do bidding...');
        await this.qw?.fetchAdUnits?.();
        console.debug('Bidding done !');
    }

    /**
     * Defined window.Quickwrap cmd queue if not defined;
     */
    private setWindowApiObjects(): void {
        window.Quickwrap = window.Quickwrap || {};
        window.Quickwrap.cmd = window.Quickwrap.cmd || [];
        window.ybConfiguration = window.ybConfiguration || {};
        window.ybConfiguration = { 
            integrationMethod: 'open_tag', 
            smartRefreshDisabled: true 
        };
        window.Yieldbird = window.Yieldbird || {};
        window.Yieldbird.cmd = window.Yieldbird.cmd || [];
    }

    /**
     * Loads qw.js and resolve window.Quickwrap when it's fully ready
     */
    private async loadQw(): Promise<QW> {
        return new Promise((resolve, reject) => {
            window.Quickwrap.cmd.push(() => {
                console.debug('Quickwrap loaded');
                return resolve(window.Quickwrap);
            })
            
            if(document.getElementById('yieldbirdQuickwrapTag')) {
                console.warn('Quickwrap script already loaded');
                return; // will eventually resolve because of pushed resolve above
            }

            const scriptTag = document.createElement('script');
            scriptTag.id = 'yieldbirdQuickwrapTag'
            scriptTag.defer = true;
            scriptTag.src = '//cdn.qwtag.com/6cf02e9d-7075-4c1d-bed3-449eaa57128d/qw.js';
            scriptTag.onerror = e => reject({message: 'failed to load qw.js', error: e});
            document.head.appendChild(scriptTag);
        })
    }
}