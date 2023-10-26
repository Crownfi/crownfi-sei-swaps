/**
 * DO NOT EDIT YOURSELF!
 * This file was automatically generated by json-schema-to-typescript.
 * The source schema json was automatically generated by cosmwasm-schema during the contract build.
 * The Rust code is the source of truth! Re-run the whole build if this file is outdated.
 **/

export type ExecuteMsg =
  | {
      transfer: {
        amount: Uint128;
        recipient: string;
      };
    }
  | {
      burn: {
        amount: Uint128;
      };
    }
  | {
      send: {
        amount: Uint128;
        contract: string;
        msg: Binary;
      };
    }
  | {
      increase_allowance: {
        amount: Uint128;
        expires?: Expiration | null;
        spender: string;
      };
    }
  | {
      decrease_allowance: {
        amount: Uint128;
        expires?: Expiration | null;
        spender: string;
      };
    }
  | {
      transfer_from: {
        amount: Uint128;
        owner: string;
        recipient: string;
      };
    }
  | {
      send_from: {
        amount: Uint128;
        contract: string;
        msg: Binary;
        owner: string;
      };
    }
  | {
      burn_from: {
        amount: Uint128;
        owner: string;
      };
    }
  | {
      mint: {
        amount: Uint128;
        recipient: string;
      };
    }
  | {
      update_minter: {
        new_minter?: string | null;
      };
    }
  | {
      update_marketing: {
        /**
         * A longer description of the token and it's utility. Designed for tooltips or such
         */
        description?: string | null;
        /**
         * The address (if any) who can update this data structure
         */
        marketing?: string | null;
        /**
         * A URL pointing to the project behind this token.
         */
        project?: string | null;
      };
    }
  | {
      upload_logo: Logo;
    };
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
 * Binary is a wrapper around Vec<u8> to add base64 de/serialization with serde. It also adds some helper methods to help encode inline.
 *
 * This is only needed as serde-json-{core,wasm} has a horrible encoding for Vec<u8>. See also <https://github.com/CosmWasm/cosmwasm/blob/main/docs/MESSAGE_TYPES.md>.
 */
export type Binary = string;
/**
 * Expiration represents a point in time when some event happens. It can compare with a BlockInfo and will return is_expired() == true once the condition is hit (and for every block in the future)
 */
export type Expiration =
  | {
      at_height: number;
    }
  | {
      at_time: Timestamp;
    }
  | {
      never: {};
    };
/**
 * A point in time in nanosecond precision.
 *
 * This type can represent times from 1970-01-01T00:00:00Z to 2554-07-21T23:34:33Z.
 *
 * ## Examples
 *
 * ``` # use cosmwasm_std::Timestamp; let ts = Timestamp::from_nanos(1_000_000_202); assert_eq!(ts.nanos(), 1_000_000_202); assert_eq!(ts.seconds(), 1); assert_eq!(ts.subsec_nanos(), 202);
 *
 * let ts = ts.plus_seconds(2); assert_eq!(ts.nanos(), 3_000_000_202); assert_eq!(ts.seconds(), 3); assert_eq!(ts.subsec_nanos(), 202); ```
 */
export type Timestamp = Uint64;
/**
 * A thin wrapper around u64 that is using strings for JSON encoding/decoding, such that the full u64 range can be used for clients that convert JSON numbers to floats, like JavaScript and jq.
 *
 * # Examples
 *
 * Use `from` to create instances of this and `u64` to get the value out:
 *
 * ``` # use cosmwasm_std::Uint64; let a = Uint64::from(42u64); assert_eq!(a.u64(), 42);
 *
 * let b = Uint64::from(70u32); assert_eq!(b.u64(), 70); ```
 */
export type Uint64 = string;
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