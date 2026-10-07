use super::{
    asker::Asker,
    failure::{Failure, Method},
    handler::Client,
    interactive, keys, ConnectPlan, PlanKey, Remembered,
};
use russh::{
    client::{AuthResult, Handle},
    keys::{HashAlg, PrivateKeyWithHashAlg},
    MethodKind, MethodSet,
};
use std::sync::Arc;

pub(super) struct Chain<'a> {
    pub handle: &'a mut Handle<Client>,
    pub username: String,
    methods: MethodSet,
    tried: Vec<Method>,

    pub password_failed: bool,
    pub remembered: Remembered,
}

impl Chain<'_> {
    pub fn allows(&self, method: MethodKind) -> bool {
        self.methods.contains(&method)
    }

    pub fn attempt(&mut self, method: Method) {
        if !self.tried.contains(&method) {
            self.tried.push(method);
        }
    }

    pub fn settle(&mut self, result: Result<AuthResult, russh::Error>) -> Result<bool, Failure> {
        match result.map_err(|error| Failure::from_russh(&error))? {
            AuthResult::Success => Ok(true),
            AuthResult::Failure {
                remaining_methods, ..
            } => self.refused(remaining_methods).map(|_| false),
        }
    }

    pub fn refused(&mut self, remaining_methods: MethodSet) -> Result<(), Failure> {
        if self.handle.is_closed() {
            return Err(Failure::Closed);
        }
        self.methods = remaining_methods;
        Ok(())
    }

    async fn key(&mut self, key: &PlanKey, asker: &Asker) -> Result<bool, Failure> {
        let Some(unlocked) = keys::unlock(key, asker).await else {
            return Ok(false);
        };
        self.attempt(Method::Key);
        let hash = if unlocked.key.algorithm().is_rsa() {
            match self.handle.best_supported_rsa_hash().await {
                Ok(Some(hash)) => hash,
                _ => Some(HashAlg::Sha256),
            }
        } else {
            None
        };
        let key_with_hash = PrivateKeyWithHashAlg::new(Arc::new(unlocked.key), hash);
        let result = self
            .handle
            .authenticate_publickey(self.username.clone(), key_with_hash)
            .await;
        let partial = matches!(
            result,
            Ok(AuthResult::Failure {
                partial_success: true,
                ..
            })
        );
        let accepted = self.settle(result)?;
        if accepted || partial {
            if let Some(passphrase) = unlocked.remember {
                self.remembered.passphrase = Some((key.id, passphrase));
            }
        }
        Ok(accepted)
    }

    async fn stored_password(&mut self, password: &str) -> Result<bool, Failure> {
        self.attempt(Method::Password);
        let result = self
            .handle
            .authenticate_password(self.username.clone(), password)
            .await;
        let accepted = self.settle(result)?;
        self.password_failed = !accepted;
        Ok(accepted)
    }
}

pub(super) async fn authenticate(
    handle: &mut Handle<Client>,
    plan: &ConnectPlan,
    asker: &Asker,
) -> Result<(String, Remembered), Failure> {
    let username = match plan
        .username
        .as_ref()
        .filter(|name| !name.trim().is_empty())
    {
        Some(username) => username.clone(),
        None => asker.username().await?,
    };
    let mut chain = Chain {
        handle,
        username,
        methods: MethodSet::empty(),
        tried: Vec::new(),
        password_failed: false,
        remembered: Remembered::default(),
    };
    let result = chain.handle.authenticate_none(chain.username.clone()).await;
    let mut done = chain.settle(result)?;
    if let Some(key) = plan.key.as_ref().filter(|_| !done) {
        done = chain.allows(MethodKind::PublicKey) && chain.key(key, asker).await?;
    }
    let stored = plan.password.as_deref().map(String::as_str);
    let mut stored_unused = stored;
    if let Some(password) = stored.filter(|_| !done && chain.allows(MethodKind::Password)) {
        done = chain.stored_password(password).await?;
        stored_unused = None;
    }
    if !done {
        done = interactive::run(&mut chain, asker, stored_unused).await?;
    }
    if done {
        Ok((chain.username, chain.remembered))
    } else {
        Err(Failure::Rejected { tried: chain.tried })
    }
}
