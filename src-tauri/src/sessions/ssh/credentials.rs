use super::{asker::Asker, failure::Failure, ConnectPlan, Context};
use crate::sessions::prompts::{Prompt, PromptAnswer};
use zeroize::Zeroizing;

pub(super) async fn choose(
    plan: &mut ConnectPlan,
    context: &Context,
) -> Result<Option<Zeroizing<String>>, Failure> {
    let asker = Asker::new(context, plan);
    match asker
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
            Ok(None)
        }
        PromptAnswer::Authentication {
            username,
            password,
            remember,
        } if !username.trim().is_empty() => {
            plan.username = Some(username.trim().to_string());
            plan.credential = Some(super::CredentialChoice::Password {
                username: username.trim().to_string(),
            });
            plan.password = Some(Zeroizing::new(password));
            Ok(if remember && plan.can_remember {
                plan.password.clone()
            } else {
                None
            })
        }
        // Text answers remain supported for clients that already know the username.
        PromptAnswer::Text { value, remember } if plan.username.is_some() => {
            plan.password = Some(Zeroizing::new(value));
            Ok(if remember && plan.can_remember {
                plan.password.clone()
            } else {
                None
            })
        }
        _ => Err(Failure::Cancelled),
    }
}
