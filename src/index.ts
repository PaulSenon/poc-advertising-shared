import './css/style.css';
import Advertising from './Services/Advertising';
import SwiperController from './Services/Swiper';

// this is a fake swiper like on euronews.com
const swiper = new SwiperController(); 

// this is how we'll init advertising service, 
// data are static here but should be read from dynamic config
// feel free to changes values to test out ad configs.
const advertising = new Advertising({ 
    fullAdUnit: '/6458/en_euronews_new/green/climate/climate',
    keyValues: { // global targeting values
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
    lazyLoadOffsetPx: 0, // lazyload offset in px
    usePrebid: true, // on/off prebid
});

/**@ts-ignore */
window.advertising = advertising; // global ref just for POC, so Swiper can call reset() on it

// inits
swiper.init();
advertising.init();



