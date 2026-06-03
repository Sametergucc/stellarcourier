#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Bytes, BytesN, Env,
};

fn make_hash(env: &Env, data: &[u8]) -> BytesN<32> {
    env.crypto().sha256(&Bytes::from_slice(env, data)).into()
}

#[test]
fn happy_path_release() {
    let env = Env::default();
    env.mock_all_auths();

    let sender  = Address::generate(&env);
    let courier = Address::generate(&env);
    let admin   = Address::generate(&env);

    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    StellarAssetClient::new(&env, &token).mint(&sender, &10_000_000);

    let contract = env.register_contract(None, EscrowContract);
    let client   = EscrowContractClient::new(&env, &contract);

    let secret      = Bytes::from_slice(&env, b"qr-secret-abc123");
    let secret_hash = make_hash(&env, b"qr-secret-abc123");

    client.initialize(&sender, &courier, &token, &1_000_000, &secret_hash, &1000);

    assert_eq!(TokenClient::new(&env, &token).balance(&contract), 1_000_000);

    client.release(&courier, &secret);

    assert_eq!(TokenClient::new(&env, &token).balance(&courier),  1_000_000);
    assert_eq!(TokenClient::new(&env, &token).balance(&contract), 0);
    assert_eq!(client.get_state().status, Status::Released);
}

#[test]
fn happy_path_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let sender  = Address::generate(&env);
    let courier = Address::generate(&env);
    let admin   = Address::generate(&env);

    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    StellarAssetClient::new(&env, &token).mint(&sender, &10_000_000);

    let contract = env.register_contract(None, EscrowContract);
    let client   = EscrowContractClient::new(&env, &contract);

    let secret_hash = make_hash(&env, b"secret");
    client.initialize(&sender, &courier, &token, &1_000_000, &secret_hash, &500);

    env.ledger().with_mut(|l| l.sequence_number = 501);
    client.refund();

    assert_eq!(TokenClient::new(&env, &token).balance(&sender), 10_000_000);
    assert_eq!(client.get_state().status, Status::Refunded);
}

#[test]
#[should_panic(expected = "invalid secret")]
fn wrong_secret_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let sender  = Address::generate(&env);
    let courier = Address::generate(&env);
    let admin   = Address::generate(&env);

    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    StellarAssetClient::new(&env, &token).mint(&sender, &10_000_000);

    let contract = env.register_contract(None, EscrowContract);
    let client   = EscrowContractClient::new(&env, &contract);

    let secret_hash = make_hash(&env, b"correct-secret");
    client.initialize(&sender, &courier, &token, &1_000_000, &secret_hash, &1000);
    client.release(&courier, &Bytes::from_slice(&env, b"wrong-secret"));
}

#[test]
#[should_panic(expected = "not yet expired")]
fn early_refund_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let sender  = Address::generate(&env);
    let courier = Address::generate(&env);
    let admin   = Address::generate(&env);

    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    StellarAssetClient::new(&env, &token).mint(&sender, &10_000_000);

    let contract = env.register_contract(None, EscrowContract);
    let client   = EscrowContractClient::new(&env, &contract);

    let secret_hash = make_hash(&env, b"secret");
    client.initialize(&sender, &courier, &token, &1_000_000, &secret_hash, &1000);
    client.refund(); // sequence still 0
}
