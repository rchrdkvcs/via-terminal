//! The tab's single SFTP service, opened on first use. Opening is polled beside the shell
//! reader, never instead of it: a shell filling its channel cannot stall the session.
use super::{handler::Client, session_closed};
use crate::{
    error::{AppError, AppResult},
    files::{Call, Files, Owner},
    sessions::events::EventSink,
};
use russh::{client::Handle, ChannelMsg};
use std::{future::Future, pin::Pin, sync::Arc, time::Duration};
use tokio::task::JoinSet;
use uuid::Uuid;

const OPEN_TIMEOUT: Duration = Duration::from_secs(15);
type Opening<'a> = Pin<Box<dyn Future<Output = AppResult<Arc<Files>>> + Send + 'a>>;

pub(super) struct LazyFiles<'a> {
    handle: &'a Handle<Client>,
    session_id: Uuid,
    owner: Owner,
    sink: Arc<dyn EventSink>,
    opening: Option<Opening<'a>>,
    waiting: Vec<Call>,
    service: Option<Arc<Files>>,
    requests: JoinSet<()>,
}

impl<'a> LazyFiles<'a> {
    pub fn new(
        handle: &'a Handle<Client>,
        session_id: Uuid,
        owner: Owner,
        sink: Arc<dyn EventSink>,
    ) -> Self {
        Self {
            handle,
            session_id,
            owner,
            sink,
            opening: None,
            waiting: Vec::new(),
            service: None,
            requests: JoinSet::new(),
        }
    }

    /// Runs the call, or queues it behind the one opening attempt.
    pub fn call(&mut self, call: Call) {
        if let Some(service) = self.service.clone() {
            return self.run(service, call);
        }
        self.waiting.push(call);
        if self.opening.is_none() {
            let (session_id, owner, sink) =
                (self.session_id, self.owner.clone(), self.sink.clone());
            self.opening = Some(Box::pin(open(self.handle, session_id, owner, sink)));
        }
    }

    /// Advances the opening attempt and running requests; pending while idle.
    pub async fn progress(&mut self) {
        let opened = match self.opening.as_mut() {
            Some(opening) => tokio::select! {
                result = opening => Some(result),
                Some(_) = self.requests.join_next(), if !self.requests.is_empty() => None,
            },
            None if !self.requests.is_empty() => {
                self.requests.join_next().await;
                None
            }
            None => std::future::pending().await,
        };
        let Some(result) = opened else { return };
        self.opening = None;
        let waiting = std::mem::take(&mut self.waiting);
        match result {
            Ok(service) => {
                self.service = Some(service.clone());
                waiting
                    .into_iter()
                    .for_each(|call| self.run(service.clone(), call));
            }
            // A later call tries again.
            Err(error) => waiting.into_iter().for_each(|call| {
                let _ = call.reply.send(Err(error.clone()));
            }),
        }
    }

    /// Abandons an unfinished opening; queued calls learn that the session ended.
    pub fn finish(self) -> (Option<Arc<Files>>, JoinSet<()>) {
        for call in self.waiting {
            let _ = call.reply.send(Err(session_closed()));
        }
        (self.service, self.requests)
    }

    fn run(&mut self, service: Arc<Files>, call: Call) {
        self.requests.spawn(async move {
            let _ = call.reply.send(service.execute(call.request).await);
        });
    }
}

async fn open(
    handle: &Handle<Client>,
    session_id: Uuid,
    owner: Owner,
    sink: Arc<dyn EventSink>,
) -> AppResult<Arc<Files>> {
    let opening = async {
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|_| unavailable("Le serveur refuse le canal SFTP"))?;
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|_| unavailable("Le serveur ne propose pas SFTP"))?;
        let mut channel = channel;
        loop {
            match channel.wait().await {
                Some(ChannelMsg::Success) => break,
                Some(ChannelMsg::Failure) | None => {
                    return Err(unavailable("Le serveur ne propose pas SFTP"))
                }
                _ => {}
            }
        }
        Files::from_stream(channel.into_stream(), session_id, owner, sink).await
    };
    tokio::time::timeout(OPEN_TIMEOUT, opening)
        .await
        .unwrap_or_else(|_| Err(unavailable("Le serveur SFTP ne répond pas")))
}

fn unavailable(message: &str) -> AppError {
    AppError::new("sftp_unavailable", message)
}
