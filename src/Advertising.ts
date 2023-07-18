import BreakPointDetector from "./BreakPointDetector";
import InView from "./InView";
import LegacyWallpaper from "./LegacyWallpaper";
import SwiperController from "./Swiper";
import { AdSlotKind, adSlotsTargetingConfig, isValidAdSlotKind } from "./adSlotConfig";
import Prebid from './Prebid';
import IAdvertisingKeyvalueProvider from "./IAdvertisingKeyvalueProvider";

/**
 * LEXIQUE:
 *   - "adSlot" => the slot instance managed by googletag (returned by googletage.defineSlot())
 *   - "adElement" => the HTMLElement containing the ad (class ".advertising.js-adzone")
 */

/**
 * AD SLOT DOM CONFIG:
 *   - classes to style:
 *     - class ".offscreen-adzone" => (you should style it) MUST display: none!important => will load wihtout waiting for lazyload
 *     - class ".advertising--requested" => (you can style it) automatically added when an ad has been requested (does not mean it's loaded nor rendered)
 *     - class ".advertising--loaded" => (you can style it) automatically added when an ad has been loaded (does not means it's rendered yet)
 *     - class ".advertising--rendered" => (you can style it) automatically added when an ad has been rendered (can be empty if not ad inventory)
 *     - class ".advertising--empty-slot" => (you can style it) automatically added when an ad has been rendered but slot is still empty
 *     - class ".advertising--viewed" => automatically set when it counts as a "viewed" ad (you might want to find all ads .advertising--loaded:not(.advertising--viewed) to detect viewability issues)
 *     - class ".advertising--is-atf" => automatically set when an ad is called above the fall
 *   - classes to use
 *     - class ".advertising.js-adzone" => required, identify ad slots.
 *   - any style display:none => will ignore ad
 *   - id => must NOT be defined
 *   - data-ad-id => required, must be unique in slide ()
 *   - data-ad-type => required, type from AdSlotKind enum (e.g. "leaderboard")
 *   - data-ad-position => required, index of the ad (per ad-type, inside on slide) // TODO: is is usefull ???? shall we rename in ad-index ?
 */

