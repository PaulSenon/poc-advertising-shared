export default class InView {
  public static isVisiblePercent(element: HTMLElement, percent: number): boolean {
      const rect = element.getBoundingClientRect();
    
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    
      const { top, bottom, left, right } = rect;
    
      const elementHeight = bottom - top;
      const elementWidth = right - left;
    
      const visibleHeight = Math.min(elementHeight, viewportHeight - Math.max(top, viewportHeight - bottom));
      const visibleWidth = Math.min(elementWidth, viewportWidth - Math.max(left, viewportWidth - right));
    
      const visibleArea = (visibleHeight * visibleWidth) / (elementHeight * elementWidth);
    
      return visibleArea >= percent;
    }
}