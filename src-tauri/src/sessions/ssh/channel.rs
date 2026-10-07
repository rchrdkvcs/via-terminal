use super::{
    closing, failure::Failure, handler::Client, sftp::LazyFiles, Command, Context, Link, Outcome,
    Size,
};
use crate::files::Owner;
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
    owner: Owner,
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
    let mut file_access = LazyFiles::new(&handle, context.id, owner, context.sink.clone());
    let closed_by_user = loop {
        tokio::select! {
            Some(call) = files.recv() => file_access.call(call),
            _ = file_access.progress() => {}
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
                None => break false,
            },
            _ = closing(&mut closed) => break true,
        }
    };
    let (file_service, mut file_requests) = file_access.finish();
    let outcome = if closed_by_user {
        Outcome::Closed
    } else {
        channel_ended(&mut handle, exit_code).await
    };
    let graceful = matches!(outcome, Outcome::Closed | Outcome::Exited(_));
    if let Some(service) = file_service {
        service.shutdown(graceful).await;
    }
    if graceful {
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
