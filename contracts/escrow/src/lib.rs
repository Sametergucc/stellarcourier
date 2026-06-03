#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token,
    Address, Bytes, BytesN, Env,
};

// ── Storage ──────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Active,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone)]
pub struct EscrowState {
    pub sender:       Address,
    pub courier:      Address,
    pub token:        Address,
    pub amount:       i128,
    pub secret_hash:  BytesN<32>, // SHA-256 of QR secret
    pub expiry_ledger: u32,
    pub status:       Status,
}

#[contracttype]
pub enum DataKey {
    State,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Sender locks USDC and registers delivery.
    /// Frontend must call token.approve(sender, contract, amount, expiry) first.
    pub fn initialize(
        env:           Env,
        sender:        Address,
        courier:       Address,
        token:         Address,
        amount:        i128,
        secret_hash:   BytesN<32>,
        expiry_ledger: u32,
    ) {
        sender.require_auth();
        assert!(
            !env.storage().instance().has(&DataKey::State),
            "already initialized"
        );
        assert!(amount > 0, "amount must be positive");
        assert!(
            expiry_ledger > env.ledger().sequence(),
            "expiry must be in the future"
        );

        // Pull USDC from sender into this contract
        token::Client::new(&env, &token).transfer(
            &sender,
            &env.current_contract_address(),
            &amount,
        );

        env.storage().instance().set(
            &DataKey::State,
            &EscrowState { sender, courier, token, amount, secret_hash, expiry_ledger, status: Status::Active },
        );

        env.storage().instance().extend_ttl(expiry_ledger, expiry_ledger);
    }

    /// Courier submits the plain-text QR secret to release funds.
    pub fn release(env: Env, courier: Address, secret: Bytes) {
        courier.require_auth();

        let mut state: EscrowState = Self::load(&env);
        assert!(state.status == Status::Active, "escrow not active");
        assert!(state.courier == courier,        "unauthorized courier");

        let hash: BytesN<32> = env.crypto().sha256(&secret).into();
        assert!(hash == state.secret_hash, "invalid secret");

        token::Client::new(&env, &state.token).transfer(
            &env.current_contract_address(),
            &state.courier,
            &state.amount,
        );

        state.status = Status::Released;
        env.storage().instance().set(&DataKey::State, &state);
    }

    /// Sender reclaims USDC after expiry if courier never delivered.
    pub fn refund(env: Env) {
        let mut state: EscrowState = Self::load(&env);
        state.sender.require_auth();
        assert!(state.status == Status::Active,                      "escrow not active");
        assert!(env.ledger().sequence() > state.expiry_ledger, "not yet expired");

        token::Client::new(&env, &state.token).transfer(
            &env.current_contract_address(),
            &state.sender,
            &state.amount,
        );

        state.status = Status::Refunded;
        env.storage().instance().set(&DataKey::State, &state);
    }

    pub fn get_state(env: Env) -> EscrowState {
        Self::load(&env)
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn load(env: &Env) -> EscrowState {
        env.storage()
            .instance()
            .get(&DataKey::State)
            .expect("not initialized")
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test;
