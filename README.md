# PoC Advertising v2 + Yieldbird

[⚡️ Run this branch in web IDE in one click ⚡️](https://pr.new/PaulSenon/poc-advertising-shared/tree/yieldbird-poc)

=> popout the browser preview window and open console with log level = debug to see all interresting logs

## Description (for yieldbird)

* /src/Services/Advertising/Hooks/YieldbirdService.ts
    * => Where we should be able to implement everything from yieldbird
* /src/Services/Advertising/AdsLifecycleHooksRunner.ts  
    * => What manage all hooks and handle timeouts and parallelizing
* /src/Services/Advertising/Advertising.ts
    * => Where the advertising core is (googletag) and should never be coupled to any specific thirsdparties or external business rules.
