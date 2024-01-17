use crownfi_astro_common::factory::{AstroFactoryExecuteMsg, AstroFactoryInstantiateMsg, AstroFactoryMigrateMsg, AstroFactoryQueryMsg};
use cosmwasm_schema::write_api;

fn main() {
    write_api! {
        instantiate: AstroFactoryInstantiateMsg,
        query: AstroFactoryQueryMsg,
        execute: AstroFactoryExecuteMsg,
        migrate: AstroFactoryMigrateMsg,
    }
}
