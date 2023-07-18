# PoC Advertising v2

[⚡️ One Click Demo ⚡️](https://github.com/PaulSenon/poc-advertising-shared/tree/yieldbird)

## Description

This the new advertising implementation we are currently designing, within a mock of the complexity we have with advertising and swiper. 
We want to integrate prebid and other thirdparties CLEANLY with it.

The goal it to find the most maintanable, evolutive and strong design.
Adding a new thirdparties should be super easy.

You can click the "One Click Demo" button to boot a dev env from this repo on stackblitz, so you don't need to clone this repo or anything.

## Project structure

* `/src`
    * `/config/adSlotConfig.ts`: where static adslot config (e.g. sizes) are configured
    * `/css/**/*.css`: style (not relevant)
    * `/Services`
        * `/Advertising.ts`: the core googletag implementation. Should be isolated from any thirdparty
        * `/Prebid.ts`: the prebid implementation
        * `/Swiper.ts`: the swiper mock to mimic the original website complexity (not relevant to look at)
    * `/utils/**/*.ts`: random utils needed for the rest
    * `/index.ts`: the TS entrypoint
* `/index.html`: the test app entrypoint
* (ignore all the rest)

## PoC Usages

* Change root adUnit:
    * in `/src/index.ts` -> Advertising constructor 
* Change global keyvalues/targeting values:
    * in `/src/index.ts` -> Advertising constructor 
* Change slot-specific keyvalue/targeting value:
    * in `/src/Services/Advertising.ts` -> `getSlotSpecificKeyvalues()` and append anything to the keyvalues map
* Toggle prebid
    * in `/src/index.ts` -> Advertising constructor 
* Add new adSlot (outside swiper)
    * in `/index.html`, syntax = `<div data-ad-id="{{uid}}" data-ad-type="{{adType}}" data-ad-position="{{position}}" class="advertising js-adzone advertising-{{adType}}"></div>` with `{{uid}}`=any unique string, `{{adType}}`=an existing adType in /src/config/adSlotConfig.ts -> AdSlotKind, `{{position}}`=any integer
* Add new adSlot in each slides (inside swiper)
    * in `/src/Services/Swiper.ts` -> `generateTestSlide()`, also respect the rules above for a valid ad slot
* Change bidders list config
    * in `/src/Services/Prebid.ts` -> `fetchBiddersConfig()` (it is automatically run at Prebid.init(), once, so requires page reload to handle changes)
* Add new ad type:
    * in `/src/config/adSlotConfig.ts`:
        * add name in enum `AdSlotKind`
        * add config for the new type in `adSlotsTargetingConfig` object
        * define sizes for each breakpoint (empty sizes array = no ad of this kind for this breakpoint)
        * you can now create any ad `<div data-ad-type={{your new ad type}}>` (See _"Add new adSlot (outside swiper)"_ for more details) 

