use super::{closing, failure::Failure, handler::Client, Command, Context, Outcome, Size};
use crate::sessions::events::{Event, SessionState};
use russh::{
    client::{Handle, Msg},
    Channel, ChannelMsg, ChannelWriteHalf, Disconnect,
};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tokio::{
    sync::{mpsc::UnboundedReceiver, watch},
    time::timeout,
};

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
    commands: UnboundedReceiver<Command>,
    ready: &AtomicBool,
    mut closed: watch::Receiver<bool>,
    context: &Context,
) -> Outcome {
    let (mut reader, writer) = shell.split();
    let input = tokio::spawn(forward_input(writer, commands));
    ready.store(true, Ordering::Release);
    context.sink.state(context.id, SessionState::Ready, None);
    let mut exit_code = None;
    let outcome = loop {
        tokio::select! {
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
                disconnect(&handle).await;
                break Outcome::Closed;
            }
        }
    };
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
        disconnect(handle).await;
        return Outcome::Exited(exit_code);
    }
    match timeout(Duration::from_millis(500), &mut *handle).await {
        Ok(_) => Outcome::Disconnected,
        Err(_) => {
            disconnect(handle).await;
            Outcome::Exited(None)
        }
    }
}

async fn disconnect(handle: &Handle<Client>) {
    let _ = handle.disconnect(Disconnect::ByApplication, "", "fr").await;
}
