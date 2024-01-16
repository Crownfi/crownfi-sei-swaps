# csswap-mvp

This is the MVP of CrownFi's Sei swaps. Currently a minimal fork of `astroport-core`

## Contracts diagram

![contract diagram](./assets/sc_diagram.png "Contracts Diagram")

## General Contracts

| Name                                                       | Description                                  |
| ---------------------------------------------------------- | -------------------------------------------- |
| [`factory`](packages/cargo/crownfi-astro-factory)                             | Pool creation factory                        |
| [`pair`](packages/cargo/crownfi-astro-pair)                                   | Pair with x*y=k curve                        |
| [`token`](packages/cargo/crownfi-astro-token)                                 | CW20 token implementation |
| [`router`](packages/cargo/crownfi-astro-router)                               | Multi-hop trade router                       |

## Building Contracts

You will need Rust 1.64.0+ with wasm32-unknown-unknown target installed.

### You can compile each contract:
Go to contract directory and run 
    
```
cargo wasm
cp ../../target/wasm32-unknown-unknown/release/astroport_token.wasm .
ls -l astroport_token.wasm
sha256sum astroport_token.wasm
```

### You can run tests for all contracts
Run the following from the repository root

```
cargo test
```

### For a production-ready (compressed) build:
Run the following from the repository root

```
./scripts/build_release.sh
```

The optimized contracts are generated in the artifacts/ directory.

## Deployment

WIP

## Docs

Docs can be generated using `cargo doc --no-deps`
