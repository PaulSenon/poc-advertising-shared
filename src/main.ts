import './style.css';
import Advertising from './Advertising';
import SwiperController from './Swiper';
import IAdvertisingKeyvalueProvider from './IAdvertisingKeyvalueProvider';

class TestKvProvider implements IAdvertisingKeyvalueProvider {
    constructor(private name: string){}
    getAdvertisingKvKey(): string {
        return this.name;
    }
    getAdvertisingKvValue(): Promise<string> {
        return new Promise(resolve => setTimeout(() => resolve(Math.random().toString()), Math.random()*500));
    }
}

const swiper = new SwiperController();
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
        // test: 'lazyload'
    },
    lazyLoadOffsetPx: 0,
    usePrebid: false,
});
advertising.addKeyvalueProvider(new TestKvProvider('CCCCCCCCCCCCCCCCCCCCC'));
advertising.addKeyvalueProvider(new TestKvProvider('DDDDDDDDDDDDDDDDDDDD'));
/**@ts-ignore */
window.advertising = advertising;
/**@ts-ignore */
window.swiper = swiper;
swiper.init()
advertising.init().then(() => {
    console.debug('init finished')
    advertising.logStats()
})
// window.advertising = advertising;
