use super::{
    asker::{is_password_round, Asker},
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
) -> Result<bool, Failure> {
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
) -> Result<Round, Failure> {
    chain.attempt(Method::KeyboardInteractive);
    let (mut answered, mut asked_user, mut password_sent) = (false, false, false);
    let mut typed = None;
    let mut used_stored = false;
    let mut reply = chain
        .handle
        .authenticate_keyboard_interactive_start(chain.username.clone(), None::<String>)
        .await;
    loop {
        let answers = match reply.map_err(|error| Failure::from_russh(&error))? {
            Reply::Success => {
                chain.remembered.password_verified |= used_stored;
                chain.remembered.password = typed.or(chain.remembered.password.take());
                return Ok(Round::Success);
            }
            Reply::Failure {
                remaining_methods, ..
            } => {
                chain.refused(remaining_methods)?;
                chain.password_failed |= password_sent;
                return Ok(match answered {
                    false => Round::Silent,
                    true => Round::Refused { asked_user },
                });
            }
            Reply::InfoRequest { prompts, .. } if prompts.is_empty() => Vec::new(),
            Reply::InfoRequest { prompts, .. } if is_password_round(&prompts) => {
                (answered, password_sent) = (true, true);
                if let Some(password) = stored.take() {
                    used_stored = true;
                    vec![password.to_string()]
                } else {
                    asked_user = true;
                    used_stored = false;
                    chain.remembered.password_verified = false;
                    let (password, remember) = asker
                        .password(&chain.username, chain.password_failed)
                        .await?;
                    let answer = vec![password.to_string()];
                    typed = remember.then_some(password);
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

async fn password(chain: &mut Chain<'_>, asker: &Asker) -> Result<bool, Failure> {
    chain.attempt(Method::Password);
    chain.remembered.password_verified = false;
    let (password, remember) = asker
        .password(&chain.username, chain.password_failed)
        .await?;
    let result = chain
        .handle
        .authenticate_password(chain.username.clone(), password.as_str())
        .await;
    let accepted = chain.settle(result)?;
    chain.password_failed = !accepted;
    if accepted && remember {
        chain.remembered.password = Some(password);
    }
    Ok(accepted)
}