type Stats = {
    startTimeMs: number;
    endTimeMs: number;
    timeoutMs: number;
}
class StatsCollector {
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
        for (const [key, values] of this.statsBag) {
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

function buildStatsAndToWrapper(collector: StatsCollector, defaultTimeoutMs: number) {
    return async <V, T extends Promise<V>>(id: string, promiseRunner: () => T, timeoutMs = defaultTimeoutMs): Promise<{res?: V, hasTimedout: boolean}> => {
        const promise = wrapStatsCollector(promiseRunner, id, collector, timeoutMs);
        return wrapTimeout(promise, timeoutMs);
    }
}

// async function wrapStatsAndTo<V, T extends Promise<V>>(promiseRunner: () => T, params: {
//     id: string,
//     timeoutMs: number,
//     collector: StatsCollector,
// }): Promise<{res?: V, hasTimedout: boolean}> {
//     const promise = wrapStatsCollector(promiseRunner, params.id, params.collector);
//     return wrapTimeout(promise, params.timeoutMs);
// }

function wrapStatsCollector<T extends Promise<unknown>>(promiseRunner: () => T, id: string, collector: StatsCollector, timeoutMs: number): T {
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

async function wrapTimeout<T>(promise: Promise<T> | undefined, timeout: number, ): Promise<{res?: T, hasTimedout: boolean}> {
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

declare global {
    interface Window {
      googletag?: typeof googletag;
    }
}

type AdvertisingConfig = {
    fullAdUnit: string; // TODO must be build php side (does not exists yet)
    keyValues?: Record<string, string>;
    lazyLoadOffsetPx?: number;
    usePrebid?: boolean;
}

type AdSlotConfig = {
    adId: string, 
    adPosition: number,
    adType: keyof typeof AdSlotKind,
    sizes: [number, number][],
    keyvalues: Map<string, string>,
}

export default class Advertising {
    private prebid?: Prebid;
    private keyvalueProviders: IAdvertisingKeyvalueProvider[] = [];
    private readonly statsCollector = new StatsCollector();
    private static readonly DEFAULT_TIMEOUT_MS = 200 as const;
    private wrapPromise; // complexe type infered at construct

    constructor(
        private _config: AdvertisingConfig
    ) {
        if (_config.usePrebid) {
            this.prebid = new Prebid(true);
        }

        this.wrapPromise = buildStatsAndToWrapper(this.statsCollector, Advertising.DEFAULT_TIMEOUT_MS);
    }

    public get config() { return this._config}

    public async init(): Promise<void> {
        // no ads for bots
        // if (isBot) return; // TODO

        const startTimeMs = Date.now();
        const promises: Promise<unknown>[] = [];
        // setup wallpaper legacy stuff
        LegacyWallpaper.init(); // TODO refactor this shit
        // define global googletag API
        this.defineGooletagApi();
        // init prebid if defined
        promises.push(this.initPrebid());
        // configure googletag
        this.configureGoogletag();
        // register googletag.pubads() listeners once for all
        this.registerListerners();
        // set keyvalues
        promises.push(this.setGlobalKeyvalues());
        // create all ad slots
        this.createAllAdSlots();
        // await init promises in parallel
        await Promise.all(promises);

        // eventually trigger ads
        await this.triggerAds();

        // log perfs
        const deltaTime = Date.now() - startTimeMs;
        console.debug(`Total blocking time before calling ads: ${deltaTime}ms.`);
    }

    private async initPrebid(): Promise<void> {
        if (this.prebid !== undefined)  {
            const prebid2 = this.prebid; // because type inference is shit here
            const { hasTimedout } = await this.wrapPromise('prebid.init', () => prebid2.init());
            if (hasTimedout) {
                console.warn(`Prebid init has timedout, brebid is disabled.`);
            }
        }
    }
    private async resetPrebid(): Promise<void> {
        if (this.prebid !== undefined)  {
            const prebid2 = this.prebid; // because type inference is shit here
            const { hasTimedout } = await this.wrapPromise('prebid.reset', () => prebid2.reset());
            if (hasTimedout) {
                console.warn(`Prebid reset has timedout, brebid is disabled.`);
            }
        }
    }
    
    public async reset(): Promise<void> {
        // no ads for bots
        // if (isBot) return; // TODO

        const startTimeMs = Date.now();
        // cleat stats
        this.statsCollector.clear();

        const promises: Promise<unknown>[] = [];

        // clean wallpaper legacy stuff
        LegacyWallpaper.clean(); // TODO refactor this shit
        // destroy all ad slots
        this.destroyAllAdSlots();
        // reset prebid
        promises.push(this.resetPrebid());
        // rewrite global ad config
        // TODO how ??
        // set keyvalues
        promises.push(this.setGlobalKeyvalues());
        // create all ad slots
        this.createAllAdSlots();
        // await init promises in parallel
        await Promise.all(promises);

        // eventually trigger ads
        await this.triggerAds();

        // log perfs
        const deltaTime = Date.now() - startTimeMs;
        console.debug(`Total blocking time before calling ads: ${deltaTime}ms.`);
    }

    private static getAdSlotConfig(adElement: HTMLElement): AdSlotConfig | undefined {
        try {
            const adType = adElement.getAttribute('data-ad-type');
            if (!adType) throw Error(`dataAttribute data-ad-type is missing for adElement ${adElement.outerHTML}`);
            if (!isValidAdSlotKind(adType)) throw Error(`dataAttribute data-ad-type="${adType}" is not a valid value ${adElement.outerHTML}`)

            const adPositionStr = adElement.getAttribute('data-ad-position');
            if (!adPositionStr) throw Error(`dataAttribute data-ad-position is missing for adElement ${adElement.outerHTML}`);
            const adPosition = parseInt(adPositionStr, 10);
            if(isNaN(adPosition)) throw Error(`dataAttribute data-ad-position is not a number ${adElement.outerHTML}`);

            const breakpoint = BreakPointDetector.getCurrentBreakpoint();

            const adId = adElement.getAttribute('id');
            if (!adId) throw Error(`element id is missing for adElement ${adElement.outerHTML}`);

            // get static tageting config for ad type
            const targetingConfig = adSlotsTargetingConfig[adType]
            if (!targetingConfig) throw Error(`no targeting config found for ad type "${adType}": ${adElement.outerHTML}`);
            // get sizes based on current breakpoint
            const breakpointSizes = targetingConfig.sizes[breakpoint];
            if(!breakpointSizes) {
                console.log(`adSlot has not sizes for the current breakpoint: ${breakpoint}: ${adElement.outerHTML}`);
                return;
            }

            // build slot specific keyvalues
            const keyvalues = Advertising.getSlotSpecificKeyvalues(adElement);

            return {
                adId, 
                adPosition,
                adType,
                sizes: breakpointSizes,
                keyvalues,
            }

        } catch (e) {
            console.error(`ad configuration skipped for element ${adElement.outerHTML}:\n`, e);
        }
    }

    private static getSlotSpecificKeyvalues(adElement: HTMLElement): Map<string, string> {
        // dynamic atf detection
        const isAtf = Advertising.isAtf(adElement);    

        // build slot specifi keyvalues
        const keyvalues = new Map();
        keyvalues.set('posn', isAtf ? 'atf' : 'btf');

        return keyvalues;
    }

    private static getGlobalKeyvalues(config: AdvertisingConfig): Map<string, string> {

        // dyanmic debug
        const dfptValue = 'wallpaper' || new URLSearchParams(window.location.search.toLowerCase()).get('dbg');

       
        const globalKeyvalues = config.keyValues || {};
        const keyvalues = new Map(Object.entries(globalKeyvalues));
        if (dfptValue && Math.random() > 0.5) keyvalues.set('dfpt', dfptValue); // TODO: remove random

        return keyvalues;
    }

    private static isAtf(adElement: HTMLElement): boolean {
        const isAtf = InView.isVisiblePercent(adElement, .5);
        if (isAtf) adElement.classList.add('advertising--is-atf');
        return isAtf
    }

    /**
     * Bind handlers to googletag ads events.
     * This can be done once for all because handlers are stateless.
     * (= we don't have to unregister/register again handlers at each reset/swipe)
     */
    private registerListerners(): void {
        googletag.cmd.push(() => {
            googletag.pubads().addEventListener('slotRequested', (event) => this.handleSlotRequested(event));
            googletag.pubads().addEventListener('slotOnload', (event) => this.handleSlotOnLoad(event));
            googletag.pubads().addEventListener('slotRenderEnded', (event) => this.handleSlotRenderEnded(event));
            googletag.pubads().addEventListener('impressionViewable', (event) => this.handleImpressionViewable(event));
        })
    }

    /** (i) when an ad is requested, it does NOT impact viewability */
    private handleSlotRequested(event: googletag.events.SlotRequestedEvent): void {
        console.debug('slot requested', document.getElementById(event.slot.getSlotElementId()))
        const adElement = document.getElementById(event.slot.getSlotElementId());
        adElement?.classList.add('advertising--requested');
    }
    
    /** (i) when an ad is loaded, it impact viewability */
    private handleSlotOnLoad(event: googletag.events.SlotOnloadEvent): void {
        console.debug('slot loaded', document.getElementById(event.slot.getSlotElementId()))
        const adElement = document.getElementById(event.slot.getSlotElementId());
        adElement?.classList.add('advertising--loaded');
    
    }

    private handleSlotRenderEnded(event: googletag.events.SlotRenderEndedEvent): void {
        const adElement = document.getElementById(event.slot.getSlotElementId());
        adElement?.classList.add('advertising--rendered');
        if (event.isEmpty) {
            adElement?.classList.add('advertising--empty-slot');
        }
    }

    private handleImpressionViewable(event: googletag.events.ImpressionViewableEvent): void {
        const adElement = document.getElementById(event.slot.getSlotElementId());
        adElement?.classList.add('advertising--viewed');
    }

    /**
     * Use this so rewrite config (e.g. between swipe)
     * /!\ After this, you have to load it. 
     *     Just seting it has no effect if you don't use it afterward /!\
     */
    public setConfig(config: AdvertisingConfig): void {
        this._config = config;
    }

    /**
     * Restore everything on our side and googletag side to destroy/reset/unload everything we can.
     *   1 - restore desired adSlot Ids (from data-ad-id)
     *   2 - redefine adSlots with googletag
     */
    private destroyAllAdSlots(): void {
        // 1) remove old slot ids
        googletag.cmd.push(() => {
            // get all current adSlot elements from googletag
            const oldAdElements = googletag.pubads()
                .getSlots()
                .map(s => document.getElementById(s.getSlotElementId()));

            // reset our stuff on elements
            for (const adElement of oldAdElements) {
                if (!adElement) continue;
                Advertising.removeCutomHtmlFromAdElement(adElement);
            }

            // reset everything from googletag side (adSlots & global keyValues)
            googletag.destroySlots();
            googletag.pubads().clearTargeting();

            // At this point the page is reset, to display new ad you have to:
            //  1 - restore desired adSlot Ids (from data-ad-id)
            //  2 - redefine adSlots with googletag
            // (Mind that you do not need to reconfigure googletag config. This is not reset.)
        });
    }

    /**
     * - Create all adslot for all advertising div in active-slide and outside swiper
     * - configure googletag.pubads()
     * - display ads
     * 
     * (i) native googletag lazyload is enabled so display ads is behaving smartly :)
     */
    private createAllAdSlots(): void {
        // get all (active) ad containers
        const querySelectorOutsideSwiper = SwiperController.buildClassSelectorOutsideSwiper('advertising'); // TODO: optim: could be done at init only
        const querySelectorInsideActiveSlide = SwiperController.buildClassSelectorInsideActiveSlide('advertising');
        const adElementsToEnable = [
            ...document.querySelectorAll(querySelectorOutsideSwiper),
            ...document.querySelectorAll(querySelectorInsideActiveSlide)
        ] as HTMLElement[];
        console.dir(adElementsToEnable); // TODO: remove

        // do googletag stuff
        googletag.cmd.push(async () => {
            // 1) create all adSlots
            const adSlots: googletag.Slot[] = [];
            for (const adElement of adElementsToEnable) {
                const adSlot = this.googletagCreateAdSlot(adElement);
                if (!adSlot) continue;
                adSlots.push(adSlot);
            }
        });
    }

    private triggerAds(): Promise<void> {
        return new Promise(resolve => {
            googletag.cmd.push(async () => {
                // 1) tell googletag everything is configured
                googletag.enableServices(); 
        
                // 2) await bidding if prebid
                if (this.prebid) {
                    const prebid2 = this.prebid;
                    const { hasTimedout } = await this.wrapPromise('prebid.runBids', () => prebid2.runBids(), 1000);
                    if (hasTimedout) console.warn('Prebid is awtivated but has been timedout after 3s by Advertising.ts');
                }
        
                // 3) trigger ad calls
                googletag.pubads().refresh(); // necessarry because "disableInitialLoad()""

                return resolve();
            })
        });
    }

    private configureGoogletag(): void {
        googletag.cmd.push(() => {
            // global config
            let lazyLoadOffset = this.config.lazyLoadOffsetPx;
            if(typeof lazyLoadOffset !== "number") lazyLoadOffset = 200;
            googletag.pubads().enableLazyLoad({
                fetchMarginPercent: -1,
                renderMarginPercent: lazyLoadOffset,
                mobileScaling: 1.0,
            });
            googletag.pubads().enableSingleRequest();
            googletag.pubads().disableInitialLoad();
        });
    }

    private setGlobalKeyvalues(): Promise<void> {
        return new Promise(resolve => {
            googletag.cmd.push(async () => {
                // set global targeting (a.k.a keyvalues)
                // static targeting (a.k.a keyvalues)
                const globalKeyvalues = Advertising.getGlobalKeyvalues(this.config);
                for(const [key, value] of globalKeyvalues) {
                    googletag.pubads().setTargeting(key, value);
                }

                //thirdparties targeting (a.k.a keyvalues)
                const setTpTargetingPromises = this.keyvalueProviders.map(async provider => {
                    // we create a promise that always setTargeting in then, 
                    // so even when it times out, it still eventually set the 
                    // targeting value for the subsequent ad calls
                    const key = provider.getAdvertisingKvKey();
                    const providerName = provider.constructor.name;
                    let hasTimedout = false;
                    const res = await this.wrapPromise(providerName, () => provider.getAdvertisingKvValue().then((value) => {
                        googletag.pubads().setTargeting(key, value);
                        if (hasTimedout) {
                            console.debug(`The Thirdparty Keyvalue provider [${providerName}] for the keyvalue [${key}] eventually resolved after timeout [${Advertising.DEFAULT_TIMEOUT_MS}ms].`)
                        }
                    }));
                    hasTimedout = res.hasTimedout;
                    if (hasTimedout) {
                        console.warn(`The Thirdparty Keyvalue provider [${providerName}] for the keyvalue [${key}] has been timed out [${Advertising.DEFAULT_TIMEOUT_MS}ms] but will continue run in background and asynchonously set keyvalues when it eventually resolves.`)
                    }
                })
                await Promise.all(setTpTargetingPromises);
                return resolve();
            })
        });
    }

    /**
     * /!\ MUST BE IN CALLED INSIDE googletag.cmd.push() context
     */
    private googletagCreateAdSlot(adElement: HTMLElement): googletag.Slot | undefined {
        // set adElement Id
        Advertising.loadAndSetHtmlIdForAdElement(adElement);

        // retrieve adSlotConfig
        const slotConfig = Advertising.getAdSlotConfig(adElement);
        if (!slotConfig) return;

        // skip slot if not visible (and if not supposed to be so)
        if (!Advertising.isOffscreenAd(adElement) && 
            !Advertising.isVisible(adElement)
        ) {
            console.debug('skipped ad because hidden', adElement)
            return;
        }

        // skip slot if empty sizes (means it disable for this breakpoint)
        if (slotConfig.sizes.length <= 0) {
            adElement.classList.add('u-hide-for-all');
            return;
        }
    
        // define adSlot
        const adSlot = googletag.defineSlot(this.config.fullAdUnit, slotConfig.sizes, slotConfig.adId)!
        for (const [key, value] of slotConfig.keyvalues) {
            adSlot.setTargeting(key, value);
        }
        adSlot.addService(googletag.pubads());

        // configure adSlot for prebid
        this.prebid?.addAdUnit({
            id: slotConfig.adId,
            sizes: slotConfig.sizes,
            // pos: TODO but need to have complex rules in getAdSlotConfig()
        });
    }

    /**
     * Remove id
     * Remove added classes
     */
    private static removeCutomHtmlFromAdElement(adElement: HTMLElement): void {
        // 1) remove id
        const id = adElement.getAttribute('id');
        if (id) {
            adElement.removeAttribute('id');
            if (!adElement.hasAttribute('data-ad-id')) {
                adElement.setAttribute('data-ad-id', id);
            }
        }

        // 2) remove added classes
        adElement.classList.remove('advertising--rendered');
        adElement.classList.remove('advertising--empty-slot');
        adElement.classList.remove('advertising--called');
    }

    /**
     * Set id from data-ad-id attribute
     */
    private static loadAndSetHtmlIdForAdElement(adElement: HTMLElement): void {
        const id = adElement.getAttribute('data-ad-id');
        if (!id) {
            console.warn('missing data-ad-id for adElement', adElement);
            return;
        }
        adElement.setAttribute('id', id);
    }

    private defineGooletagApi(): void {
        window.googletag = window.googletag || { cmd: [] };
    }

    private static isVisible(adElement: HTMLElement): boolean {
        return adElement.offsetParent !== null;
    }

    private static isOffscreenAd(adElement: HTMLElement): boolean {
        return adElement.classList.contains('offscreen-adzone');
    }

    public addKeyvalueProvider(provider: IAdvertisingKeyvalueProvider): void {
        this.keyvalueProviders.push(provider);
    }

    public logStats(): void {
        console.debug(this.statsCollector.toString())
    }
}