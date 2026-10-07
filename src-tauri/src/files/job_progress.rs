use super::jobs::Job;
impl Job {
    pub fn already_completed(&self, path: &str) -> bool {
        self.event
            .lock()
            .unwrap()
            .completed_sources
            .iter()
            .any(|source| source == path)
    }
    pub fn completed(&self, path: &str) {
        self.event
            .lock()
            .unwrap()
            .completed_sources
            .push(path.into());
    }
    pub fn skip(&self, path: &str) {
        self.event.lock().unwrap().skipped.push(path.into());
    }
    pub fn directory(&self, source: &str) -> Option<String> {
        self.event.lock().unwrap().directories.get(source).cloned()
    }
    pub fn remember_directory(&self, source: &str, target: &str) {
        self.event
            .lock()
            .unwrap()
            .directories
            .insert(source.into(), target.into());
        self.emit("running", None);
    }
}
