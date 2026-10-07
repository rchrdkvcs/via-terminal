use super::{
    asker::{is_password_round, Asker, Stop},
    attempts::Sent,
    auth::Chain,
    failure::{Failure, Method},
};
use russh::{client::KeyboardInteractiveAuthResponse as Reply, MethodKind};

const USER_ATTEMPTS: usize = 3;

enum Round {
    Success,
    Refused { asked_user: bool },

    Silent,
}

pub(super) async fn run(
    chain: &mut Chain<'_>,
    asker: &Asker,
    mut stored: Option<&str>,
) -> Result<bool, Stop> {
    let mut attempts = 0;
    let mut keyboard = true;
    while attempts < USER_ATTEMPTS {
        if keyboard && chain.allows(MethodKind::KeyboardInteractive) {
            match keyboard_interactive(chain, asker, &mut stored).await? {
                Round::Success => return Ok(true),
                Round::Refused { asked_user } => attempts += usize::from(asked_user),
                Round::Silent => keyboard = false,
            }
        } else if chain.allows(MethodKind::Password) {
            attempts += 1;
            if password(chain, asker).await? {
                return Ok(true);
            }
        } else {
            break;
        }
    }
    Ok(false)
}

async fn keyboard_interactive(
    chain: &mut Chain<'_>,
    asker: &Asker,
    stored: &mut Option<&str>,
) -> Result<Round, Stop> {
    chain.attempt(Method::KeyboardInteractive);
    let (mut answered, mut asked_user) = (false, false);
    let mut reply = chain
        .handle
        .authenticate_keyboard_interactive_start(chain.username.clone(), None::<String>)
        .await;
    loop {
        let answers = match reply.map_err(|error| Failure::from_russh(&error))? {
            Reply::Success => {
                chain.attempts.answered(true);
                return Ok(Round::Success);
            }
            Reply::Failure {
                remaining_methods,
                partial_success,
            } => {
                chain.refused(remaining_methods)?;
                chain.attempts.answered(partial_success);
                return Ok(match answered {
                    false => Round::Silent,
                    true => Round::Refused { asked_user },
                });
            }
            Reply::InfoRequest { prompts, .. } if prompts.is_empty() => Vec::new(),
            Reply::InfoRequest { prompts, .. } if is_password_round(&prompts) => {
                answered = true;
                if let Some(password) = stored.take() {
                    chain.attempts.sent(Sent::Stored);
                    vec![password.to_string()]
                } else {
                    asked_user = true;
                    let (password, remember) = asker
                        .password(&chain.username, chain.attempts.retry())
                        .await?;
                    let answer = vec![password.to_string()];
                    chain.attempts.sent(Sent::Typed { password, remember });
                    answer
                }
            }
            Reply::InfoRequest {
                name,
                instructions,
                prompts,
            } => {
                (answered, asked_user) = (true, true);
                asker.fields(name, instructions, &prompts).await?
            }
        };
        reply = chain
            .handle
            .authenticate_keyboard_interactive_respond(answers)
            .await;
    }
}

async fn password(chain: &mut Chain<'_>, asker: &Asker) -> Result<bool, Stop> {
    let (password, remember) = asker
        .password(&chain.username, chain.attempts.retry())
        .await?;
    let typed = Sent::Typed {
        password: password.clone(),
        remember,
    };
    Ok(chain.password(&password, typed).await?)
}
