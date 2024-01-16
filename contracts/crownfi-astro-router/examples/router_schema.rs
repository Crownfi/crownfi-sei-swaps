use std::path::Path;
use crownfi_astro_common::router::{ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg, Cw20HookMsg};
use cosmwasm_schema::{write_api, schema_for, export_schema};

fn main() {
    write_api! {
        instantiate: InstantiateMsg,
        query: QueryMsg,
        execute: ExecuteMsg,
        migrate: MigrateMsg,
    }
    let cw20_hook_schema = schema_for!(Cw20HookMsg);
    export_schema(&cw20_hook_schema, &Path::new("schema/raw"));
}
