use super::{ConnectPlan, ConnectionStore, Context, HostKeyStatus, ServerKey};
use crate::sessions::{
    events::{Event, EventSink, SessionState},
    prompts::{Prompt, PromptAnswer, Prompts},
};
use russh::{
    client,
    keys::{HashAlg, PublicKeyOrCertificate},
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use uuid::Uuid;

pub(super) struct Client {
    id: Uuid,
    host_id: Option<Uuid>,
    address: String,
    port: u16,
    sink: Arc<dyn EventSink>,
    prompts: Arc<Prompts>,
    store: Arc<dyn ConnectionStore>,

    verifying: Arc<AtomicBool>,
}

impl Client {
    pub fn new(context: &Context, plan: &ConnectPlan, verifying: Arc<AtomicBool>) -> Self {
        Self {
            id: context.id,
            host_id: plan.host_id,
            address: plan.address.clone(),
            port: plan.port,
            sink: context.sink.clone(),
            prompts: context.prompts.clone(),
            store: context.store.clone(),
            verifying,
        }
    }

    async fn verify(&self, key: ServerKey) -> bool {
        let previous_fingerprint = match self.store.host_key_status(&self.address, self.port, &key)
        {
            HostKeyStatus::Trusted => return true,
            HostKeyStatus::Unknown => None,
            HostKeyStatus::Changed {
                previous_fingerprint,
            } => Some(previous_fingerprint),
        };
        let prompt = Prompt::HostKey {
            address: self.address.clone(),
            port: self.port,
            algorithm: key.algorithm.clone(),
            fingerprint: key.fingerprint.clone(),
            previous_fingerprint,
        };
        if self.prompts.ask(self.id, prompt).await != PromptAnswer::Accept {
            return false;
        }

        if self
            .store
            .trust_host_key(&self.address, self.port, &key)
            .is_ok()
        {
            self.sink.emit(Event::VaultChanged {
                session_id: self.id,
                host_id: self.host_id,
            });
        }
        true
    }
}

fn server_key(key: &PublicKeyOrCertificate) -> ServerKey {
    let public = key.public_key();
    ServerKey {
        algorithm: public.algorithm().to_string(),
        fingerprint: public.fingerprint(HashAlg::Sha256).to_string(),
    }
}

impl client::Handler for Client {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        if !self.verifying.swap(true, Ordering::AcqRel) {
            self.sink.state(self.id, SessionState::Verifying, None);
        }
        Ok(self.verify(server_key(server_public_key)).await)
    }
}
