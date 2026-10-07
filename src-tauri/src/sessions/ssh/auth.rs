use super::{
    asker::{Asker, Stop},
    attempts::{Attempts, Sent},
    failure::{Failure, Method},
    handler::Client,
    interactive, keys, ConnectPlan, Context, CredentialChoice, PlanKey, Remembered,
};
use crate::sessions::prompts::{Prompt, PromptAnswer};
use russh::{
    client::{AuthResult, Handle},
    keys::{HashAlg, PrivateKeyWithHashAlg},
    MethodKind, MethodSet,
};
use std::sync::Arc;
use zeroize::Zeroizing;

pub(super) enum Authentication {
    Authenticated {
        username: String,
        remembered: Remembered,
    },
    /// The user picked another credential; the server may refuse a new username on this connection.
    Switched(CredentialChoice),
}

pub(super) struct Chain<'a> {
    pub handle: &'a mut Handle<Client>,
    pub username: String,
    methods: MethodSet,
    tried: Vec<Method>,

    pub attempts: Attempts,
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

    pub async fn password(&mut self, password: &str, sent: Sent) -> Result<bool, Failure> {
        self.attempt(Method::Password);
        let result = self
            .handle
            .authenticate_password(self.username.clone(), password)
            .await;
        self.attempts.sent(sent);
        let partial = partial(&result);
        let accepted = self.settle(result)?;
        self.attempts.answered(accepted || partial);
        Ok(accepted)
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
        let partial = partial(&result);
        let accepted = self.settle(result)?;
        if accepted || partial {
            if let Some(passphrase) = unlocked.remember {
                self.attempts.unlocked(key.id, passphrase);
            }
        }
        Ok(accepted)
    }
}

fn partial(result: &Result<AuthResult, russh::Error>) -> bool {
    matches!(
        result,
        Ok(AuthResult::Failure {
            partial_success: true,
            ..
        })
    )
}

pub(super) async fn authenticate(
    handle: &mut Handle<Client>,
    plan: &mut ConnectPlan,
    context: &Context,
) -> Result<Authentication, Failure> {
    let opening = if plan.key.is_none() && plan.password.is_none() && plan.credential.is_none() {
        open(plan, context).await?
    } else {
        None
    };
    let asker = Asker::new(context, plan);
    let attempts = Attempts::new(plan.can_remember, opening);
    match chain(handle, plan, &asker, attempts).await {
        Ok((username, remembered)) => Ok(Authentication::Authenticated {
            username,
            remembered,
        }),
        Err(Stop::Switch(choice)) => Ok(Authentication::Switched(choice)),
        Err(Stop::Failed(failure)) => Err(failure),
    }
}

/// Asks how to authenticate when the plan knows nothing; returns the password to remember.
async fn open(
    plan: &mut ConnectPlan,
    context: &Context,
) -> Result<Option<Zeroizing<String>>, Failure> {
    let asker = Asker::new(context, plan);
    let (password, remember) = match asker
        .ask(Prompt::Authentication {
            address: plan.address.clone(),
            username: plan.username.clone(),
            can_remember: plan.can_remember,
        })
        .await
    {
        PromptAnswer::Credential { credential } => {
            context
                .store
                .select_credential(plan, credential)
                .map_err(|_| Failure::CredentialUnavailable)?;
            return Ok(None);
        }
        PromptAnswer::Authentication {
            username,
            password,
            remember,
        } if !username.trim().is_empty() => {
            plan.username = Some(username.trim().to_string());
            plan.credential = Some(CredentialChoice::Password {
                username: username.trim().to_string(),
            });
            (password, remember)
        }
        // Text answers remain supported for clients that already know the username.
        PromptAnswer::Text { value, remember } if plan.username.is_some() => (value, remember),
        _ => return Err(Failure::Cancelled),
    };
    let password = Zeroizing::new(password);
    plan.password = Some(password.clone());
    Ok(remember.then_some(password))
}

async fn chain(
    handle: &mut Handle<Client>,
    plan: &ConnectPlan,
    asker: &Asker,
    attempts: Attempts,
) -> Result<(String, Remembered), Stop> {
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
        attempts,
    };
    let result = chain.handle.authenticate_none(chain.username.clone()).await;
    let mut done = chain.settle(result)?;
    if let Some(key) = plan.key.as_ref().filter(|_| !done) {
        done = chain.allows(MethodKind::PublicKey) && chain.key(key, asker).await?;
    }
    let stored = plan.password.as_deref().map(String::as_str);
    let mut stored_unused = stored;
    if let Some(password) = stored.filter(|_| !done && chain.allows(MethodKind::Password)) {
        done = chain.password(password, Sent::Stored).await?;
        stored_unused = None;
    }
    if !done {
        done = interactive::run(&mut chain, asker, stored_unused).await?;
    }
    if done {
        Ok((chain.username, chain.attempts.remembered()))
    } else {
        Err(Failure::Rejected { tried: chain.tried }.into())
    }
}
