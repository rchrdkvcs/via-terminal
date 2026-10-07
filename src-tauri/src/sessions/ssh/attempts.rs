use super::Remembered;
use uuid::Uuid;
use zeroize::Zeroizing;

pub(super) enum Sent {
    /// The password of the plan: read from the vault, or typed in the opening prompt.
    Stored,
    Typed {
        password: Zeroizing<String>,
        remember: bool,
    },
}

struct Attempt {
    saveable: Option<Zeroizing<String>>,
    accepted: Option<bool>,
}

/// Only the last password sent can be saved, once the server accepted it.
pub(super) struct Attempts {
    can_remember: bool,
    opening: Option<Zeroizing<String>>,
    last: Option<Attempt>,
    passphrase: Option<(Uuid, Zeroizing<String>)>,
}

impl Attempts {
    /// `opening` is the password typed with "remember" in the opening prompt.
    pub fn new(can_remember: bool, opening: Option<Zeroizing<String>>) -> Self {
        Self {
            can_remember,
            opening,
            last: None,
            passphrase: None,
        }
    }

    pub fn sent(&mut self, password: Sent) {
        let saveable = match password {
            Sent::Stored => self.opening.clone(),
            Sent::Typed { password, remember } => remember.then_some(password),
        };
        self.last = Some(Attempt {
            saveable,
            accepted: None,
        });
    }

    /// Settles the passwords sent since the last answer; partial success accepts them.
    pub fn answered(&mut self, accepted: bool) {
        if let Some(attempt) = self.last.as_mut().filter(|a| a.accepted.is_none()) {
            attempt.accepted = Some(accepted);
        }
    }

    pub fn retry(&self) -> bool {
        matches!(
            self.last,
            Some(Attempt {
                accepted: Some(false),
                ..
            })
        )
    }

    pub fn unlocked(&mut self, key_id: Uuid, passphrase: Zeroizing<String>) {
        self.passphrase = Some((key_id, passphrase));
    }

    /// The owner of a saved password is decided by the vault's host credential.
    pub fn remembered(self) -> Remembered {
        let password = self
            .last
            .filter(|attempt| attempt.accepted == Some(true) && self.can_remember)
            .and_then(|attempt| attempt.saveable);
        Remembered {
            password,
            passphrase: self.passphrase,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn typed(password: &str, remember: bool) -> Sent {
        Sent::Typed {
            password: Zeroizing::new(password.into()),
            remember,
        }
    }

    fn opening(password: &str) -> Option<Zeroizing<String>> {
        Some(Zeroizing::new(password.into()))
    }

    fn saved(attempts: Attempts) -> Option<String> {
        attempts.remembered().password.map(|p| p.to_string())
    }

    #[test]
    fn a_vault_password_accepted_is_not_saved_again() {
        let mut attempts = Attempts::new(true, None);
        attempts.sent(Sent::Stored);
        attempts.answered(true);
        assert_eq!(saved(attempts), None);
    }

    #[test]
    fn an_opening_password_with_remember_is_saved_once_accepted() {
        let mut attempts = Attempts::new(true, opening("pw"));
        attempts.sent(Sent::Stored);
        attempts.answered(true);
        assert_eq!(saved(attempts), Some("pw".into()));
    }

    #[test]
    fn a_refused_stored_password_then_a_remembered_typed_one_saves_the_typed_one() {
        let mut attempts = Attempts::new(true, opening("wrong"));
        attempts.sent(Sent::Stored);
        attempts.answered(false);
        assert!(attempts.retry());
        attempts.sent(typed("pw", true));
        attempts.answered(true);
        assert!(!attempts.retry());
        assert_eq!(saved(attempts), Some("pw".into()));
    }

    #[test]
    fn a_refused_opening_password_is_never_saved_over_an_unremembered_retry() {
        let mut attempts = Attempts::new(true, opening("wrong"));
        attempts.sent(Sent::Stored);
        attempts.answered(false);
        attempts.sent(typed("pw", false));
        attempts.answered(true);
        assert_eq!(saved(attempts), None);
    }

    #[test]
    fn only_the_accepted_typed_password_counts() {
        let mut refused_remembered = Attempts::new(true, None);
        refused_remembered.sent(typed("wrong", true));
        refused_remembered.answered(false);
        refused_remembered.sent(typed("pw", false));
        refused_remembered.answered(true);
        assert_eq!(saved(refused_remembered), None);

        let mut then_remembered = Attempts::new(true, None);
        then_remembered.sent(typed("wrong", false));
        then_remembered.answered(false);
        then_remembered.sent(typed("pw", true));
        then_remembered.answered(true);
        assert_eq!(saved(then_remembered), Some("pw".into()));
    }

    #[test]
    fn nothing_is_saved_without_remember_or_when_the_plan_cannot_remember() {
        let mut unchecked = Attempts::new(true, None);
        unchecked.sent(typed("pw", false));
        unchecked.answered(true);
        assert_eq!(saved(unchecked), None);

        let mut forbidden = Attempts::new(false, opening("pw"));
        forbidden.sent(typed("pw", true));
        forbidden.answered(true);
        assert_eq!(saved(forbidden), None);
    }

    #[test]
    fn keyboard_interactive_settles_every_password_of_the_exchange_at_once() {
        let mut stored_only = Attempts::new(true, opening("pw"));
        stored_only.sent(Sent::Stored);
        stored_only.answered(true);
        assert_eq!(saved(stored_only), Some("pw".into()));

        let mut stored_then_typed = Attempts::new(true, opening("wrong"));
        stored_then_typed.sent(Sent::Stored);
        stored_then_typed.sent(typed("pw", true));
        stored_then_typed.answered(true);
        assert_eq!(saved(stored_then_typed), Some("pw".into()));

        let mut refused = Attempts::new(true, None);
        refused.sent(typed("wrong", true));
        refused.answered(false);
        assert_eq!(saved(refused), None);
    }

    #[test]
    fn an_answer_without_a_new_password_keeps_the_previous_verdict() {
        let mut attempts = Attempts::new(true, None);
        attempts.sent(typed("wrong", true));
        attempts.answered(false);
        attempts.answered(true);
        assert!(attempts.retry());
        assert_eq!(saved(attempts), None);
    }

    #[test]
    fn an_unanswered_password_is_not_saved() {
        let mut attempts = Attempts::new(true, opening("pw"));
        attempts.sent(Sent::Stored);
        assert!(!attempts.retry());
        assert_eq!(saved(attempts), None);
    }

    #[test]
    fn an_unlocked_passphrase_is_remembered_with_its_key() {
        let key = Uuid::new_v4();
        let mut attempts = Attempts::new(true, None);
        attempts.unlocked(key, Zeroizing::new("phrase".into()));
        let remembered = attempts.remembered();
        let (id, passphrase) = remembered.passphrase.unwrap();
        assert_eq!((id, passphrase.as_str()), (key, "phrase"));
    }
}
