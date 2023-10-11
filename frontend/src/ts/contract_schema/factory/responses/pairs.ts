/**
 * DO NOT EDIT YOURSELF!
 * This file was automatically generated by json-schema-to-typescript.
 * The source schema json was automatically generated by cosmwasm-schema during the contract build.
 * The Rust code is the source of truth! Re-run the whole build if this file is outdated.
 **/

/**
 * This enum describes available Token types. ## Examples ``` # use cosmwasm_std::Addr; # use astroport::asset::AssetInfo::{NativeToken, Token}; Token { contract_addr: Addr::unchecked("stake...") }; NativeToken { denom: String::from("uluna") }; ```
 */
export type AssetInfo =
  | {
      token: {
        contract_addr: Addr;
      };
    }
  | {
      native_token: {
        denom: string;
      };
    };
/**
 * A human readable address.
 *
 * In Cosmos, this is typically bech32 encoded. But for multi-chain smart contracts no assumptions should be made other than being UTF-8 encoded and of reasonable length.
 *
 * This type represents a validated address. It can be created in the following ways 1. Use `Addr::unchecked(input)` 2. Use `let checked: Addr = deps.api.addr_validate(input)?` 3. Use `let checked: Addr = deps.api.addr_humanize(canonical_addr)?` 4. Deserialize from JSON. This must only be done from JSON that was validated before such as a contract's state. `Addr` must not be used in messages sent by the user because this would result in unvalidated instances.
 *
 * This type is immutable. If you really need to mutate it (Really? Are you sure?), create a mutable copy using `let mut mutable = Addr::to_string()` and operate on that `String` instance.
 */
export type Addr = string;
/**
 * This enum describes available pair types. ## Available pool types ``` # use astroport::factory::PairType::{Custom, Stable, Xyk}; Xyk {}; Stable {}; Custom(String::from("Custom")); ```
 */
export type PairType =
  | {
      xyk: {};
    }
  | {
      stable: {};
    }
  | {
      custom: string;
    };

/**
 * A custom struct for each query response that returns an array of objects of type [`PairInfo`].
 */
export interface PairsResponse {
  /**
   * Arrays of structs containing information about multiple pairs
   */
  pairs: PairInfo[];
}
/**
 * This structure stores the main parameters for an Astroport pair
 */
export interface PairInfo {
  /**
   * Asset information for the assets in the pool
   */
  asset_infos: AssetInfo[];
  /**
   * Pair contract address
   */
  contract_addr: Addr;
  /**
   * Pair LP token address
   */
  liquidity_token: Addr;
  /**
   * The pool type (xyk, stableswap etc) available in [`PairType`]
   */
  pair_type: PairType;
}
