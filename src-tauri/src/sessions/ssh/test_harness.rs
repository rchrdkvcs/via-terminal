use super::{
    test_server::{self, TestServer},
    test_store::FakeStore,
    ConnectPlan, HostKeyStatus,
};
use crate::sessions::{
    events::{recording::Recorder, Event, SessionState},
    prompts::{Prompt, PromptAnswer},
    SessionHub, Size,
};
use std::{sync::Arc, sync::Mutex, time::Duration};
use uuid::Uuid;
use zeroize::Zeroizing;

pub struct Harness {
    pub hub: SessionHub,
    pub recorder: Arc<Recorder>,
    pub store: Arc<FakeStore>,
    pub server: TestServer,
    answered: Mutex<Vec<Uuid>>,
}

async fn eventually<T>(what: &str, mut check: impl FnMut() -> Option<T>) -> T {
    let wait = async {
        loop {
            if let Some(found) = check() {
                return found;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    };
    match tokio::time::timeout(Duration::from_secs(10), wait).await {
        Ok(found) => found,
        Err(_) => panic!("timed out waiting for {what}"),
    }
}

impl Harness {
    pub async fn new(status: HostKeyStatus) -> Self {
        let recorder = Arc::new(Recorder::default());
        Self {
            hub: SessionHub::new(recorder.clone()),
            recorder,
            store: Arc::new(FakeStore::new(status)),
            server: test_server::start().await,
            answered: Mutex::default(),
        }
    }

    pub fn open(&self, password: Option<&str>) -> Uuid {
        let plan = ConnectPlan {
            host_id: None,
            label: "test".into(),
            address: "127.0.0.1".into(),
            port: self.server.port,
            username: Some("via".into()),
            key: None,
            password: password.map(|password| Zeroizing::new(password.to_string())),
            can_remember: true,
            save_host: false,
        };
        let size = Size { cols: 80, rows: 24 };
        self.hub.open_ssh(plan, self.store.clone(), size).unwrap()
    }

    pub async fn prompt(&self, session: Uuid) -> (Uuid, Prompt) {
        eventually("a prompt", || {
            let answered = self.answered.lock().unwrap();
            self.recorder
                .0
                .lock()
                .unwrap()
                .iter()
                .find_map(|event| match event {
                    Event::Prompt {
                        session_id,
                        prompt_id,
                        prompt,
                    } if *session_id == session && !answered.contains(prompt_id) => {
                        Some((*prompt_id, prompt.clone()))
                    }
                    _ => None,
                })
        })
        .await
    }

    pub fn answer(&self, prompt_id: Uuid, answer: PromptAnswer) {
        self.answered.lock().unwrap().push(prompt_id);
        self.hub.answer(prompt_id, answer).unwrap();
    }

    pub async fn state(&self, session: Uuid, state: SessionState) -> (Option<String>, Option<i32>) {
        eventually(&format!("{state:?}"), || {
            self.recorder
                .0
                .lock()
                .unwrap()
                .iter()
                .find_map(|event| match event {
                    Event::State {
                        session_id,
                        state: reached,
                        message,
                        exit_code,
                    } if *session_id == session && *reached == state => {
                        Some((message.clone(), *exit_code))
                    }
                    _ => None,
                })
        })
        .await
    }

    pub async fn output(&self, session: Uuid, needle: &str) {
        eventually(&format!("output {needle:?}"), || {
            let events = self.recorder.0.lock().unwrap();
            let output: Vec<u8> = events
                .iter()
                .filter_map(|event| match event {
                    Event::Output { session_id, data } if *session_id == session => Some(data),
                    _ => None,
                })
                .flatten()
                .copied()
                .collect();
            String::from_utf8_lossy(&output)
                .contains(needle)
                .then_some(())
        })
        .await
    }
}
