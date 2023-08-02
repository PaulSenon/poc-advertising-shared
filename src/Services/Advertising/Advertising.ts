import { AdSlotKind, adSlotsTargetingConfig, isValidAdSlotKind } from "../../config/adSlotConfig";
import BreakPointDetector from "../../utils/BreakPointDetector";
import InView from "../../utils/InView";
import StatsCollector from "../../utils/StatsCollector";
import SwiperController from "../Swiper";
import { AdsLifecycleHooksRunner } from "./AdsLifecycleHooksRunner";
import IAdvertisingLifecycleHook from "./IAdvertisingLifecycleHook";
import LegacyWallpaper from "./LegacyWallpaper";


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

declare global {
    interface Window {
      googletag?: typeof googletag;
    }
}

type AdvertisingConfig = {
    fullAdUnit: string; // TODO must be build php side (does not exists yet)
    keyValues?: Record<string, string>;
    lazyLoadOffsetPx?: number;
}

export type AdSlotConfig = {
    adId: string, 
    adPosition: number,
    adType: keyof typeof AdSlotKind,
    sizes: [number, number][],
    keyvalues: Map<string, string>,
}

export default class Advertising {
    private readonly statsCollector = new StatsCollector();
    private safeHooksManager: AdsLifecycleHooksRunner;

    constructor(
        private _config: AdvertisingConfig,
        hooks: IAdvertisingLifecycleHook[] = [],
    ) {
        this.safeHooksManager = new AdsLifecycleHooksRunner(hooks, this.statsCollector);
    }

    public get config() { return this._config}

    public async init(): Promise<void> {
        // no ads for bots
        if (Advertising.isBot()) return;

        // stats setup
        const startTimeMs = Date.now();

        // setup wallpaper legacy stuff
        LegacyWallpaper.init(); // TODO refactor this shit
        // define global googletag API
        this.defineGooletagApi();

        // [HOOK]: before googletag init
        await this.safeHooksManager.runHooksBeforeGoogleTagInit();

        // configure googletag
        this.configureGoogletag();
        // register googletag.pubads() listeners once for all
        this.registerListerners();

        // set keyvalues
        await this.setGlobalKeyvalues();
        // create all ad slots
        await this.createAllAdSlots();

        // eventually trigger ads
        await this.triggerAds();

        // log perfs
        const deltaTime = Date.now() - startTimeMs;
        console.debug(`Total blocking time before calling ads: ${deltaTime}ms.`);
    }
    
    public async reset(): Promise<void> {
        // no ads for bots
        if (Advertising.isBot()) return;

        // stats setup
        const startTimeMs = Date.now();
        this.statsCollector.clear();

        // [HOOK]: before destroy all slots
        await this.safeHooksManager.runHooksDestroyAllSlots();

        // clean wallpaper legacy stuff
        LegacyWallpaper.clean(); // TODO refactor this shit
        // destroy all ad slots
        this.destroyAllAdSlots();

        // rewrite global ad config
        // TODO how ??

        // set keyvalues
        await this.setGlobalKeyvalues();
        // create all ad slots
        await this.createAllAdSlots();

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
     * Use this so rewrite config keyvalues (e.g. between swipe)
     * /!\ After this, you have to load it. 
     *     Just seting it has no effect if you don't use it afterward /!\
     */
    public setKeyvalues(keyvalues: Record<string, string>): void {
        this._config.keyValues = keyvalues;
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
    private createAllAdSlots(): Promise<void> {
        return new Promise(resolve => {
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
                const adSlotsInfos: {slot: googletag.Slot, element: HTMLElement, config: AdSlotConfig}[] = [];
                for (const adElement of adElementsToEnable) {
                    const slotInfos = this.googletagCreateAdSlot(adElement);
                    if (!slotInfos) continue;
                    adSlotsInfos.push(slotInfos);
                }

                // [HOOK] handleAllSlotCreated
                await this.safeHooksManager.runHooksAllSlotsCreated(adSlotsInfos.map(i => ({
                    slot: i.slot,
                    element: i.element,
                    config: i.config,
                })));

                return resolve();
            });
        });
    }

    private triggerAds(): Promise<void> {
        return new Promise(resolve => {
            googletag.cmd.push(async () => {
                // 1) tell googletag everything is configured
                googletag.enableServices(); 
        
                // 2) [HOOK]: before calling ads
                await this.safeHooksManager.runHooksBeforeCallingAds();
        
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
                    googletag.pubads().setTargeting(key, value.toString());
                }
                
                // HOOK: getExternalKeyvalues
                await this.safeHooksManager.runHooksExternalKeyvalues((kv) => {
                    for(const [key, value] of Object.entries(kv)) {
                        googletag.pubads().setTargeting(key, value);
                    }
                });

                return resolve();
            })
        });
    }

    /**
     * /!\ MUST BE IN CALLED INSIDE googletag.cmd.push() context
     */
    private googletagCreateAdSlot(adElement: HTMLElement): {slot: googletag.Slot, element: HTMLElement, config: AdSlotConfig} | undefined {
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

        // [HOOK] (sync) handleSlotCreated
        this.safeHooksManager.runHooksSlotCreated({
            element: adElement,
            slot: adSlot,
            config: slotConfig
        });

        return {
            slot: adSlot,
            element: adElement,
            config: slotConfig,
        }
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

    public getStatsCollector(): StatsCollector {
        return this.statsCollector;
    }

    private static isBot(): boolean { // TODO move in browser detection class helpers
        return false
    }
}