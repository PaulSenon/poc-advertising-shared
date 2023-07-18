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

// MOCK BIDDERS CONFIG PROVIDER (could be yieldbird ?)
function fetchBiddersConfig(): Promise<Bid[]> {
    return Promise.resolve([
        { // TODO: missing specs, fake bidder
            "bidder": "my-super-bidder",
            "params": {
                "toto": "titi",
            }
        }
    ])
}

/**
 * This is a Prebid service class wrapper so it's well isolated from the ad core
 */
export default class Prebid {
    private adUnits: AdUnitConfig[] = [];
    private biddersConfig: Bid[] = [];

    public constructor(private readonly isDebug = false) {

    }

    /**
     * Prebid initial setup (define api/load scripts)
     */
    public async init(): Promise<void> {
        this.definePrebidApi();
        this.biddersConfig = await fetchBiddersConfig();
    }

    /**
     * Recycle prebid (like init but with a clean first)
     */
    public reset(): Promise<void> {
        this.adUnits = [];
        window.pbjs.initAdserverSet = false;
        // ref: https://docs.prebid.org/dev-docs/publisher-api-reference/removeAdUnit.html
        window.pbjs.removeAdUnit();
        return Promise.resolve();
    }

    /**
     * Define the prebid API if needed
     */
    public definePrebidApi(): void {
        window.pbjs = window.pbjs || { que: [] };
    }

    /**
     * /!\ must be run in googletag.cmd.push context /!\
     * 
     * Run bids and resolves when bidders timedout or when bid successful. 
     * Should await this promise before calling ads (googletag.pubads().refresh())
     * You might want to timeout this promise anyway.
     */
    public runBids(): Promise<void> {
        // setup prebid global config
        window.pbjs.setConfig({
            debug: this.isDebug || false,
            cache: {
                url: false
            },
        });

        // setup prebid adUnits config
        window.pbjs.addAdUnits(this.adUnits);

        // promisify bid run
        const biddingPromise: Promise<void> = new Promise(resovle => {
            window.pbjs.que.push(() => {
                window.pbjs.requestBids({
                    timeout: 1000, // TODO: const
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

        return biddingPromise;
    }

    public addAdUnit(data: {
        id: string,
        sizes: number[] | number[][],
        pos?: AdPosition, 
    }): void {
        this.adUnits.push({
            code: data.id,
            mediaTypes: {
                banner: {
                    sizes: data.sizes,
                    pos: data.pos || AdPosition.UNKNOWN,
                }
            },
            bids: this.biddersConfig
        })
    }
}