export interface GeneralInfo {
    defaultAdmin: string
}

export type InitialBalance = {
    address: string,
    amount: string
}

export type Marketing = {
    project: string,
    description: string,
    marketing: string,
    logo: {
        url: string
    }
}

export interface Token {
    admin: string | null,
    initMsg: {
        name: string,
        symbol: string,
        decimals: number,
        initial_balances: InitialBalance[],
        marketing: Marketing
    },
    label: string
}

export interface Treasury {
    admin: string | null,
    initMsg: {
        admins: string[],
        mutable: boolean
    },
    label: string
}

export interface Staking {
    admin: string | null,
    initMsg: {
        owner: string,
        token_code_id: number,
        deposit_token_addr: string,
        marketing: Marketing
    },
    label: string
}

export interface PairConfig {
    code_id: number,
    pair_type: { xyk: {} } | { stable: {} },
    total_fee_bps: number,
    maker_fee_bps: number,
    is_disabled: boolean,
    is_generator_disabled: boolean
}

export interface Factory {
    admin: string | null,
    initMsg: {
        owner: string,
        pair_configs: PairConfig[],
        token_code_id: number,
        fee_address?: string,
        generator_address?: string,
        whitelist_code_id: number
    },
    label: string,
    change_owner: boolean,
    proposeNewOwner: {
        owner: string,
        expires_in: number
    }
}

export interface Router {
    admin: string | null,
    initMsg: {
        astroport_factory: string
    },
    label: string
}

export interface Maker {
    admin: string | null,
    initMsg: {
        owner: string,
        factory_contract: string,
        staking_contract: string,
        astro_token: NativeAsset | TokenAsset,
        governance_contract?: string,
        governance_percent?: string,
        max_spread: "0.5"
    },
    label: string
}

export type VestingAccountSchedule = {
    start_point: {
        time: string,
        amount: string
    },
    end_point?: {
        time: string,
        amount: string
    }
}

export interface VestingAccount {
    address: string
    schedules: VestingAccountSchedule[]
}

export interface Vesting {
    admin: string | null,
    initMsg: {
        owner: string,
        vesting_token: NativeAsset | TokenAsset,
    },
    label: string,
    registration: {
        msg: {
            register_vesting_accounts: {
                vesting_accounts: VestingAccount[]
            }
        },
        amount: string
    }
}

export interface Generator {
    admin: string | null,
    initMsg: {
        owner: string,
        astro_token: NativeAsset | TokenAsset,
        start_block: string,
        tokens_per_block: string,
        vesting_contract: string,
        factory: string,
        whitelist_code_id: number,
    },
    label: string,
    change_owner: boolean,
    proposeNewOwner: {
        owner: string,
        expires_in: number
    },
    new_incentives_pools?: []
}

export interface GeneratorProxy {
    admin: string | null,
    initMsg: {
        generator_contract_addr: string,
        pair_addr: string,
        lp_token_addr: string,
        reward_contract_addr: string,
        reward_token_addr: string
    },
    label: string
}

export type NativeAsset = {
    native_token: {
        denom: string,
    }
}

export type TokenAsset = {
    token: {
        contract_addr: string
    }
}

export interface Pair {
    identifier: string,
    assetInfos: (NativeAsset | TokenAsset)[],
    pairType: { xyk: {} } | { stable: {} },
    initParams?: any,
    initOracle?: boolean,
    initGenerator?: {
        generatorAllocPoint: string
    }
}

export interface CreatePairs {
    pairs: Pair[]
}

export interface Oracle {
    admin: string | null,
    initMsg: {
        factory_contract: string,
        asset_infos: (NativeAsset | TokenAsset)[]
    },
    label: string
}

export interface Config {
    token: Token,
    treasury: Treasury,
    staking: Staking,
    factory: Factory,
    router: Router,
    maker: Maker,
    vesting: Vesting,
    generator: Generator,
    generatorProxy: GeneratorProxy,
    createPairs: CreatePairs,
    oracle: Oracle,
    generalInfo: GeneralInfo
}
