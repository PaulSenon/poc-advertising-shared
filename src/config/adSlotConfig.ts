import { BreakpointString } from "../utils/BreakPointDetector";

enum AdSlotKind {
    leaderboard,
    wallpaper,
    halfpage,
    "leaderboard-wallpaper",
    "sticky-floor",
    outstream,
}


type AdSlotTargetingConfig = {
    sizes: {[key in BreakpointString]?: [number, number][]};
}
type AdSlotsTargetingConfig = {
    [key in keyof typeof AdSlotKind] : AdSlotTargetingConfig
}

const adSlotsTargetingConfig: AdSlotsTargetingConfig = {
    leaderboard: {
        sizes: { // DONE !
            XXL: [[970, 250], [970, 90], [728, 90]],
            XL: [[970, 250], [970, 90], [728, 90]],
            L: [[970, 250], [970, 90], [728, 90]],
            M: [[728, 90]], // too small for 970 width ads
            S: [], // too small for 728 width ads
        },
    },
    wallpaper: {
        sizes: { // DONE !
            XXL: [[1, 1]],
            XL: [[1, 1]],
            L: [], // no wallpaper under because never displayed
            M: [],
            S: [],
        },
    },
    'leaderboard-wallpaper': {
        sizes: { // DONE
            XXL: [[1,1], [970, 250], [970, 90], [728, 90]],
            XL: [[1,1], [970, 250], [970, 90], [728, 90]],
            L: [[970, 250], [970, 90], [728, 90]], // no wallpaper under because never displayed
            M: [[728, 90]], // too small for 970 width ads
            S: [], // too small for 728 width ads
        },
    },
    halfpage: {
        sizes: {
            XXL: [[300, 600], [300, 250]],
            XL: [[300, 600], [300, 250]],
            L: [[300, 600], [300, 250]],
            M: [[300, 600], [300, 250]],
            S: [[300, 600], [300, 250]],
        }
    },
    "sticky-floor": {
        sizes: {
            XXL: [[320, 50]],
            XL: [[320, 50]],
            L: [[320, 50]],
            M: [[320, 50]],
            S: [[320, 50]],
        }
    },
    outstream: {
        sizes: {
            XXL: [[1, 2]],
            XL: [[1, 2]],
            L: [[1, 2]],
            M: [[1, 2]],
            S: [[1, 2]],
        }
    },

}

function isValidAdSlotKind(someString: string): someString is keyof typeof AdSlotKind {
    return someString in AdSlotKind;
}

export { 
    adSlotsTargetingConfig, 
    isValidAdSlotKind,
    AdSlotKind,
    type AdSlotTargetingConfig ,
};