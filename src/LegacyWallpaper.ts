
type WallpaperData = {
    backgroundColor?: string;
    backgroundImage: string;
    clickUrl: string;
    marginTop?: string;
    trackingPixel?: string;
}

function isValidWallpaperData(something: unknown): something is WallpaperData {
    if (typeof something !== 'object' || something === null) {
        return false;
      }
    
      const data = something as WallpaperData;
      if (typeof data.backgroundImage !== 'string' || typeof data.clickUrl !== 'string') {
        return false;
      }
    
      if (data.backgroundColor && typeof data.backgroundColor !== 'string') {
        return false;
      }

      if (data.trackingPixel && typeof data.trackingPixel !== 'string') {
        return false;
      }
    
      if (data.marginTop) {
        if (typeof data.marginTop !== 'string') {
          return false;
        }
    
        const marginTopValue = parseInt(data.marginTop, 10);
        if (isNaN(marginTopValue)) {
          return false;
        }
      }
    
      return true;
}


export default class LegacyWallpaper {

    public static init() {
        window.addEventListener('message', (event: MessageEvent) => {
            if ('wallpaperAvailable' !== event.data?.message) return;
            console.debug('WALLPAPER RECEIVED', event.data)
            if (isValidWallpaperData(event.data)) {
                LegacyWallpaper.setWallpaper(event.data);
            }
        });
    }

    public static clean() {
        const dfpWallpaperStyle = document.getElementById('dfp-wallpaper-style');
        dfpWallpaperStyle?.remove();
        const oldTrackingPixel = document.getElementById('dfp-wallpaper-pixel');
        oldTrackingPixel?.remove();
        const dfpWallpaperWrapper = document.getElementById('dfp-wallpaper-wrapper');
        const dfpWallpaperWrapperRight = document.getElementById('dfp-wallpaper-wrapper-right');
        const dfpWallpaperWrapperLeft = document.getElementById('dfp-wallpaper-wrapper-left');
        dfpWallpaperWrapper?.classList.add('u-hide-for-all');
        dfpWallpaperWrapperRight?.classList.add('u-hide-for-all');
        dfpWallpaperWrapperLeft?.classList.add('u-hide-for-all');

        const enwMainContent = document.getElementById('enw-main-content');
        if(enwMainContent) enwMainContent.style.marginTop = '0px';

        document.body.classList.remove('wallpaper-rendered');
    }

    public static setWallpaper(data: WallpaperData) {
        document.body.classList.add('wallpaper-rendered');
        const adzoneWallpaper = document.getElementById('adzone-wallpaper');
        const dfpWallpaperWrapper = document.getElementById('dfp-wallpaper-wrapper');
        const dfpWallpaperWrapperRight = document.getElementById('dfp-wallpaper-wrapper-right');
        const dfpWallpaperWrapperLeft = document.getElementById('dfp-wallpaper-wrapper-left');
        const adzoneLeaderboardWallpaper = document.getElementById('adzone-leaderboard-wallpaper');

        dfpWallpaperWrapper && dfpWallpaperWrapper.classList.remove('u-hide-for-all');
        dfpWallpaperWrapperRight && dfpWallpaperWrapperRight.classList.remove('u-hide-for-all');
        dfpWallpaperWrapperLeft && dfpWallpaperWrapperLeft.classList.remove('u-hide-for-all');
        adzoneWallpaper && adzoneWallpaper.classList.remove('u-hide-for-all');

        // Case: we don't need wallpaper:
        if ((adzoneWallpaper && adzoneWallpaper.classList.contains('advertising--empty-slot'))
            && (adzoneLeaderboardWallpaper && adzoneLeaderboardWallpaper.classList.contains('advertising--empty-slot'))
        ){
            if (dfpWallpaperWrapper) dfpWallpaperWrapper.style.display = 'none';
            if (dfpWallpaperWrapperRight) dfpWallpaperWrapperRight.style.display = 'none';
            if (dfpWallpaperWrapperLeft) dfpWallpaperWrapperLeft.style.display = 'none';
            return;
        }

        // Case: we need wallpaper:
        const minWindowWidth = 1280;
        const maxWindowWidth = 1279;

        const enwMainContent = document.getElementById('enw-main-content');
        const dfpWallpaperStyle = document.getElementById('dfp-wallpaper-style');
        const jsBreakingNews = document.querySelector('.js-breakingNews');
        const closeButton = document.querySelector('.close-button');
        const oldTrackingPixel = document.getElementById('dfp-wallpaper-pixel');

        const wallpaperStyle = `<style id="dfp-wallpaper-style">
            body.dfp-wallpapered {
                background-image:none;
            }
            @media (min-width: ${minWindowWidth}px) {
                body.dfp-wallpapered .background-image-container{
                    background: ${data.backgroundColor || '#fff'} url(${data.backgroundImage}) 50% 0 no-repeat;
                    background-attachment: fixed;
                    background-position: center 0;
                    position:absolute;
                    opacity: 1;
                    top:0;
                    right:0;
                    left:0;
                }
                /*#dfp-wallpaper-wrapper{
                    position:fixed;
                    top:0;
                    bottom:0;
                    right:0;
                    left:0;
                }*/
            }
            @media (max-width: ${maxWindowWidth}px) {
                #enw-main-content {
                    margin-top: 0!important;
                    padding-left: 0!important;
                    padding-right: 0!important;
                }
            }
        </style>`;
        dfpWallpaperStyle?.remove(); // make sure we don't have duplicates
        oldTrackingPixel?.remove();

        document.querySelector('head')?.insertAdjacentHTML('beforeend', wallpaperStyle);

        document.querySelector('body')?.classList.add('dfp-wallpapered');
        enwMainContent?.classList.add('row', 'column');
        dfpWallpaperWrapper?.setAttribute('href', data.clickUrl);
        dfpWallpaperWrapper?.setAttribute('target', '_blank');
        dfpWallpaperWrapperRight?.setAttribute('href', data.clickUrl);
        dfpWallpaperWrapperRight?.setAttribute('target', '_blank');
        dfpWallpaperWrapperLeft?.setAttribute('href', data.clickUrl);
        dfpWallpaperWrapperLeft?.setAttribute('target', '_blank');

        const tmp = parseInt(data.marginTop ?? '0', 10);
        const marginTopInt = Math.max(280, tmp);
        if (enwMainContent) enwMainContent.style.marginTop = `${marginTopInt}px`;

        // Right after changing slide style we have to request slide recalculation if swiper is active
        // if (window.articleSwipe !== undefined && typeof window.articleSwipe.requestUpdate === 'function') {
        //     window.articleSwipe.requestUpdate();
        // }
     
        if (jsBreakingNews && jsBreakingNews.classList.contains('breakingNews-visible')) {
            if (enwMainContent) enwMainContent.style.marginTop = `${marginTopInt - 75}px`;
        }
        if(closeButton){
            closeButton.addEventListener('click', () => {
            if (enwMainContent) enwMainContent.style.marginTop = `${marginTopInt}px`;
            });
        }
    
        if (typeof data.trackingPixel !== 'undefined' && data.trackingPixel.indexOf("http") === 0) {
            var i = new Image();
            i.id = 'dfp-wallpaper-pixel';
            i.style.height = '1px';
            i.style.height = '1px';
            i.src = data.trackingPixel;
            window.document.body.append(i);
        }
    }

}

export {
    type WallpaperData,
    isValidWallpaperData,
}