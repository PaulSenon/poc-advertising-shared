import { faker } from '@faker-js/faker';
import Swiper from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import { Manipulation, Navigation, Keyboard, Virtual } from 'swiper/modules';

export default class SwiperController {
  private swiper: Swiper;
  private prevActiveSlide?: HTMLElement;
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
            slides.push(this.generateTestSlide());
          }
          return slides;
        })(),
      },
      on: {
        // slideChangeTransitionEnd(): void {
        //   document.body.classList.remove('swiper-transition')
        // },
        // slideChangeTransitionStart(): void {
        //   console.debug('SQLFJSDJFLSDKJFLKDJ')
        //   document.body.classList.add('swiper-transition')
        // }
        sliderMove: (swiper, event) => {

        },
      }
    });
  }

  public init() {
    void this.swiper;
    this.prevActiveSlide = SwiperController.getActiveSlide();
    this.swiper.wrapperEl.addEventListener('transitionstart', (e) => {
      // TODO: maybe webkit event too ?

      // 0) on ignore si c'est un autre élément
      if (e.target !== this.swiper.wrapperEl) return;
      document.body.classList.add('swiper-transition')
      SwiperController.getActiveSlide()?.classList.add('swiper-slide-active-kept-while-tansitioning');
    });
    this.swiper.wrapperEl.addEventListener('transitionend', (e) => {
      // TODO: maybe webkit event too ?

      // 0) on ignore si c'est un autre élément
      if (e.target !== this.swiper.wrapperEl) return;
      
      // 1) on exécute la routine de fin de translate
      this.prevActiveSlide?.classList.remove('swiper-slide-active-kept-while-tansitioning');
      if(this.prevActiveSlide !== SwiperController.getActiveSlide()) {
        window.scroll(0,104);
        document.body.classList.remove('swiper-transition')
        /**@ts-ignore */
        window.advertising.reset();
        this.prevActiveSlide = SwiperController.getActiveSlide();
      }
    });
  }

  private generateTestSlide(): string {
    let adCount = 0;
    const buildAd = () => {
      adCount++;
      return `<div data-ad-id="adzone-halfpage-${adCount}" data-ad-type="halfpage" data-ad-position="${adCount}" class="advertising js-adzone advertising-halfpage${adCount%2===0?' u-hide-for-all':''}"></div>`
    }
    const randomIntFromInterval = (min: number, max: number) => { // min and max included 
      return Math.floor(Math.random() * (max - min + 1) + min)
    }
    const nbP = randomIntFromInterval(3,10);
    let paragraps = '';
    for(let i = 0; i<nbP; i++) {
      paragraps += `<p>${faker.lorem.lines({min:10, max: 50})}</p>${buildAd()}`;
    }
    // const paragraps = faker.lorem.text({min: 3, max:8}, '<<<STOP>>>').split('<<<STOP>>>').reduce((acc, s) => {
    //   acc += `<p>${s}</p>${buildAd()}`;
    //   return acc;
    // }, '');
    return `
      <article>
        <img src="${faker.image.urlLoremFlickr()}" height="480" widht="640" loading="lazy" class="hide" onload="this.classList.remove('hide')"/>
        <h1>${faker.lorem.lines(1)}</h1>
        <div data-ad-id="adzone-outstream-1" data-ad-type="outstream" data-ad-position="1" class="advertising js-adzone advertising-outstream"></div>
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