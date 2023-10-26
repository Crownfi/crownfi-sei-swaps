/**
 * DO NOT EDIT YOURSELF!
 * This file was automatically generated by json-schema-to-typescript.
 * The source schema json was automatically generated by cosmwasm-schema during the contract build.
 * The Rust code is the source of truth! Re-run the whole build if this file is outdated.
 **/

/**
 * A thin wrapper around u128 that is using strings for JSON encoding/decoding, such that the full u128 range can be used for clients that convert JSON numbers to floats, like JavaScript and jq.
 *
 * # Examples
 *
 * Use `from` to create instances of this and `u128` to get the value out:
 *
 * ``` # use cosmwasm_std::Uint128; let a = Uint128::from(123u128); assert_eq!(a.u128(), 123);
 *
 * let b = Uint128::from(42u64); assert_eq!(b.u128(), 42);
 *
 * let c = Uint128::from(70u32); assert_eq!(c.u128(), 70); ```
 */
export type Uint128 = string;
/**
 * This is used for uploading logo data, or setting it in InstantiateData
 */
export type Logo =
  | {
      url: string;
    }
  | {
      embedded: EmbeddedLogo;
    };
/**
 * This is used to store the logo on the blockchain in an accepted format. Enforce maximum size of 5KB on all variants.
 */
export type EmbeddedLogo =
  | {
      svg: Binary;
    }
  | {
      png: Binary;
    };
/**
 * Binary is a wrapper around Vec<u8> to add base64 de/serialization with serde. It also adds some helper methods to help encode inline.
 *
 * This is only needed as serde-json-{core,wasm} has a horrible encoding for Vec<u8>. See also <https://github.com/CosmWasm/cosmwasm/blob/main/docs/MESSAGE_TYPES.md>.
 */
export type Binary = string;

/**
 * This structure describes the parameters used for creating a token contract.
 */
export interface InstantiateMsg {
  /**
   * The amount of decimals the token has
   */
  decimals: number;
  /**
   * Initial token balances
   */
  initial_balances: Cw20Coin[];
  /**
   * the marketing info of type [`InstantiateMarketingInfo`]
   */
  marketing?: InstantiateMarketingInfo | null;
  /**
   * Minting controls specified in a [`MinterResponse`] structure
   */
  mint?: MinterResponse | null;
  /**
   * Token name
   */
  name: string;
  /**
   * Token symbol
   */
  symbol: string;
}
export interface Cw20Coin {
  address: string;
  amount: Uint128;
}
/**
 * This structure describes the marketing info settings such as project, description, and token logo.
 */
export interface InstantiateMarketingInfo {
  /**
   * The project description
   */
  description?: string | null;
  /**
   * The token logo
   */
  logo?: Logo | null;
  /**
   * The address of an admin who is able to update marketing info
   */
  marketing?: string | null;
  /**
   * The project name
   */
  project?: string | null;
}
export interface MinterResponse {
  /**
   * cap is a hard cap on total supply that can be achieved by minting. Note that this refers to total_supply. If None, there is unlimited cap.
   */
  cap?: Uint128 | null;
  minter: string;
}