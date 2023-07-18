
enum Breakpoint {
    XXL,
    XL,
    L,
    M,
    S,
}

type BreakpointString = keyof typeof Breakpoint;
type BreakPointConfig = Record<BreakpointString, number>;

const breakpointConfig: BreakPointConfig = {
    XXL: 1440,
    XL: 1280,
    L: 1024,
    M: 768,
    S: 0,
} as const;

export default class BreakPointDetector {
    public static getCurrentBreakpoint(): BreakpointString {
        const windowWidth = window.innerWidth;

        for (const breakpoint in breakpointConfig) {
            const numericBreakpoint = breakpointConfig[breakpoint as BreakpointString];
            if (windowWidth >= numericBreakpoint) {
                return breakpoint as BreakpointString;
            }
        }

        return 'S';
    }
}

export {
    Breakpoint,
    type BreakpointString,
}