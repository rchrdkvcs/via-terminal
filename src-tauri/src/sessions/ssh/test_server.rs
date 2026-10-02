//! A tiny in-process SSH server for the client's end-to-end tests.
//!
//! It accepts user `via` with password `pw`, grants a PTY and a shell, echoes
//! every byte back, and ends the shell with status 0 on `exit\n`.

use russh::{
    keys::{ssh_key::private::Ed25519Keypair, HashAlg, PrivateKey},
    server::{self, Auth, ChannelOpenHandle, Msg, Session},
    Channel, ChannelId, MethodKind, MethodSet, Pty,
};
use std::{sync::Arc, time::Duration};
use tokio::net::TcpListener;
use uuid::Uuid;

pub struct TestServer {
    pub port: u16,
    /// The host key as the client should report it, `SHA256:…`.
    pub fingerprint: String,
}

pub async fn start() -> TestServer {
    let mut seed = [0u8; 32];
    seed[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    seed[16..].copy_from_slice(Uuid::new_v4().as_bytes());
    let key = PrivateKey::from(Ed25519Keypair::from_seed(&seed));
    let fingerprint = key.public_key().fingerprint(HashAlg::Sha256).to_string();
    let config = Arc::new(server::Config {
        methods: password_only(),
        auth_rejection_time: Duration::from_millis(10),
        auth_rejection_time_initial: Some(Duration::ZERO),
        keys: vec![key],
        ..Default::default()
    });
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let config = config.clone();
            tokio::spawn(async move {
                if let Ok(session) = server::run_stream(config, socket, Shell).await {
                    let _ = session.await;
                }
            });
        }
    });
    TestServer { port, fingerprint }
}

struct Shell;

impl server::Handler for Shell {
    type Error = russh::Error;

    async fn auth_password(&mut self, user: &str, password: &str) -> Result<Auth, Self::Error> {
        Ok(if user == "via" && password == "pw" {
            Auth::Accept
        } else {
            // Like OpenSSH, keep offering passwords; russh drops the method by default.
            Auth::Reject {
                proceed_with_methods: Some(password_only()),
                partial_success: false,
            }
        })
    }

    async fn channel_open_session(
        &mut self,
        _channel: Channel<Msg>,
        reply: ChannelOpenHandle,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        reply.accept().await;
        Ok(())
    }

    async fn pty_request(
        &mut self,
        _channel: ChannelId,
        _term: &str,
        _cols: u32,
        _rows: u32,
        _pix_width: u32,
        _pix_height: u32,
        _modes: &[(Pty, u32)],
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn shell_request(
        &mut self,
        _channel: ChannelId,
        _session: &mut Session,
    ) -> Result<(), Self::Error> {
        Ok(())
    }

    async fn data(
        &mut self,
        channel: ChannelId,
        data: &[u8],
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        if data == b"exit\n" {
            session.exit_status_request(channel, 0)?;
            session.eof(channel)?;
            session.close(channel)?;
        } else {
            session.data(channel, data.to_vec())?;
        }
        Ok(())
    }
}

fn password_only() -> MethodSet {
    MethodSet::from(&[MethodKind::Password][..])
}
