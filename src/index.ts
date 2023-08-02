import './css/style.css';
import Advertising from './Services/Advertising/Advertising';
import FakeGrapeshot from './Services/Advertising/Hooks/FakeGrapeshot';
import Prebid from './Services/Advertising/Hooks/Prebid';
import SwiperController from './Services/Swiper';

// this is a fake swiper like on euronews.com
const swiper = new SwiperController(); 

// this is how we'll init advertising service, 
// data are static here but should sent by server.
// feel free to changes values to test out ad configs.
const advertising = new Advertising({ 
    fullAdUnit: '/6458/en_euronews_new/green/climate/climate',
    keyValues: {
        lng: 'en',
        page: 'article',
        nws_id: '2298886',
        nwsctr_id: '7681866',
        themes: 'news',
        vertical: 'news',
        program: 'euronews-witness',
        video_duration: '600',
        technical_tags: 'video-auto-play',
        source: 'euronews',
    },
    lazyLoadOffsetPx: 0
}, [ // just throw all thirdparties here! too easy !
    new Prebid(false), // true is for prebid debug mode. Turn it off to not spam the output logs
    new FakeGrapeshot(),
]);


/**@ts-ignore */
window.advertising = advertising; // global ref just for POC, so Swiper can call reset() on it

// inits
swiper.init();
advertising.init().then(() => {
    console.debug('init finished');
    console.debug(advertising.getStatsCollector().toString()); // this is just for demo purpose
});



