use super::{failure::Failure, ConnectPlan, Context, CredentialChoice};
use crate::sessions::prompts::{Prompt, PromptAnswer, PromptField, Prompts};
use russh::client::Prompt as Field;
use std::sync::Arc;
use uuid::Uuid;
use zeroize::Zeroizing;

/// Ends an authentication early: on failure, or because the user picked another credential.
pub(super) enum Stop {
    Failed(Failure),
    Switch(CredentialChoice),
}

impl From<Failure> for Stop {
    fn from(failure: Failure) -> Self {
        Stop::Failed(failure)
    }
}

pub(super) struct Asker {
    id: Uuid,
    prompts: Arc<Prompts>,
    address: String,
    pub can_remember: bool,
}

impl Asker {
    pub fn new(context: &Context, plan: &ConnectPlan) -> Self {
        Self {
            id: context.id,
            prompts: context.prompts.clone(),
            address: plan.address.clone(),
            can_remember: plan.can_remember,
        }
    }

    pub async fn ask(&self, prompt: Prompt) -> PromptAnswer {
        self.prompts.ask(self.id, prompt).await
    }

    pub async fn username(&self) -> Result<String, Stop> {
        let prompt = Prompt::Username {
            address: self.address.clone(),
        };
        match self.ask(prompt).await {
            PromptAnswer::Text { value, .. } if !value.trim().is_empty() => {
                Ok(value.trim().to_string())
            }
            PromptAnswer::Credential { credential } => Err(Stop::Switch(credential)),
            _ => Err(Failure::Cancelled.into()),
        }
    }

    pub async fn password(
        &self,
        username: &str,
        retry: bool,
    ) -> Result<(Zeroizing<String>, bool), Stop> {
        let prompt = Prompt::Password {
            username: username.to_string(),
            address: self.address.clone(),
            can_remember: self.can_remember,
            retry,
        };
        match self.ask(prompt).await {
            PromptAnswer::Text { value, remember } => Ok((Zeroizing::new(value), remember)),
            PromptAnswer::Credential { credential } => Err(Stop::Switch(credential)),
            _ => Err(Failure::Cancelled.into()),
        }
    }

    pub async fn fields(
        &self,
        name: String,
        instructions: String,
        prompts: &[Field],
    ) -> Result<Vec<String>, Stop> {
        let fields = prompts
            .iter()
            .map(|field| PromptField {
                label: field.prompt.clone(),
                echo: field.echo,
            })
            .collect();
        let prompt = Prompt::KeyboardInteractive {
            name,
            instructions,
            fields,
        };
        match self.ask(prompt).await {
            PromptAnswer::Fields { values } if values.len() == prompts.len() => Ok(values),
            PromptAnswer::Credential { credential } => Err(Stop::Switch(credential)),
            _ => Err(Failure::Cancelled.into()),
        }
    }
}

pub(super) fn is_password_round(prompts: &[Field]) -> bool {
    let [field] = prompts else { return false };
    let label = field.prompt.to_lowercase();
    !field.echo
        && ["password", "mot de passe", "passwort"]
            .iter()
            .any(|word| label.contains(word))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field(prompt: &str, echo: bool) -> Field {
        Field {
            prompt: prompt.into(),
            echo,
        }
    }

    #[test]
    fn a_single_hidden_password_field_is_a_password_round() {
        assert!(is_password_round(&[field("Password: ", false)]));
        assert!(is_password_round(&[field("Mot de passe : ", false)]));
        assert!(!is_password_round(&[field("Verification code: ", false)]));
        assert!(!is_password_round(&[field("Password: ", true)]));
        assert!(!is_password_round(&[
            field("Password: ", false),
            field("Token: ", false)
        ]));
    }
}
