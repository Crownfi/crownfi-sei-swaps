use std::path::Path;
use crownfi_astro_common::pair::{AstroPairExecuteMsg, AstroPairInstantiateMsg, AstroPairMigrateMsg, AstroPairQueryMsg, AstroPairCw20HookMsg};
use cosmwasm_schema::{write_api, schema_for, export_schema};

fn main() {
    write_api! {
        instantiate: AstroPairInstantiateMsg,
        query: AstroPairQueryMsg,
        execute: AstroPairExecuteMsg,
        migrate: AstroPairMigrateMsg,
    }
    let cw20_hook_schema = schema_for!(AstroPairCw20HookMsg);
    export_schema(&cw20_hook_schema, &Path::new("schema/raw"));
}
