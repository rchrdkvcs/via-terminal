use super::*;
use crate::sessions::events::recording::Recorder;

async fn pending_id(prompts: &Prompts) -> Uuid {
    loop {
        if let Some(id) = prompts.pending.lock().unwrap().keys().next().copied() {
            return id;
        }
        tokio::task::yield_now().await;
    }
}

#[tokio::test]
async fn answers_reach_the_asker_and_withdrawal_cancels() {
    let prompts = Arc::new(Prompts::new(Arc::new(Recorder::default())));
    let session = Uuid::new_v4();
    let asker = {
        let prompts = prompts.clone();
        tokio::spawn(async move {
            let first = prompts
                .ask(
                    session,
                    Prompt::Username {
                        address: "a".into(),
                    },
                )
                .await;
            let second = prompts
                .ask(
                    session,
                    Prompt::Username {
                        address: "a".into(),
                    },
                )
                .await;
            (first, second)
        })
    };
    prompts
        .answer(pending_id(&prompts).await, PromptAnswer::Accept)
        .unwrap();
    pending_id(&prompts).await;
    prompts.withdraw(session);
    let (first, second) = asker.await.unwrap();
    assert_eq!(first, PromptAnswer::Accept);
    assert_eq!(second, PromptAnswer::Cancel);
}
