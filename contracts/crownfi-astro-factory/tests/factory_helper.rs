#![cfg(not(tarpaulin_include))]

use anyhow::Result as AnyResult;
use crownfi_astro_common::asset::AssetInfo;
use crownfi_astro_common::factory::{AstroFactoryPairConfig, AstroPairType};
use cosmwasm_std::{Addr, Binary};
use cw20::MinterResponse;
use cw_multi_test::{App, AppResponse, ContractWrapper, Executor};

pub struct FactoryHelper {
    pub owner: Addr,
    pub astro_token: Addr,
    pub factory: Addr,
    pub cw20_token_code_id: u64,
}

impl FactoryHelper {
    pub fn init(router: &mut App, owner: &Addr) -> Self {
        let astro_token_contract = Box::new(ContractWrapper::new_with_empty(
            crownfi_astro_token::contract::execute,
            crownfi_astro_token::contract::instantiate,
            crownfi_astro_token::contract::query,
        ));

        let cw20_token_code_id = router.store_code(astro_token_contract);

        let msg = crownfi_astro_common::token::TokenInstantiateMsg {
            name: String::from("Astro token"),
            symbol: String::from("ASTRO"),
            decimals: 6,
            initial_balances: vec![],
            mint: Some(MinterResponse {
                minter: owner.to_string(),
                cap: None,
            }),
            marketing: None,
        };

        let astro_token = router
            .instantiate_contract(
                cw20_token_code_id,
                owner.clone(),
                &msg,
                &[],
                String::from("ASTRO"),
                None,
            )
            .unwrap();

        let pair_contract = Box::new(
            ContractWrapper::new_with_empty(
                crownfi_astro_pair::contract::execute,
                crownfi_astro_pair::contract::instantiate,
                crownfi_astro_pair::contract::query,
            )
            .with_reply_empty(crownfi_astro_pair::contract::reply),
        );

        let pair_code_id = router.store_code(pair_contract);

        let factory_contract = Box::new(
            ContractWrapper::new_with_empty(
                crownfi_astro_factory::contract::execute,
                crownfi_astro_factory::contract::instantiate,
                crownfi_astro_factory::contract::query,
            )
            .with_reply_empty(crownfi_astro_factory::contract::reply),
        );

        let factory_code_id = router.store_code(factory_contract);

        let msg = crownfi_astro_common::factory::AstroFactoryInstantiateMsg {
            pair_configs: vec![AstroFactoryPairConfig {
                code_id: pair_code_id,
                pair_type: AstroPairType::Xyk {},
                total_fee_bps: 100,
                maker_fee_bps: 10,
                is_disabled: false,
                is_generator_disabled: false,
            }],
            token_code_id: cw20_token_code_id,
            fee_address: None,
            generator_address: None,
            owner: owner.to_string(),
        };

        let factory = router
            .instantiate_contract(
                factory_code_id,
                owner.clone(),
                &msg,
                &[],
                String::from("ASTRO"),
                None,
            )
            .unwrap();

        Self {
            owner: owner.clone(),
            astro_token,
            factory,
            cw20_token_code_id,
        }
    }

    pub fn update_config(
        &mut self,
        router: &mut App,
        sender: &Addr,
        token_code_id: Option<u64>,
        fee_address: Option<String>,
        // generator_address: Option<String>,
        // coin_registry_address: Option<String>,
    ) -> AnyResult<AppResponse> {
        let msg = crownfi_astro_common::factory::AstroFactoryExecuteMsg::UpdateConfig {
            token_code_id,
            fee_address,
            // generator_address,
        };

        router.execute_contract(sender.clone(), self.factory.clone(), &msg, &[])
    }

    pub fn create_pair(
        &mut self,
        router: &mut App,
        sender: &Addr,
        pair_type: AstroPairType,
        tokens: [&Addr; 2],
        init_params: Option<Binary>,
    ) -> AnyResult<AppResponse> {
        let asset_infos = vec![
            AssetInfo::Token {
                contract_addr: tokens[0].clone(),
            },
            AssetInfo::Token {
                contract_addr: tokens[1].clone(),
            },
        ];

        let msg = crownfi_astro_common::factory::AstroFactoryExecuteMsg::CreatePair {
            pair_type,
            asset_infos,
            init_params,
        };

        router.execute_contract(sender.clone(), self.factory.clone(), &msg, &[])
    }
}

pub fn instantiate_token(
    app: &mut App,
    token_code_id: u64,
    owner: &Addr,
    token_name: &str,
    decimals: Option<u8>,
) -> Addr {
    let init_msg = crownfi_astro_common::token::TokenInstantiateMsg {
        name: token_name.to_string(),
        symbol: token_name.to_string(),
        decimals: decimals.unwrap_or(6),
        initial_balances: vec![],
        mint: Some(MinterResponse {
            minter: owner.to_string(),
            cap: None,
        }),
        marketing: None,
    };

    app.instantiate_contract(
        token_code_id,
        owner.clone(),
        &init_msg,
        &[],
        token_name,
        None,
    )
    .unwrap()
}
