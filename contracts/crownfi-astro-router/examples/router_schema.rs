use std::path::Path;
use crownfi_astro_common::router::{AstroRouteExecuteMsg, AstroRouteInstantiateMsg, AstroRouteMigrateMsg, AstroRouteQueryMsg, AstroRouteCw20HookMsg};
use cosmwasm_schema::{write_api, schema_for, export_schema};

fn main() {
    write_api! {
        instantiate: AstroRouteInstantiateMsg,
        query: AstroRouteQueryMsg,
        execute: AstroRouteExecuteMsg,
        migrate: AstroRouteMigrateMsg,
    }
    let cw20_hook_schema = schema_for!(AstroRouteCw20HookMsg);
    export_schema(&cw20_hook_schema, &Path::new("schema/raw"));
}
