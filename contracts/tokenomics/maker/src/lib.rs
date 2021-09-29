extern crate core;
extern crate cosmwasm_std;

pub mod contract;
mod error;
pub mod msg;
pub mod state;

#[cfg(test)]
mod testing;