use super::{
    asker::Asker, auth, channel, closing, failure::Failure, handler::Client, ConnectPlan, Context,
    Link, Outcome, Size,
};
use crate::sessions::events::{Event, SessionState};
use russh::{client, Channel};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{
    net::{lookup_host, TcpStream},
    time::{sleep, timeout},
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

pub(super) async fn run(plan: ConnectPlan, size: Size, context: Context, link: Link) {
    let Link {
        commands,
        files,
        mut closed,
        ready,
    } = link;
    let prepared = tokio::select! {
        prepared = prepare(&plan, size, &context) => Some(prepared),
        _ = closing(&mut closed) => None,
    };
    let outcome = match prepared {
        None => Outcome::Closed,
        Some(Err(failure)) => Outcome::Failed(failure),
        Some(Ok((handle, shell, owner))) => {
            channel::pump(
                handle,
                shell,
                Link {
                    commands,
                    files,
                    ready,
                    closed,
                },
                &context,
                owner,
            )
            .await
        }
    };
    context.ending.ended();
    report(&context, &plan, outcome);
}

async fn prepare(
    plan: &ConnectPlan,
    size: Size,
    context: &Context,
) -> Result<(client::Handle<Client>, Channel<client::Msg>, String), Failure> {
    let message = format!("Connexion à {}:{}…", plan.address, plan.port);
    context
        .sink
        .state(context.id, SessionState::Connecting, Some(message));
    let stream = tcp(&plan.address, plan.port).await?;
    let mut handle = handshake(stream, plan, context).await?;
    context
        .sink
        .state(context.id, SessionState::Authenticating, None);
    let asker = Asker::new(context, plan);
    let (username, remembered) = auth::authenticate(&mut handle, plan, &asker).await?;

    if let Ok(Some(host_id)) = context.store.authenticated(plan, &username, remembered) {
        context.sink.emit(Event::VaultChanged {
            session_id: context.id,
            host_id: Some(host_id),
        });
    }
    let shell = channel::open(&handle, size).await?;
    Ok((
        handle,
        shell,
        serde_json::json!([plan.address, plan.port, username]).to_string(),
    ))
}

async fn tcp(address: &str, port: u16) -> Result<TcpStream, Failure> {
    let addresses: Vec<_> = timeout(CONNECT_TIMEOUT, lookup_host((address, port)))
        .await
        .map_err(|_| Failure::Timeout)?
        .map_err(|_| Failure::Resolve)?
        .collect();
    let mut failure = Failure::Resolve;
    for socket_address in addresses {
        match timeout(CONNECT_TIMEOUT, TcpStream::connect(socket_address)).await {
            Ok(Ok(stream)) => {
                let _ = stream.set_nodelay(true);
                return Ok(stream);
            }
            Ok(Err(error)) => failure = Failure::from_io(&error),
            Err(_) => failure = Failure::Timeout,
        }
    }
    Err(failure)
}

async fn handshake(
    stream: TcpStream,
    plan: &ConnectPlan,
    context: &Context,
) -> Result<client::Handle<Client>, Failure> {
    let config = Arc::new(client::Config {
        inactivity_timeout: None,
        keepalive_interval: Some(Duration::from_secs(30)),
        keepalive_max: 3,
        nodelay: true,
        ..Default::default()
    });
    let verifying = Arc::new(AtomicBool::new(false));
    let handler = Client::new(context, plan, verifying.clone());
    let handshake = client::connect_stream(config, stream, handler);
    tokio::pin!(handshake);
    let early = tokio::select! {
        result = &mut handshake => Some(result),
        _ = sleep(CONNECT_TIMEOUT) => None,
    };
    let result = match early {
        Some(result) => result,
        None if verifying.load(Ordering::Acquire) => handshake.await,
        None => return Err(Failure::Timeout),
    };
    result.map_err(|error| Failure::from_russh(&error))
}

fn report(context: &Context, plan: &ConnectPlan, outcome: Outcome) {
    let (state, message, exit_code) = match outcome {
        Outcome::Exited(code) => (SessionState::Exited, None, code),
        Outcome::Closed => (SessionState::Exited, None, None),
        Outcome::Disconnected => (
            SessionState::Disconnected,
            Some(Failure::disconnected(&plan.address)),
            None,
        ),
        Outcome::Failed(failure) => (
            SessionState::Failed,
            Some(failure.message(&plan.address, plan.port)),
            None,
        ),
    };
    context.sink.emit(Event::State {
        session_id: context.id,
        state,
        message,
        exit_code,
    });
}
