use super::Files;
impl Files {
    pub async fn shutdown(&self, graceful: bool) {
        if graceful {
            self.jobs.cancel_all();
        } else {
            self.jobs.interrupt_all();
        }
        let _ = tokio::time::timeout(std::time::Duration::from_secs(2), async {
            while !self.jobs.is_empty() {
                tokio::time::sleep(std::time::Duration::from_millis(20)).await;
            }
        })
        .await;
        let _ = self.raw.close_session();
    }
}
