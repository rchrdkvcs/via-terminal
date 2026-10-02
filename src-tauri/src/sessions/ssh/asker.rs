//! The questions authentication asks the user, on behalf of one session.
//!
//! Any answer other than the expected one, including the `Cancel` a closed
//! session resolves to, stops the connection as cancelled.

use super::{failure::Failure, ConnectPlan, Context};
use crate::sessions::prompts::{Prompt, PromptAnswer, PromptField, Prompts};
use russh::client::Prompt as Field;
use std::sync::Arc;
use uuid::Uuid;
use zeroize::Zeroizing;

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

    pub async fn username(&self) -> Result<String, Failure> {
        let prompt = Prompt::Username {
            address: self.address.clone(),
        };
        match self.ask(prompt).await {
            PromptAnswer::Text { value, .. } if !value.trim().is_empty() => {
                Ok(value.trim().to_string())
            }
            _ => Err(Failure::Cancelled),
        }
    }

    /// The typed password, and whether the user asked to remember it.
    pub async fn password(
        &self,
        username: &str,
        retry: bool,
    ) -> Result<(Zeroizing<String>, bool), Failure> {
        let prompt = Prompt::Password {
            username: username.to_string(),
            address: self.address.clone(),
            can_remember: self.can_remember,
            retry,
        };
        match self.ask(prompt).await {
            PromptAnswer::Text { value, remember } => Ok((Zeroizing::new(value), remember)),
            _ => Err(Failure::Cancelled),
        }
    }

    /// One keyboard-interactive round, one answer per field.
    pub async fn fields(
        &self,
        name: String,
        instructions: String,
        prompts: &[Field],
    ) -> Result<Vec<String>, Failure> {
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
            _ => Err(Failure::Cancelled),
        }
    }
}

/// One hidden field asking for a password, as PAM sends it.
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
