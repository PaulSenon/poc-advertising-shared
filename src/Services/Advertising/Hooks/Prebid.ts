import IAdvertisingLifecycleHook, { AdSlotData } from "../IAdvertisingLifecycleHook";

declare global {
    interface Window {
        pbjs: { 
            que: Array<() => void>,
            initAdserverSet?: boolean,
            requestBids: any,
            setTargetingForGPTAsync: any,
            setConfig: any,
            addAdUnits: any,
            removeAdUnit: any,
        };
    }
}

// ref: https://docs.prebid.org/dev-docs/adunit-reference.html#adUnit.mediaTypes.banner
enum AdPosition {
    UNKNOWN = 0,
    ATF = 1,
    BTF = 2,
    HEADER = 4,
    FOOTER = 5,
    SIDEBAR = 6,
    FULLSCREEN = 7,
}

// ref: https://docs.prebid.org/dev-docs/adunit-reference.html#adunitmediatypesbanner
type MediaTypeBanner = {
    sizes: number[] | number[][];
    pos?: number & AdPosition;
    name?: string,
}

// ref: https://docs.prebid.org/dev-docs/adunit-reference.html#adunit
type AdUnitConfig = {
    code: string,
    mediaTypes: { banner: MediaTypeBanner }
    bids: Bid[],
}

type Bid = {
    bidder: string,
    params: Record<string, string|number>,
}

export default class Prebid implements IAdvertisingLifecycleHook {
    private adUnits: AdUnitConfig[] = [];

    public constructor(private readonly isDebug = false) {

    }

    public handleBeforeGoogletagInit(): Promise<void> {
        this.definePrebidApi();
        return Promise.resolve();
    }

    public handleDestroyAllSlots(): Promise<void> {
        this.adUnits = [];
        window.pbjs.initAdserverSet = false;
        // ref: https://docs.prebid.org/dev-docs/publisher-api-reference/removeAdUnit.html
        window.pbjs.removeAdUnit();
        return Promise.resolve();
    }

    public definePrebidApi(): void {
        window.pbjs = window.pbjs || { que: [] };
    }

    /**
     * /!\ must be run in googletag.cmd.Push context
     * you should start doing ad calls with googletag.pubads().refresh(); when it resolves
     * you might want to timeout this anyway
     */
    public handleBeforeCallingAds(): Promise<void> {
        // setup prebid global config
        window.pbjs.setConfig({
            debug: this.isDebug || false,
            cache: {
                url: false
            },
        });
        // setup prebid adUnits config
        window.pbjs.addAdUnits(this.adUnits);

        const biddingPromise: Promise<void> = new Promise(resovle => {
            window.pbjs.que.push(() => {
                window.pbjs.requestBids({
                    timeout: 1000, // todo const
                    bidsBackHandler: () => {
                        if (window.pbjs.initAdserverSet) return;
    
                        window.pbjs.que.push(() => {
                            window.pbjs.setTargetingForGPTAsync();
                            resovle();
                        });
    
                        window.pbjs.initAdserverSet = true;
                    }
                });
            });
        });
        // await new Promise(resolve => setTimeout(resolve, 500))

        return biddingPromise;
    }

    public handleAllSlotsCreated(adSlotsData: AdSlotData[]): Promise<void> {
        this.adUnits = adSlotsData.map(data => ({
            code: data.slot.getSlotElementId(),
            mediaTypes: {
                banner: {
                    sizes: data.config.sizes,
                    pos: undefined, // TODO
                }
            },
            bids: [{
                "bidder": "ogury",
                "params": {
                }
            }]
        }));

        return Promise.resolve();
    }
}