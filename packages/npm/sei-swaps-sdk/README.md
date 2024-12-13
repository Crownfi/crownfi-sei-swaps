# @crownfi/sei-swaps-sdk

This is an library intended for the use of easy interfacing with CrownFi's Sei Swaps.

## Notes on compatibility

-   This package depends on [a fork of sei-js](https://www.npmjs.com/package/@crownfi/sei-js-core) which brings the following benefits
    -   Easier to use wallet discovery
    -   Compatibility with the latest versions of `@cosmjs` packages (at the time of publishing)
    -   Doesn't pollute `window`
-   This package is currently _only_ built as an ESM module

## Notes on stability

-   We plan to introduce significant feature additions and potentially breaking changes to our contracts in Q2 2024. These changes will coincide with a `1.0.0` version of this package.
    -   You can safely mark `>0.9 <2` as the version dependency for this package as long as your limit yourself to features specifically documented with "no backwards-incompatible changes planned for v1.0"
    -   At this time, this only applies to functions related to performing swaps.
