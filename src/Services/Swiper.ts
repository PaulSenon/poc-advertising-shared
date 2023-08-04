import { faker } from '@faker-js/faker';
import Swiper from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import { Manipulation, Navigation, Keyboard, Virtual } from 'swiper/modules';
import ServerDataProvider from './ServerDataProvider';

export default class SwiperController {
  private swiper: Swiper;
  private prevActiveSlide?: HTMLElement;

  /**
   * Ignore this, not interresting for PoC
   */
  constructor() {
    this.swiper = new Swiper('.swiper', {
      modules: [Navigation, Manipulation, Keyboard, Virtual],
      keyboard: {
        enabled: true,
      },
      longSwipes: false,
      slidesPerView: 1,
      centeredSlides: true,
      spaceBetween: 0,
      autoHeight: true,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      threshold: 10,
      virtual: {
        addSlidesAfter: 1,
        addSlidesBefore: 1,
        cache: false,
        enabled: true,
        slides: (() => {
          const slides = [];
          for (var i = 0; i < 50; i += 1) {
            slides.push(this.generateTestSlide(i));
          }
          return slides;
        })(),
      }
    });
  }

  /**
   * Ignore this, not interresting for PoC
   */
  public init() {
    void this.swiper;
    this.prevActiveSlide = SwiperController.getActiveSlide();
    this.swiper.wrapperEl.addEventListener('transitionstart', (e) => {
      // 0) on ignore si c'est un autre élément
      if (e.target !== this.swiper.wrapperEl) return;
      document.body.classList.add('swiper-transition')
      SwiperController.getActiveSlide()?.classList.add('swiper-slide-active-kept-while-tansitioning');
    });
    this.swiper.wrapperEl.addEventListener('transitionend', (e) => {
      // 0) on ignore si c'est un autre élément
      if (e.target !== this.swiper.wrapperEl) return;
      
      // 1) on exécute la routine de fin de translate
      this.prevActiveSlide?.classList.remove('swiper-slide-active-kept-while-tansitioning');
      if(this.prevActiveSlide !== SwiperController.getActiveSlide()) {
        window.scroll(0,104);
        document.body.classList.remove('swiper-transition')
        /**@ts-ignore */
        ServerDataProvider.getInstance().setServerData({
          advertisingData: { 
            fullAdUnit: '/6458/en_euronews_new/green/climate/climate',
            keyValues: { // new keyvalue should be received with slide in server response
              swipeIndex: this.swiper.activeIndex.toString(), // this is just to check we are updating successfully between swipes
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
          }
        })
        /**@ts-ignore */
        window.advertising.reset();
        this.prevActiveSlide = SwiperController.getActiveSlide();
      }
    });
  }

  /**
   * Generate a test slide/article with:
   *  - ads with slide index in id (to mock what's happening on euronews.com)
   *  - some non visible ads (to mock mobile only ads that are display none on euronews.com, ad call should not be triggered for those)
   *  - some text/image (paragraph count is random, therefore inbetween ads count may varry for each article)
   */
  private generateTestSlide(index: number): string {
    let adCount = 0;
    const buildAd = () => {
      adCount++;
      return `<div data-ad-id="adzone-halfpage-${index}-${adCount}" data-ad-type="halfpage" data-ad-position="${adCount}" class="advertising js-adzone advertising-halfpage${adCount%2===0?' u-hide-for-all':''}"></div>`
    }
    const randomIntFromInterval = (min: number, max: number) => { // min and max included 
      return Math.floor(Math.random() * (max - min + 1) + min)
    }
    const nbP = randomIntFromInterval(3,10);
    let paragraps = '';
    for(let i = 0; i<nbP; i++) {
      paragraps += `<p>${faker.lorem.lines({min:10, max: 50})}</p>${buildAd()}`;
    }

    return `
      <article>
        <img src="${faker.image.urlLoremFlickr()}" height="480" widht="640" loading="lazy" class="hide" onload="this.classList.remove('hide')"/>
        <h1>${faker.lorem.lines(1)}</h1>
        ${paragraps}
      </article>
    `;
  }


  public static getActiveSlide(): HTMLElement | undefined {
    const activeSlide: HTMLElement | null = document.querySelector('.swiper-slide-active');
    return activeSlide ?? undefined;
  }

  public static buildClassSelectorOutsideSwiper(className: string): string {
    return `.${className}:not(.swiper .${className})`;
  }

  public static buildClassSelectorInsideSwiper(className: string): string {
    return `.swiper .${className}`
  }

  public static buildClassSelectorInsideActiveSlide(className: string): string {
    return `.swiper-slide-active .${className}`;
  }

  public static buildClassSelectorInsideNotActiveSlides(className: string): string {
    return `.swiper-slide:not(.swiper-slide-active) .${className}`
  }
}