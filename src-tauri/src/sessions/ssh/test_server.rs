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

    pub fingerprint: String,
}

pub async fn start() -> TestServer {
    let mut seed = [0u8; 32];
    seed[..16].copy_from_slice(Uuid::new_v4().as_bytes());
    seed[16..].copy_from_slice(Uuid::new_v4().as_bytes());
    let key = PrivateKey::from(Ed25519Keypair::from_seed(&seed));
    let fingerprint = key.public_key().fingerprint(HashAlg::Sha256).to_string();
    let config = Arc::new(server::Config {
        methods: auth_methods(),
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
                if let Ok(session) = server::run_stream(config, socket, Shell::default()).await {
                    let _ = session.await;
                }
            });
        }
    });
    TestServer { port, fingerprint }
}

#[derive(Default)]
struct Shell {
    channels: std::collections::HashMap<ChannelId, Channel<Msg>>,
    shell: Option<ChannelId>,
    flood: bool,
}

impl server::Handler for Shell {
    type Error = russh::Error;

    async fn auth_publickey(
        &mut self,
        user: &str,
        _: &russh::keys::PublicKey,
    ) -> Result<Auth, Self::Error> {
        Ok(if user == "via-key" {
            Auth::Accept
        } else {
            Auth::Reject {
                proceed_with_methods: Some(auth_methods()),
                partial_success: false,
            }
        })
    }

    async fn auth_password(&mut self, user: &str, password: &str) -> Result<Auth, Self::Error> {
        Ok(if user == "via" && password == "pw" {
            Auth::Accept
        } else {
            Auth::Reject {
                proceed_with_methods: Some(auth_methods()),
                partial_success: false,
            }
        })
    }

    async fn channel_open_session(
        &mut self,
        channel: Channel<Msg>,
        reply: ChannelOpenHandle,
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        // Saturates the shell channel before confirming a later channel.
        match self.shell {
            Some(shell) if self.flood => {
                for line in 0..500 {
                    session.data(shell, format!("line {line}\n").into_bytes())?;
                }
            }
            _ => self.shell = Some(channel.id()),
        }
        self.channels.insert(channel.id(), channel);
        reply.accept().await;
        Ok(())
    }

    async fn subsystem_request(
        &mut self,
        channel: ChannelId,
        name: &str,
        session: &mut Session,
    ) -> Result<(), Self::Error> {
        if name == "sftp" {
            session.channel_success(channel)?;
            let stream = self.channels.remove(&channel).unwrap().into_stream();
            russh_sftp::server::run(stream, crate::files::test_peer::Peer::new(true)).await;
        } else {
            session.channel_failure(channel)?;
        }
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
        if !self.channels.contains_key(&channel) {
            return Ok(());
        }
        if data == b"flood\n" {
            self.flood = true;
            session.data(channel, b"flooding\n".to_vec())?;
        } else if data == b"exit\n" {
            session.exit_status_request(channel, 0)?;
            session.eof(channel)?;
            session.close(channel)?;
        } else {
            session.data(channel, data.to_vec())?;
        }
        Ok(())
    }
}

fn auth_methods() -> MethodSet {
    MethodSet::from(&[MethodKind::Password, MethodKind::PublicKey][..])
}
