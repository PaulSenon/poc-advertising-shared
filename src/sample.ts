/**
 * @license
 * Copyright 2022 Google LLC. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Using @types/google-publisher-tag
// https://www.npmjs.com/package/@types/google-publisher-tag
// declare interface window {
//   googletag: typeof googletag;
// }

export function setupGam() {
  window.googletag = window.googletag || { cmd: [] };

  googletag.cmd.push(() => {
    googletag
      .defineSlot('/6355419/Travel', [728, 90], 'div-1')!
      .setTargeting('test', 'lazyload')
      .addService(googletag.pubads());
    googletag
      .defineSlot('/6355419/Travel', [728, 90], 'div-2')!
      .setTargeting('test', 'lazyload')
      .addService(googletag.pubads());
    googletag
      .defineSlot('/6355419/Travel', [728, 90], 'div-4')!
      .setTargeting('test', 'lazyload')
      .addService(googletag.pubads());
    googletag
      .defineSlot('/6355419/Travel', [728, 90], 'div-5')!
      .setTargeting('test', 'lazyload')
      .addService(googletag.pubads());
    googletag
      .defineSlot('/6355419/Travel', [728, 90], 'div-6')!
      .setTargeting('test', 'lazyload')
      .addService(googletag.pubads());

    // Some examples of ways to enable lazy loading below.
    // Normally, only one of these methods should be used.

    // A) Enable with defaults.
    // googletag.pubads().enableLazyLoad();

    // B) Enable without lazy fetching. Additional calls override previous
    // ones.
    // googletag.pubads().enableLazyLoad({fetchMarginPercent: -1});

    // C) Enable lazy loading with...
    googletag.pubads().enableLazyLoad({
      // Fetch slots within 5 viewports.
      fetchMarginPercent: 500,
      // Render slots within 2 viewports.
      renderMarginPercent: 200,
      // Double the above values on mobile, where viewports are smaller
      // and users tend to scroll faster.
      mobileScaling: 1.0,
    });

    // Register event handlers to observe lazy loading behavior.
    googletag.pubads().addEventListener('slotRequested', (event) => {
      updateSlotStatus(event.slot.getSlotElementId(), 'fetched');
    });

    googletag.pubads().addEventListener('slotOnload', (event) => {
      updateSlotStatus(event.slot.getSlotElementId(), 'rendered');
    });

    // Enable SRA and services.
    googletag.pubads().enableSingleRequest();
    googletag.pubads().disableInitialLoad();
    googletag.enableServices();

    // Request all previously defined ad slots.
    googletag.display('div-1');
    // googletag.display('div-2');
    // googletag.display('div-3');
    // googletag.display('div-4');
    // googletag.display('div-5');
    // googletag.display('div-6');
    googletag.pubads().refresh();
  });

  setTimeout(() => {
    googletag.cmd.push(() => {
      const div3 = googletag
        .defineSlot('/6355419/Travel', [728, 90], 'div-3')!
        .setTargeting('test', 'lazyload')
        .addService(googletag.pubads());
      googletag.display(div3);
      googletag.pubads().refresh([div3]);
    });
  }, 2000);

  setTimeout(() => {
    // const forcedSlots: googletag.Slot[] = [];
    googletag.cmd.push(() => {
      resetTableUi();
      googletag.destroySlots();
      const div1 = googletag
        .defineSlot('/6355419/Travel', [728, 90], 'div-1')!
        .setTargeting('test', 'lazyload')
        .addService(googletag.pubads());
      const div2 = googletag
        .defineSlot('/6355419/Travel', [728, 90], 'div-6')!
        .setTargeting('test', 'lazyload')
        .addService(googletag.pubads());
      // forcedSlots.push(aa);
      googletag.display(div1);
      googletag.pubads().refresh();
      // googletag.display('div-6');
      // googletag.pubads().refresh();
    });
    // googletag.cmd.push(() => {
    //   const aa = googletag
    //     .defineSlot('/6355419/Travel', [728, 90], 'div-6')!
    //     .setTargeting('test', 'lazyload')
    //     .addService(googletag.pubads());
    //     // googletag.display(aa);
    //     googletag.pubads().refresh()

    //   // googletag.pubads().refresh(forcedSlots);
    // })
  }, 3000);
}

function resetTableUi() {
  for (let i = 1; i < 7; i++) {
    updateSlotStatus(`div-${i}`, 'fetched', false);
    updateSlotStatus(`div-${i}`, 'rendered', false);
  }
}

function updateSlotStatus(slotId: string, state: string, yes = true) {
  const elem = document.getElementById(slotId + '-' + state)!;
  elem.className = yes ? 'activated' : '';
  elem.innerText = yes ? 'Yes' : 'No';
}

export {};
