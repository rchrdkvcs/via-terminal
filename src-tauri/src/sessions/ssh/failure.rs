use std::io;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) enum Failure {
    Credential(super::CredentialChoice),
    CredentialUnavailable,
    Resolve,
    Refused,
    Unreachable,
    Timeout,

    Closed,
    Network,
    HostKeyRejected,
    Handshake,
    Rejected { tried: Vec<Method> },
    Cancelled,
    Shell,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Method {
    Key,
    Password,
    KeyboardInteractive,
}

impl Method {
    fn label(self) -> &'static str {
        match self {
            Method::Key => "clé",
            Method::Password => "mot de passe",
            Method::KeyboardInteractive => "saisie interactive",
        }
    }
}

impl Failure {
    pub fn from_io(error: &io::Error) -> Self {
        match error.kind() {
            io::ErrorKind::ConnectionRefused => Failure::Refused,
            io::ErrorKind::TimedOut => Failure::Timeout,
            io::ErrorKind::HostUnreachable
            | io::ErrorKind::NetworkUnreachable
            | io::ErrorKind::AddrNotAvailable => Failure::Unreachable,
            io::ErrorKind::ConnectionReset
            | io::ErrorKind::ConnectionAborted
            | io::ErrorKind::UnexpectedEof => Failure::Closed,
            _ => Failure::Network,
        }
    }

    pub fn from_russh(error: &russh::Error) -> Self {
        match error {
            russh::Error::UnknownKey => Failure::HostKeyRejected,
            russh::Error::IO(error) => Failure::from_io(error),
            russh::Error::ConnectionTimeout
            | russh::Error::KeepaliveTimeout
            | russh::Error::InactivityTimeout
            | russh::Error::Elapsed(_) => Failure::Timeout,
            russh::Error::HUP | russh::Error::Disconnect | russh::Error::SendError => {
                Failure::Closed
            }
            russh::Error::ChannelOpenFailure(_) | russh::Error::RequestDenied => Failure::Shell,
            _ => Failure::Handshake,
        }
    }

    pub fn message(&self, address: &str, port: u16) -> String {
        match self {
            Failure::Credential(_) | Failure::CredentialUnavailable => {
                "Cette identité ne peut pas être utilisée. Vérifiez le coffre.".into()
            }
            Failure::Resolve => format!("Adresse introuvable : {address}"),
            Failure::Refused => format!("Connexion refusée par {address}:{port}"),
            Failure::Unreachable => format!("{address} est injoignable"),
            Failure::Timeout => format!("{address}:{port} ne répond pas"),
            Failure::Closed => format!("{address} a fermé la connexion"),
            Failure::Network => format!("Impossible de joindre {address}:{port}"),
            Failure::HostKeyRejected => "Clé du serveur refusée".into(),
            Failure::Handshake => format!("Échec de la négociation SSH avec {address}"),
            Failure::Rejected { tried } if tried.is_empty() => "Authentification refusée".into(),
            Failure::Rejected { tried } => {
                let tried: Vec<_> = tried.iter().map(|method| method.label()).collect();
                format!("Authentification refusée (essayé : {})", tried.join(", "))
            }
            Failure::Cancelled => "Connexion annulée".into(),
            Failure::Shell => "Le serveur n'a pas ouvert de terminal".into(),
        }
    }

    pub fn disconnected(address: &str) -> String {
        format!("Connexion perdue avec {address}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn io_errors_map_to_what_the_user_can_check() {
        let kind = |kind| Failure::from_io(&io::Error::from(kind));
        assert_eq!(kind(io::ErrorKind::ConnectionRefused), Failure::Refused);
        assert_eq!(kind(io::ErrorKind::TimedOut), Failure::Timeout);
        assert_eq!(kind(io::ErrorKind::HostUnreachable), Failure::Unreachable);
        assert_eq!(kind(io::ErrorKind::ConnectionReset), Failure::Closed);
        assert_eq!(kind(io::ErrorKind::Other), Failure::Network);
    }

    #[test]
    fn russh_errors_are_classified() {
        assert_eq!(
            Failure::from_russh(&russh::Error::UnknownKey),
            Failure::HostKeyRejected
        );
        assert_eq!(
            Failure::from_russh(&russh::Error::KeepaliveTimeout),
            Failure::Timeout
        );
        assert_eq!(Failure::from_russh(&russh::Error::HUP), Failure::Closed);
        assert_eq!(Failure::from_russh(&russh::Error::Kex), Failure::Handshake);
    }

    #[test]
    fn messages_name_the_host_and_the_methods_tried() {
        assert_eq!(
            Failure::Refused.message("example.org", 2222),
            "Connexion refusée par example.org:2222"
        );
        assert_eq!(
            Failure::HostKeyRejected.message("example.org", 22),
            "Clé du serveur refusée"
        );
        let rejected = Failure::Rejected {
            tried: vec![Method::Key, Method::Password],
        };
        assert_eq!(
            rejected.message("example.org", 22),
            "Authentification refusée (essayé : clé, mot de passe)"
        );
        assert_eq!(
            Failure::Rejected { tried: vec![] }.message("h", 22),
            "Authentification refusée"
        );
    }
}
