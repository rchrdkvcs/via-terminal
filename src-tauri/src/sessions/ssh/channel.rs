use super::{closing, failure::Failure, handler::Client, Command, Context, Link, Outcome, Size};
use crate::sessions::events::{Event, SessionState};
use russh::{
    client::{Handle, Msg},
    Channel, ChannelMsg, ChannelWriteHalf, Disconnect,
};
use std::{sync::atomic::Ordering, time::Duration};
use tokio::{sync::mpsc::UnboundedReceiver, time::timeout};

pub(super) async fn open(handle: &Handle<Client>, size: Size) -> Result<Channel<Msg>, Failure> {
    let shell_failure = |error: russh::Error| match Failure::from_russh(&error) {
        Failure::Handshake => Failure::Shell,
        failure => failure,
    };
    let channel = handle.channel_open_session().await.map_err(shell_failure)?;
    channel
        .request_pty(
            false,
            "xterm-256color",
            size.cols.into(),
            size.rows.into(),
            0,
            0,
            &[],
        )
        .await
        .map_err(shell_failure)?;
    channel.request_shell(false).await.map_err(shell_failure)?;
    Ok(channel)
}

pub(super) async fn pump(
    mut handle: Handle<Client>,
    shell: Channel<Msg>,
    link: Link,
    context: &Context,
    owner: String,
) -> Outcome {
    let Link {
        commands,
        mut files,
        ready,
        mut closed,
    } = link;
    let (mut reader, writer) = shell.split();
    let input = tokio::spawn(forward_input(writer, commands));
    ready.store(true, Ordering::Release);
    context.sink.state(context.id, SessionState::Ready, None);
    let mut exit_code = None;
    let mut file_session: Option<std::sync::Arc<crate::files::Files>> = None;
    let mut file_requests = tokio::task::JoinSet::new();
    let outcome = loop {
        tokio::select! {
            Some(call) = files.recv() => {
                if file_session.is_none() {
                    let opening = async {
                        let mut channel = handle.channel_open_session().await.map_err(|_| crate::error::AppError::new("sftp_unavailable", "Le serveur refuse le canal SFTP"))?;
                        channel.request_subsystem(true, "sftp").await.map_err(|_| crate::error::AppError::new("sftp_unavailable", "Le serveur ne propose pas SFTP"))?;
                        loop {
                            match channel.wait().await {
                                Some(ChannelMsg::Success) => break,
                                Some(ChannelMsg::Failure) | None => return Err(crate::error::AppError::new("sftp_unavailable", "Le serveur ne propose pas SFTP")),
                                _ => {},
                            }
                        }
                        let mut session = crate::files::Files::from_stream(channel.into_stream(), context.id, context.sink.clone()).await?;
                        std::sync::Arc::get_mut(&mut session).unwrap().owner = owner.clone();
                        Ok(session)
                    };
                    let opened = tokio::select! {
                        result = tokio::time::timeout(Duration::from_secs(15), opening) => result.unwrap_or_else(|_| Err(crate::error::AppError::new("sftp_unavailable", "Le serveur SFTP ne répond pas"))),
                        _ = closing(&mut closed) => Err(super::session_closed()),
                    };
                    match opened {
                        Ok(session) => file_session = Some(session),
                        Err(error) => { let _ = call.reply.send(Err(error)); continue; }
                    }
                }
                let session = file_session.as_ref().unwrap().clone();
                file_requests.spawn(async move { let result = session.execute(call.request).await; let _ = call.reply.send(result); });
            },
            Some(_) = file_requests.join_next(), if !file_requests.is_empty() => {},
            message = reader.wait() => match message {
                Some(ChannelMsg::Data { data }) | Some(ChannelMsg::ExtendedData { data, .. }) => {
                    context.sink.emit(Event::Output {
                        session_id: context.id,
                        data: data.to_vec(),
                    });
                }
                Some(ChannelMsg::ExitStatus { exit_status }) => {
                    exit_code = i32::try_from(exit_status).ok();
                }
                Some(_) => {}
                None => break channel_ended(&mut handle, exit_code).await,
            },
            _ = closing(&mut closed) => {
                break Outcome::Closed;
            }
        }
    };
    if let Some(session) = file_session {
        session
            .shutdown(matches!(outcome, Outcome::Closed | Outcome::Exited(_)))
            .await;
    }
    if matches!(outcome, Outcome::Closed | Outcome::Exited(_)) {
        disconnect(&handle).await;
    }
    file_requests.abort_all();
    ready.store(false, Ordering::Release);
    input.abort();
    outcome
}

async fn forward_input(writer: ChannelWriteHalf<Msg>, mut commands: UnboundedReceiver<Command>) {
    while let Some(command) = commands.recv().await {
        let sent = match command {
            Command::Write(data) => writer.data_bytes(data).await,
            Command::Resize(size) => {
                writer
                    .window_change(size.cols.into(), size.rows.into(), 0, 0)
                    .await
            }
        };
        if sent.is_err() {
            break;
        }
    }
}

async fn channel_ended(handle: &mut Handle<Client>, exit_code: Option<i32>) -> Outcome {
    if exit_code.is_some() {
        return Outcome::Exited(exit_code);
    }
    match timeout(Duration::from_millis(500), &mut *handle).await {
        Ok(_) => Outcome::Disconnected,
        Err(_) => Outcome::Exited(None),
    }
}

async fn disconnect(handle: &Handle<Client>) {
    let _ = handle.disconnect(Disconnect::ByApplication, "", "fr").await;
}
